from datetime import date, timedelta

import pandas as pd
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import AnomalyAlert, DemandRecord, User
from app.schemas import AnalyticsResponse, AnalyticsSummary, HeatmapCell, RegionDemandBar, TimeSeriesPoint

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _rows_to_df(db: Session, region: str | None, sku: str | None, date_from: date | None, date_to: date | None):
    rows = db.query(DemandRecord).all()
    df = pd.DataFrame(
        [
            {
                "record_date": r.record_date,
                "region": r.region,
                "sku": r.sku or "",
                "demand_quantity": r.demand_quantity,
            }
            for r in rows
        ]
    )
    if df.empty:
        return df
    if region:
        df = df[df["region"] == region]
    if sku:
        df = df[df["sku"] == sku]
    if date_from is not None:
        df = df[df["record_date"] >= date_from]
    if date_to is not None:
        df = df[df["record_date"] <= date_to]
    return df


@router.get("", response_model=AnalyticsResponse)
def analytics(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    region: str | None = Query(default=None),
    sku: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
) -> AnalyticsResponse:
    end = date_to or date.today()
    start_30 = end - timedelta(days=30)
    start_60 = end - timedelta(days=60)

    df = _rows_to_df(db, region, sku, date_from, date_to)
    if df.empty:
        empty = AnalyticsSummary(
            total_demand_last_30d=0,
            avg_daily_demand=0,
            growth_pct_vs_prior_30d=0,
            active_regions=0,
            open_alerts=0,
        )
        return AnalyticsResponse(
            summary=empty,
            demand_by_region=[],
            demand_over_time=[],
            heatmap=[],
        )

    d30 = df[df["record_date"] >= start_30]
    prev = df[(df["record_date"] >= start_60) & (df["record_date"] < start_30)]

    total_30 = float(d30["demand_quantity"].sum())
    total_prev = float(prev["demand_quantity"].sum())
    growth = ((total_30 - total_prev) / total_prev * 100) if total_prev > 0 else 0.0
    days = max((d30["record_date"].max() - d30["record_date"].min()).days, 1) if len(d30) else 1
    avg_daily = total_30 / days

    regions_cnt = int(d30["region"].nunique()) if len(d30) else int(df["region"].nunique())
    open_alerts = db.query(AnomalyAlert).filter(AnomalyAlert.acknowledged.is_(False)).count()

    summary = AnalyticsSummary(
        total_demand_last_30d=total_30,
        avg_daily_demand=avg_daily,
        growth_pct_vs_prior_30d=growth,
        active_regions=regions_cnt,
        open_alerts=open_alerts,
    )

    by_region = (
        d30.groupby("region", as_index=False)["demand_quantity"]
        .sum()
        .sort_values("demand_quantity", ascending=False)
        .head(20)
    )
    demand_by_region = [
        RegionDemandBar(region=r["region"], total_demand=float(r["demand_quantity"]))
        for _, r in by_region.iterrows()
    ]

    daily = df.groupby("record_date", as_index=False)["demand_quantity"].sum().sort_values("record_date").tail(120)
    demand_over_time = [
        TimeSeriesPoint(d=r["record_date"], demand=float(r["demand_quantity"])) for _, r in daily.iterrows()
    ]

    hdf = df.copy()
    hdf["week_start"] = pd.to_datetime(hdf["record_date"]) - pd.to_timedelta(
        pd.to_datetime(hdf["record_date"]).dt.dayofweek, unit="d"
    )
    hdf["week_start"] = hdf["week_start"].dt.date
    heat = hdf.groupby(["region", "week_start"], as_index=False)["demand_quantity"].sum()
    if len(heat):
        mx = heat["demand_quantity"].max() or 1.0
        heat["intensity"] = heat["demand_quantity"] / mx
    else:
        heat["intensity"] = 0.0
    heatmap = [
        HeatmapCell(region=r["region"], week_start=r["week_start"], intensity=float(r["intensity"]))
        for _, r in heat.tail(240).iterrows()
    ]

    return AnalyticsResponse(
        summary=summary,
        demand_by_region=demand_by_region,
        demand_over_time=demand_over_time,
        heatmap=heatmap,
    )


@router.get("/decomposition")
def decomposition(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    region: str | None = Query(default=None),
) -> dict:
    df = _rows_to_df(db, region, None, None, None)
    if df.empty:
        return {"trend": [], "seasonal": [], "residual": [], "observed": []}

    daily = df.groupby("record_date", as_index=False)["demand_quantity"].sum().sort_values("record_date")
    y = daily["demand_quantity"].astype(float).values
    if len(y) < 21:
        return {"trend": [], "seasonal": [], "residual": [], "observed": [], "message": "Need more history for STL (21+ days)."}

    try:
        from statsmodels.tsa.seasonal import STL

        period = 7 if len(y) >= 14 else max(3, len(y) // 3)
        stl = STL(y, period=period, robust=True)
        res = stl.fit()
        dates = [str(d) for d in daily["record_date"].tolist()]
        n = len(dates)
        return {
            "period": period,
            "observed": [{"d": dates[i], "v": float(y[i])} for i in range(n)],
            "trend": [{"d": dates[i], "v": float(res.trend[i])} for i in range(n)],
            "seasonal": [{"d": dates[i], "v": float(res.seasonal[i])} for i in range(n)],
            "residual": [{"d": dates[i], "v": float(res.resid[i])} for i in range(n)],
        }
    except Exception as e:  # pragma: no cover
        return {"error": str(e), "trend": [], "seasonal": [], "residual": [], "observed": []}


@router.get("/forecast-vs-actual")
def forecast_vs_actual(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    region: str | None = Query(default=None),
    days: int = Query(default=30, ge=7, le=120),
) -> dict:
    """Naive baseline (lag-1) vs actual for network or filtered region — quick ML ops visualization."""
    df = _rows_to_df(db, region, None, None, None)
    if df.empty:
        return {"points": []}
    end = df["record_date"].max()
    start = end - timedelta(days=days)
    sub = df[df["record_date"] >= start]
    daily = sub.groupby("record_date", as_index=False)["demand_quantity"].sum().sort_values("record_date")
    actual = daily["demand_quantity"].astype(float).values
    dates = daily["record_date"].astype(str).tolist()
    naive = pd.Series(actual).shift(1)
    points = []
    for i in range(1, len(daily)):
        points.append(
            {
                "d": dates[i],
                "actual": float(actual[i]),
                "naive_forecast": float(naive.iloc[i]) if pd.notna(naive.iloc[i]) else None,
            }
        )
    return {"points": points, "note": "naive_forecast is same-network lag-1 day (baseline benchmark)."}


@router.get("/alerts")
def list_alerts(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[dict]:
    items = db.query(AnomalyAlert).order_by(AnomalyAlert.created_at.desc()).limit(100).all()
    return [
        {
            "id": a.id,
            "alert_date": a.alert_date,
            "region": a.region,
            "demand_quantity": a.demand_quantity,
            "expected_demand": a.expected_demand,
            "anomaly_score": a.anomaly_score,
            "severity": a.severity,
            "message": a.message,
            "acknowledged": a.acknowledged,
        }
        for a in items
    ]


@router.post("/alerts/{alert_id}/ack")
def ack_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    a = db.query(AnomalyAlert).filter(AnomalyAlert.id == alert_id).first()
    if not a:
        return {"ok": False}
    a.acknowledged = True
    db.commit()
    return {"ok": True}
