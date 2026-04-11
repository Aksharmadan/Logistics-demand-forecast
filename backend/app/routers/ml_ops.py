"""Train-time anomaly refresh and simulated real-time ingest."""

from datetime import datetime

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import artifacts_dir, require_roles
from app.ml import anomaly as anomaly_mod
from app.models import AnomalyAlert, DemandRecord, User
from app.schemas import SimulatedTick
from app.stream_bus import publish_event

router = APIRouter(tags=["ml-ops"])


@router.post("/detect-anomalies")
def detect_anomalies(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "analyst")),
) -> dict:
    from app.config import get_settings

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
    created = 0
    for _, row in scored.iterrows():
        z = abs(float(row["z_score"]))
        iso = float(row["iso_score"])
        if z < 2.5 and iso > -0.15:
            continue
        severity = "high" if z >= 3.5 or iso <= -0.25 else "medium"
        msg = (
            f"Unusual demand in {row['region']} on {row['record_date']}: "
            f"actual {row['demand_quantity']:.1f} vs expected {row['expected_demand']:.1f}."
        )
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
        alert = AnomalyAlert(
            alert_date=row["record_date"],
            region=row["region"],
            demand_quantity=float(row["demand_quantity"]),
            expected_demand=float(row["expected_demand"]),
            anomaly_score=float(z + abs(iso)),
            severity=severity,
            message=msg,
        )
        db.add(alert)
        created += 1
    db.commit()
    return {"message": "Anomaly scan complete", "new_alerts": created}


@router.post("/ingest/simulated")
def ingest_simulated(
    body: SimulatedTick,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "analyst")),
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
    publish_event("ingest_simulated", {"region": body.region, "demand_quantity": qty, "source": "api"})

    settings = get_settings()
    model_path = artifacts_dir() / settings.model_filename
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
            last = scored.iloc[-1]
            z = abs(float(last["z_score"]))
            if z >= 2.0:
                alert = AnomalyAlert(
                    alert_date=today,
                    region=body.region,
                    demand_quantity=qty,
                    expected_demand=float(last["expected_demand"]),
                    anomaly_score=float(z),
                    severity="high" if z >= 3 else "medium",
                    message=f"Live simulated tick anomaly in {body.region}: z={z:.2f}",
                )
                db.add(alert)
                db.commit()
        except Exception:
            pass

    return {"message": "Ingested simulated point", "demand_quantity": qty, "date": str(today)}
