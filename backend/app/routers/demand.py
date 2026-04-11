import io
import json
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import artifacts_dir, require_roles
from app.ml import pipeline as ml_pipeline
from app.ml.ensemble import (
    explain_from_features,
    interval_for_region,
    load_ensemble_or_legacy,
    save_ensemble as save_ensemble_artifact,
    train_ensemble_from_frame,
)
from app.ml.pipeline import _aggregate_daily
from app.models import DemandRecord, ModelRun, User
from app.schemas import PredictRequest, PredictResponse, TrainResponse

router = APIRouter(tags=["demand"])
settings = get_settings()


@router.post("/upload-data")
def upload_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "analyst")),
) -> dict:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "CSV file required")
    raw = file.file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as e:
        raise HTTPException(400, f"Invalid CSV: {e}") from e

    col_map = {c.lower().strip(): c for c in df.columns}
    required = {"date", "region", "demand"}
    lower_cols = set(col_map.keys())
    if not required.issubset(lower_cols):
        raise HTTPException(400, f"CSV must include columns: date, region, demand. Got: {list(df.columns)}")

    def pick(name: str) -> str:
        return col_map[name]

    df = df.rename(
        columns={
            pick("date"): "record_date",
            pick("region"): "region",
            pick("demand"): "demand_quantity",
        }
    )
    df["record_date"] = pd.to_datetime(df["record_date"]).dt.date
    df["region"] = df["region"].astype(str).str.strip()
    df["demand_quantity"] = pd.to_numeric(df["demand_quantity"], errors="coerce")
    df = df.dropna(subset=["record_date", "region", "demand_quantity"])

    sku_col = next((c for c in lower_cols if c == "sku"), None)
    if sku_col:
        df["sku"] = df[col_map[sku_col]].astype(str)
    else:
        df["sku"] = None

    inserted = 0
    for _, row in df.iterrows():
        rec = DemandRecord(
            record_date=row["record_date"],
            region=row["region"],
            sku=row["sku"],
            demand_quantity=float(row["demand_quantity"]),
            source="upload",
        )
        db.add(rec)
        inserted += 1
    db.commit()
    return {"message": "Upload successful", "rows_inserted": inserted}


@router.post("/train-model", response_model=TrainResponse)
def train_model(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "analyst")),
) -> TrainResponse:
    rows = db.query(DemandRecord).all()
    if len(rows) < 80:
        raise HTTPException(400, "Need more history (>= ~80 daily points aggregated) to train.")

    df = pd.DataFrame(
        [
            {
                "record_date": r.record_date,
                "region": r.region,
                "demand_quantity": r.demand_quantity,
            }
            for r in rows
        ]
    )

    try:
        ens = train_ensemble_from_frame(df)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    art_dir = artifacts_dir()
    model_path = art_dir / settings.model_filename
    metrics_path = art_dir / settings.metrics_filename
    save_ensemble_artifact(ens, model_path, metrics_path)

    run = ModelRun(
        trained_at=datetime.utcnow(),
        rmse=ens.rmse,
        mae=ens.mae,
        n_samples=ens.n_samples,
        model_path=str(model_path),
        extra_metrics=json.dumps(
            {"best_name": ens.best_name, "comparison": ens.comparison, "feature_importance": ens.artifact_dict.get("feature_importance", [])}
        ),
    )
    db.add(run)
    db.commit()

    return TrainResponse(
        message=f"Ensemble trained — auto-selected {ens.best_name}",
        rmse=ens.rmse,
        mae=ens.mae,
        n_samples=ens.n_samples,
        model_path=str(model_path),
    )


@router.post("/predict", response_model=PredictResponse)
def predict(
    body: PredictRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "analyst", "viewer")),
) -> PredictResponse:
    rows = db.query(DemandRecord).all()
    if not rows:
        raise HTTPException(400, "No demand data")

    df = pd.DataFrame(
        [
            {
                "record_date": r.record_date,
                "region": r.region,
                "demand_quantity": r.demand_quantity,
            }
            for r in rows
        ]
    )

    model_path = artifacts_dir() / settings.model_filename
    artifact = load_ensemble_or_legacy(model_path)
    fc = ml_pipeline.forecast_recursive(artifact, df, body.horizon_days, body.regions)

    last_run = db.query(ModelRun).order_by(ModelRun.trained_at.desc()).first()
    return PredictResponse(
        predictions=[
            {
                "forecast_date": r["forecast_date"],
                "region": r["region"],
                "predicted_demand": float(r["predicted_demand"]),
            }
            for _, r in fc.iterrows()
        ],
        model_trained_at=last_run.trained_at if last_run else None,
    )


@router.post("/predict/rich")
def predict_rich(
    body: PredictRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "analyst", "viewer")),
) -> dict:
    rows = db.query(DemandRecord).all()
    if not rows:
        raise HTTPException(400, "No demand data")
    df = pd.DataFrame(
        [
            {"record_date": r.record_date, "region": r.region, "demand_quantity": r.demand_quantity}
            for r in rows
        ]
    )
    model_path = artifacts_dir() / settings.model_filename
    artifact = load_ensemble_or_legacy(model_path)
    fc = ml_pipeline.forecast_recursive(artifact, df, body.horizon_days, body.regions)

    preds: list[dict] = []
    for _, r in fc.iterrows():
        region = str(r["region"])
        p = float(r["predicted_demand"])
        half = interval_for_region(artifact, region, z=1.96)
        preds.append(
            {
                "forecast_date": str(r["forecast_date"]),
                "region": region,
                "predicted_demand": p,
                "lower_95": max(0.0, p - half),
                "upper_95": p + half,
            }
        )

    feat_cols: list[str] = artifact.get("feature_columns", [])
    importance = artifact.get("feature_importance") or []
    explain_sample = None
    if preds and feat_cols:
        daily = _aggregate_daily(df)
        region = preds[0]["region"]
        sub = daily[daily["region"] == region].sort_values("record_date")
        hist = sub["demand_quantity"].tolist()
        if len(hist) >= 7:
            lag_1, lag_7 = hist[-1], hist[-7]
            roll_mean_7 = float(sum(hist[-7:]) / 7)
            roll_std_7 = float(pd.Series(hist[-7:]).std() or 0.0)
        else:
            lag_1 = hist[-1] if hist else 0.0
            lag_7 = hist[0] if hist else 0.0
            roll_mean_7 = float(sum(hist) / len(hist)) if hist else 0.0
            roll_std_7 = 0.0
        fdate = pd.Timestamp(preds[0]["forecast_date"])
        enc = artifact.get("region_encoder", {})
        row_vec = {
            "region_code": float(enc.get(region, 0)),
            "dow": float(fdate.dayofweek),
            "month": float(fdate.month),
            "lag_1": float(lag_1),
            "lag_7": float(lag_7),
            "roll_mean_7": roll_mean_7,
            "roll_std_7": roll_std_7,
        }
        explain_sample = explain_from_features(feat_cols, row_vec, importance)

    last_run = db.query(ModelRun).order_by(ModelRun.trained_at.desc()).first()
    return {
        "predictions": preds,
        "best_model": artifact.get("best_name"),
        "explain": explain_sample,
        "feature_importance": importance[:8],
        "model_trained_at": last_run.trained_at.isoformat() if last_run else None,
    }


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "logistics-forecast-api"}
