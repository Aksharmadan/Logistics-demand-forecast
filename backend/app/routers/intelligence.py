from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import artifacts_dir, get_current_user
from app.ml import pipeline as ml_pipeline
from app.ml.ensemble import interval_for_region, load_ensemble_or_legacy
from app.models import DemandRecord, User

router = APIRouter(prefix="/intelligence", tags=["intelligence"])
settings = get_settings()


class ScenarioBody(BaseModel):
    demand_multiplier: float = Field(default=1.3, ge=0.5, le=3.0, description="e.g. 1.3 = +30% demand")
    horizon_days: int = Field(default=14, ge=1, le=60)


@router.get("/insights")
def predictive_insights(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    rows = db.query(DemandRecord).all()
    if len(rows) < 40:
        return {"insights": [], "message": "Upload more history for richer insights."}

    df = pd.DataFrame(
        [
            {"record_date": r.record_date, "region": r.region, "demand_quantity": r.demand_quantity}
            for r in rows
        ]
    )
    model_path = artifacts_dir() / settings.model_filename
    try:
        art = load_ensemble_or_legacy(model_path)
        fc = ml_pipeline.forecast_recursive(art, df, horizon_days=5, regions=None)
    except FileNotFoundError:
        return {"insights": [], "message": "Train the model to unlock predictive insights."}

    last_by_region = df.groupby("region")["demand_quantity"].mean()
    insights: list[dict] = []
    for region in fc["region"].unique():
        sub = fc[fc["region"] == region].sort_values("forecast_date")
        if sub.empty:
            continue
        recent_avg = float(last_by_region.get(region, sub["predicted_demand"].mean()))
        peak_row = sub.loc[sub["predicted_demand"].idxmax()]
        peak = float(peak_row["predicted_demand"])
        lift = (peak - recent_avg) / recent_avg * 100 if recent_avg > 0 else 0
        if lift >= 8:
            insights.append(
                {
                    "severity": "high" if lift >= 18 else "medium",
                    "title": f"Demand expected to spike in {region}",
                    "detail": f"Peak in next 5 days reaches ~{peak:.0f} vs recent avg {recent_avg:.0f} ({lift:+.1f}%).",
                    "region": region,
                    "window_days": 5,
                }
            )
        elif lift <= -8:
            insights.append(
                {
                    "severity": "low",
                    "title": f"Softening demand in {region}",
                    "detail": f"Forecast trough suggests {lift:.1f}% below recent average.",
                    "region": region,
                    "window_days": 5,
                }
            )

    insights.sort(key=lambda x: 0 if x["severity"] == "high" else 1)
    return {"insights": insights[:12]}


@router.get("/recommendations")
def ai_recommendations(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    rows = db.query(DemandRecord).all()
    if not rows:
        return {"recommendations": []}
    df = pd.DataFrame(
        [
            {"record_date": r.record_date, "region": r.region, "demand_quantity": r.demand_quantity}
            for r in rows
        ]
    )
    end = date.today()
    start = end - timedelta(days=14)
    tail = df[df["record_date"] >= start]
    recs: list[dict] = []
    for region, g in tail.groupby("region"):
        slope = float(np.polyfit(np.arange(len(g)), g["demand_quantity"].values, 1)[0]) if len(g) > 3 else 0.0
        mean_d = float(g["demand_quantity"].mean())
        if slope > 0.8 and mean_d > 0:
            bump = min(35, max(8, slope * 5))
            recs.append(
                {
                    "priority": "high",
                    "action": f"Increase staged inventory ~{bump:.0f}% in {region}",
                    "rationale": "Two-week trend slope is positive with sustained throughput.",
                    "region": region,
                }
            )
        elif slope < -0.8:
            recs.append(
                {
                    "priority": "medium",
                    "action": f"Trim safety stock in {region} and reallocate capacity",
                    "rationale": "Demand slope declining over the last 14 days.",
                    "region": region,
                }
            )
    return {"recommendations": recs[:10]}


@router.post("/scenario/simulate")
def scenario_simulate(
    body: ScenarioBody,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
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
    art = load_ensemble_or_legacy(model_path)
    base_fc = ml_pipeline.forecast_recursive(art, df, body.horizon_days, None)
    scaled = base_fc.copy()
    scaled["predicted_demand"] = scaled["predicted_demand"] * body.demand_multiplier
    base_total = float(base_fc["predicted_demand"].sum())
    new_total = float(scaled["predicted_demand"].sum())
    return {
        "demand_multiplier": body.demand_multiplier,
        "horizon_days": body.horizon_days,
        "baseline_total_forecast_units": base_total,
        "scenario_total_forecast_units": new_total,
        "delta_units": new_total - base_total,
        "delta_pct": ((new_total - base_total) / base_total * 100) if base_total > 0 else 0.0,
        "headline": f"If demand scales by {(body.demand_multiplier - 1) * 100:+.0f}%, expect ~{new_total - base_total:+.0f} additional units over {body.horizon_days} days.",
    }


@router.get("/model-comparison")
def model_comparison(
    _: User = Depends(get_current_user),
) -> dict:
    path = artifacts_dir() / settings.metrics_filename
    if not path.exists():
        return {"trained": False, "metrics": {}}
    import json

    raw = json.loads(path.read_text())
    return {"trained": True, "metrics": raw}


@router.get("/feature-importance")
def feature_importance(
    _: User = Depends(get_current_user),
) -> dict:
    model_path = artifacts_dir() / settings.model_filename
    try:
        art = load_ensemble_or_legacy(model_path)
    except FileNotFoundError:
        return {"items": []}
    items = art.get("feature_importance") or []
    return {"items": items, "best_model": art.get("best_name", "histgradient")}


@router.get("/stream-log")
def stream_log(
    _: User = Depends(get_current_user),
) -> dict:
    from app.stream_bus import recent_events

    return {"events": recent_events(100)}
