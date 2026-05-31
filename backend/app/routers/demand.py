import io
import json
from datetime import date, datetime, timedelta

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import artifacts_dir, require_roles
from app.ml import pipeline as ml_pipeline
from app.models import AuditLog, DemandRecord, ModelRun, User
from app.schemas import PredictRequest, PredictResponse, TrainResponse

router = APIRouter(tags=["demand"])
settings = get_settings()


def _write_audit(db: Session, user: User, action: str, resource: str = "", details: str = "") -> None:
    log = AuditLog(
        user_email=user.email,
        action=action,
        resource=resource,
        details=details,
        status="success",
    )
    db.add(log)
    db.commit()


@router.post("/upload-data")
def upload_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "analyst")),
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
    if not required.issubset(set(col_map.keys())):
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

    sku_col = next((c for c in col_map.keys() if c == "sku"), None)
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

    _write_audit(db, current_user, "data_upload", file.filename, f"Inserted {inserted} rows")

    auto_trained = False
    if inserted >= 50:
        try:
            train_model(db=db, current_user=current_user)
            auto_trained = True
        except Exception as e:
            print(f"Auto-train failed: {e}")

    return {"message": "Upload successful", "rows_inserted": inserted, "auto_trained": auto_trained}


@router.post("/train-model", response_model=TrainResponse)
def train_model(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "analyst")),
) -> TrainResponse:
    rows = db.query(DemandRecord).all()
    if len(rows) < 80:
        raise HTTPException(400, "Need more history (>= ~80 daily points) to train.")

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
        result = ml_pipeline.train_from_frame(df)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    art_dir = artifacts_dir()
    model_path = art_dir / settings.model_filename
    metrics_path = art_dir / settings.metrics_filename
    ml_pipeline.save_artifact(result, model_path, metrics_path)

    run = ModelRun(
        trained_at=datetime.utcnow(),
        rmse=result.rmse,
        mae=result.mae,
        mape=result.mape,
        n_samples=result.n_samples,
        model_path=str(model_path),
        xgb_rmse=result.xgb_rmse,
        lgb_rmse=result.lgb_rmse,
        extra_metrics=json.dumps(
            {
                "feature_columns": result.feature_columns,
                "ensemble_weights": result.ensemble_weights,
                "feature_importance": result.feature_importance,
            }
        ),
        status="completed",
    )
    db.add(run)
    db.commit()

    _write_audit(
        db, current_user, "model_trained", str(model_path),
        f"RMSE={result.rmse:.3f}, MAE={result.mae:.3f}, MAPE={result.mape:.1f}%, n={result.n_samples}"
    )

    return TrainResponse(
        message="Ensemble model trained and saved",
        rmse=result.rmse,
        mae=result.mae,
        mape=result.mape,
        n_samples=result.n_samples,
        model_path=str(model_path),
        xgb_rmse=result.xgb_rmse,
        lgb_rmse=result.lgb_rmse,
        ensemble_weights=result.ensemble_weights,
        feature_importance=result.feature_importance,
    )


@router.post("/predict", response_model=PredictResponse)
def predict(
    body: PredictRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "analyst", "viewer")),
) -> PredictResponse:
    rows = db.query(DemandRecord).all()
    if not rows:
        raise HTTPException(400, "No demand data available")

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
    try:
        artifact = ml_pipeline.load_artifact(model_path)
    except FileNotFoundError:
        raise HTTPException(400, "Model not trained yet. Train the model first.")

    fc = ml_pipeline.forecast_recursive(
        artifact, df, body.horizon_days, body.regions, body.confidence_level
    )

    last_run = db.query(ModelRun).order_by(ModelRun.trained_at.desc()).first()

    _write_audit(
        db, current_user, "forecast_generated", "",
        f"horizon={body.horizon_days}d, regions={body.regions}, confidence={body.confidence_level}"
    )

    return PredictResponse(
        predictions=[
            {
                "forecast_date": r["forecast_date"],
                "region": r["region"],
                "predicted_demand": float(r["predicted_demand"]),
                "lower_bound": float(r["lower_bound"]),
                "upper_bound": float(r["upper_bound"]),
                "confidence_level": float(r["confidence_level"]),
                "xgb_pred": float(r["xgb_pred"]),
                "lgb_pred": float(r["lgb_pred"]),
            }
            for _, r in fc.iterrows()
        ],
        model_trained_at=last_run.trained_at if last_run else None,
        model_rmse=last_run.rmse if last_run else None,
        model_mae=last_run.mae if last_run else None,
        model_mape=last_run.mape if last_run else None,
    )


@router.get("/model/runs")
def list_model_runs(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "analyst")),
) -> list[dict]:
    runs = db.query(ModelRun).order_by(ModelRun.trained_at.desc()).limit(20).all()
    return [
        {
            "id": r.id,
            "trained_at": r.trained_at.isoformat(),
            "rmse": r.rmse,
            "mae": r.mae,
            "mape": r.mape,
            "n_samples": r.n_samples,
            "xgb_rmse": r.xgb_rmse,
            "lgb_rmse": r.lgb_rmse,
            "status": r.status,
        }
        for r in runs
    ]


@router.get("/model/feature-importance")
def feature_importance(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "analyst", "viewer")),
) -> dict:
    model_path = artifacts_dir() / settings.model_filename
    try:
        artifact = ml_pipeline.load_artifact(model_path)
    except FileNotFoundError:
        raise HTTPException(400, "Model not trained yet.")

    fi = artifact.get("feature_importance", {})
    last_run = db.query(ModelRun).order_by(ModelRun.trained_at.desc()).first()

    sorted_fi = sorted(fi.items(), key=lambda x: x[1], reverse=True)
    features = [
        {"name": name, "importance": round(imp, 4), "rank": i + 1}
        for i, (name, imp) in enumerate(sorted_fi)
    ]

    return {
        "features": features,
        "model_trained_at": last_run.trained_at.isoformat() if last_run else None,
    }


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "forecastflow-api", "version": "2.0.0"}
