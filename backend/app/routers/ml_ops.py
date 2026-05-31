"""ForecastFlow AI — ML Operations: anomaly detection, simulated ingest, copilot."""

import json
from datetime import datetime

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import artifacts_dir, get_current_user, require_roles
from app.ml import anomaly as anomaly_mod
from app.ml.copilot import ForecastCopilot
from app.models import AnomalyAlert, AuditLog, DemandRecord, ModelRun, User
from app.schemas import CopilotRequest, CopilotResponse, SimulatedTick

router = APIRouter(tags=["ml-ops"])


@router.post("/detect-anomalies")
def detect_anomalies(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "analyst")),
) -> dict:
    settings = get_settings()
    model_path = artifacts_dir() / settings.model_filename
    if not model_path.exists():
        raise HTTPException(400, "Train model before running anomaly detection.")

    rows = db.query(DemandRecord).all()
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
    scored = anomaly_mod.score_recent(df, model_path)
    if scored.empty:
        return {"message": "No data to score", "new_alerts": 0}

    created = 0
    for _, row in scored.iterrows():
        z = float(row["z_score"])
        iso = float(row["iso_score"])
        iqr = bool(row.get("iqr_anomaly", False))
        severity = anomaly_mod.classify_severity(z, iso, iqr)

        if severity == "normal":
            continue

        exists = (
            db.query(AnomalyAlert)
            .filter(
                AnomalyAlert.region == row["region"],
                AnomalyAlert.alert_date == row["record_date"],
            )
            .first()
        )
        if exists:
            continue

        msg = anomaly_mod.build_anomaly_message(
            region=str(row["region"]),
            record_date=row["record_date"],
            actual=float(row["demand_quantity"]),
            expected=float(row["expected_demand"]),
            z_score=z,
            severity=severity,
        )

        alert = AnomalyAlert(
            alert_date=row["record_date"],
            region=str(row["region"]),
            demand_quantity=float(row["demand_quantity"]),
            expected_demand=float(row["expected_demand"]),
            anomaly_score=float(abs(z) + abs(iso)),
            severity=severity,
            message=msg,
        )
        db.add(alert)
        created += 1

    db.commit()

    # Audit log
    log = AuditLog(
        user_email=current_user.email,
        action="anomaly_detection",
        details=f"Scanned {len(scored)} records, created {created} new alerts",
        status="success",
    )
    db.add(log)
    db.commit()

    return {"message": "Anomaly scan complete", "new_alerts": created, "records_scanned": len(scored)}


@router.post("/ingest/simulated")
def ingest_simulated(
    body: SimulatedTick,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "analyst")),
) -> dict:
    rng = np.random.default_rng()
    noise = rng.normal(0, body.noise)
    qty = max(0.0, body.base_demand + float(noise))
    today = datetime.utcnow().date()
    rec = DemandRecord(
        record_date=today,
        region=body.region.strip(),
        sku=None,
        demand_quantity=qty,
        source="simulated",
    )
    db.add(rec)
    db.commit()

    settings = get_settings()
    model_path = artifacts_dir() / settings.model_filename
    alert_created = False
    if model_path.exists():
        rows = db.query(DemandRecord).filter(DemandRecord.region == body.region).all()
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
            scored = anomaly_mod.score_recent(df, model_path, contamination=0.08)
            if not scored.empty:
                last = scored.iloc[-1]
                z = float(last["z_score"])
                iso = float(last["iso_score"])
                iqr = bool(last.get("iqr_anomaly", False))
                severity = anomaly_mod.classify_severity(z, iso, iqr)
                if severity != "normal":
                    alert = AnomalyAlert(
                        alert_date=today,
                        region=body.region,
                        demand_quantity=qty,
                        expected_demand=float(last["expected_demand"]),
                        anomaly_score=float(abs(z)),
                        severity=severity,
                        message=anomaly_mod.build_anomaly_message(
                            body.region, today, qty, float(last["expected_demand"]), z, severity
                        ),
                    )
                    db.add(alert)
                    db.commit()
                    alert_created = True
        except Exception:
            pass

    return {
        "message": "Ingested simulated point",
        "demand_quantity": round(qty, 2),
        "date": str(today),
        "region": body.region,
        "alert_created": alert_created,
    }


@router.post("/copilot", response_model=CopilotResponse)
def copilot_query(
    body: CopilotRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CopilotResponse:
    """AI Copilot — answers operational questions using real data."""
    # Load demand data
    rows = db.query(DemandRecord).all()
    demand_df = pd.DataFrame(
        [
            {
                "record_date": r.record_date,
                "region": r.region,
                "demand_quantity": r.demand_quantity,
            }
            for r in rows
        ]
    ) if rows else pd.DataFrame()

    # Load alerts
    alerts = db.query(AnomalyAlert).order_by(AnomalyAlert.created_at.desc()).limit(200).all()
    alerts_list = [
        {
            "id": a.id,
            "alert_date": str(a.alert_date),
            "region": a.region,
            "severity": a.severity,
            "message": a.message,
            "acknowledged": a.acknowledged,
        }
        for a in alerts
    ]

    # Load model metrics
    settings = get_settings()
    metrics_path = artifacts_dir() / settings.metrics_filename
    model_metrics = {}
    if metrics_path.exists():
        try:
            model_metrics = json.loads(metrics_path.read_text())
        except Exception:
            pass

    copilot = ForecastCopilot(
        demand_df=demand_df,
        alerts=alerts_list,
        model_metrics=model_metrics,
    )

    result = copilot.answer(body.question)

    # Audit
    log = AuditLog(
        user_email=current_user.email,
        action="copilot_query",
        details=f"Q: {body.question[:100]}",
        status="success",
    )
    db.add(log)
    db.commit()

    return CopilotResponse(
        answer=result["answer"],
        confidence=result["confidence"],
        sources=result["sources"],
        recommendations=result["recommendations"],
        data_points=result["data_points"],
    )


@router.get("/model/status")
def model_status(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """Returns current model status and key metrics."""
    settings = get_settings()
    model_path = artifacts_dir() / settings.model_filename
    metrics_path = artifacts_dir() / settings.metrics_filename

    last_run = db.query(ModelRun).order_by(ModelRun.trained_at.desc()).first()
    total_records = db.query(DemandRecord).count()

    metrics = {}
    if metrics_path.exists():
        try:
            metrics = json.loads(metrics_path.read_text())
        except Exception:
            pass

    return {
        "model_exists": model_path.exists(),
        "last_trained": last_run.trained_at.isoformat() if last_run else None,
        "rmse": last_run.rmse if last_run else None,
        "mae": last_run.mae if last_run else None,
        "mape": last_run.mape if last_run else None,
        "n_samples": last_run.n_samples if last_run else None,
        "xgb_rmse": last_run.xgb_rmse if last_run else None,
        "lgb_rmse": last_run.lgb_rmse if last_run else None,
        "total_demand_records": total_records,
        "feature_importance": metrics.get("feature_importance", {}),
        "ensemble_weights": metrics.get("ensemble_weights", []),
    }
