from datetime import date, timedelta

import pandas as pd
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import AnomalyAlert, AuditLog, DemandRecord, User
from app.schemas import (
    AnalyticsResponse,
    AnalyticsSummary,
    HeatmapCell,
    OperationalInsight,
    RegionDemandBar,
    TimeSeriesPoint,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("", response_model=AnalyticsResponse)
def analytics(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> AnalyticsResponse:
    end = date.today()
    start_30 = end - timedelta(days=30)
    start_60 = end - timedelta(days=60)

    rows = db.query(DemandRecord).all()
    if not rows:
        empty = AnalyticsSummary(
            total_demand_last_30d=0,
            avg_daily_demand=0,
            growth_pct_vs_prior_30d=0,
            active_regions=0,
            open_alerts=0,
            total_records=0,
            peak_region="—",
            peak_demand=0,
        )
        return AnalyticsResponse(
            summary=empty,
            demand_by_region=[],
            demand_over_time=[],
            heatmap=[],
        )

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

    d30 = df[df["record_date"] >= start_30]
    prev = df[(df["record_date"] >= start_60) & (df["record_date"] < start_30)]

    total_30 = float(d30["demand_quantity"].sum())
    total_prev = float(prev["demand_quantity"].sum())
    growth = ((total_30 - total_prev) / total_prev * 100) if total_prev > 0 else 0.0

    daily_30 = d30.groupby("record_date")["demand_quantity"].sum()
    avg_daily = float(daily_30.mean()) if len(daily_30) else 0.0

    regions_cnt = int(d30["region"].nunique()) if len(d30) else int(df["region"].nunique())
    open_alerts = db.query(AnomalyAlert).filter(AnomalyAlert.acknowledged.is_(False)).count()

    # Peak region
    by_region_30 = d30.groupby("region")["demand_quantity"].sum() if len(d30) else df.groupby("region")["demand_quantity"].sum()
    peak_region = str(by_region_30.idxmax()) if len(by_region_30) else "—"
    peak_demand = float(by_region_30.max()) if len(by_region_30) else 0.0

    summary = AnalyticsSummary(
        total_demand_last_30d=total_30,
        avg_daily_demand=avg_daily,
        growth_pct_vs_prior_30d=growth,
        active_regions=regions_cnt,
        open_alerts=open_alerts,
        total_records=len(rows),
        peak_region=peak_region,
        peak_demand=peak_demand,
    )

    # Demand by region with % of total
    by_region = (
        d30.groupby("region", as_index=False)["demand_quantity"]
        .sum()
        .sort_values("demand_quantity", ascending=False)
        .head(20)
    )
    total_all = float(by_region["demand_quantity"].sum()) or 1.0
    demand_by_region = [
        RegionDemandBar(
            region=r["region"],
            total_demand=float(r["demand_quantity"]),
            pct_of_total=round(float(r["demand_quantity"]) / total_all * 100, 1),
        )
        for _, r in by_region.iterrows()
    ]

    # Time series with rolling average
    daily = df.groupby("record_date", as_index=False)["demand_quantity"].sum().sort_values("record_date").tail(90)
    daily["rolling_avg"] = daily["demand_quantity"].rolling(7, min_periods=1).mean()
    demand_over_time = [
        TimeSeriesPoint(
            d=r["record_date"],
            demand=float(r["demand_quantity"]),
            rolling_avg=float(r["rolling_avg"]),
        )
        for _, r in daily.iterrows()
    ]

    # Heatmap
    df["week_start"] = pd.to_datetime(df["record_date"]) - pd.to_timedelta(
        pd.to_datetime(df["record_date"]).dt.dayofweek, unit="d"
    )
    df["week_start"] = df["week_start"].dt.date
    heat = df.groupby(["region", "week_start"], as_index=False)["demand_quantity"].sum()
    if len(heat):
        mx = heat["demand_quantity"].max() or 1.0
        heat["intensity"] = heat["demand_quantity"] / mx
    else:
        heat["intensity"] = 0.0
    heatmap = [
        HeatmapCell(
            region=r["region"],
            week_start=r["week_start"],
            intensity=float(r["intensity"]),
            raw_demand=float(r["demand_quantity"]),
        )
        for _, r in heat.tail(200).iterrows()
    ]

    return AnalyticsResponse(
        summary=summary,
        demand_by_region=demand_by_region,
        demand_over_time=demand_over_time,
        heatmap=heatmap,
    )


@router.get("/alerts")
def list_alerts(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[dict]:
    items = db.query(AnomalyAlert).order_by(AnomalyAlert.created_at.desc()).limit(100).all()
    return [
        {
            "id": a.id,
            "alert_date": str(a.alert_date),
            "region": a.region,
            "demand_quantity": a.demand_quantity,
            "expected_demand": a.expected_demand,
            "anomaly_score": a.anomaly_score,
            "severity": a.severity,
            "message": a.message,
            "acknowledged": a.acknowledged,
            "acknowledged_by": a.acknowledged_by,
            "created_at": a.created_at.isoformat(),
        }
        for a in items
    ]


@router.post("/alerts/{alert_id}/ack")
def ack_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    a = db.query(AnomalyAlert).filter(AnomalyAlert.id == alert_id).first()
    if not a:
        return {"ok": False}
    a.acknowledged = True
    a.acknowledged_by = current_user.email
    db.commit()
    return {"ok": True}


@router.get("/insights", response_model=list[OperationalInsight])
def get_insights(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[OperationalInsight]:
    end = date.today()
    start_14 = end - timedelta(days=14)
    rows = db.query(DemandRecord).filter(DemandRecord.record_date >= start_14).all()

    if not rows:
        return [
            OperationalInsight(
                type="info",
                title="Insufficient Data",
                body="Upload demand data to generate operational insights.",
                action="Upload CSV data",
            )
        ]

    df = pd.DataFrame(
        [{"record_date": r.record_date, "region": r.region, "demand": r.demand_quantity} for r in rows]
    )

    insights: list[OperationalInsight] = []

    # Network-wide trend
    last_7 = df[df["record_date"] >= (end - timedelta(days=7))]["demand"].sum()
    prev_7 = df[(df["record_date"] < (end - timedelta(days=7))) & (df["record_date"] >= start_14)]["demand"].sum()

    if prev_7 > 0:
        pct = ((last_7 - prev_7) / prev_7) * 100
        if pct > 10:
            insights.append(
                OperationalInsight(
                    type="warning" if pct > 20 else "info",
                    title="Network Demand Surge",
                    body=f"Network-wide demand increased {pct:.1f}% this week vs last week.",
                    metric=pct,
                    action="Review capacity allocation across all regions",
                )
            )
        elif pct < -10:
            insights.append(
                OperationalInsight(
                    type="warning",
                    title="Network Demand Decline",
                    body=f"Network-wide demand decreased {abs(pct):.1f}% this week.",
                    metric=pct,
                    action="Investigate demand drivers and adjust forecasts",
                )
            )

    # Per-region insights
    for region, data in df.groupby("region"):
        r_last = data[data["record_date"] >= (end - timedelta(days=7))]["demand"].sum()
        r_prev = data[data["record_date"] < (end - timedelta(days=7))]["demand"].sum()
        if r_prev > 0:
            r_pct = ((r_last - r_prev) / r_prev) * 100
            if r_pct > 30:
                insights.append(
                    OperationalInsight(
                        type="critical",
                        title=f"Critical Spike: {region}",
                        body=f"{region} demand surged {r_pct:.0f}% — immediate capacity review required.",
                        region=str(region),
                        metric=r_pct,
                        action=f"Pre-position additional inventory in {region}",
                    )
                )
            elif r_pct > 15:
                insights.append(
                    OperationalInsight(
                        type="warning",
                        title=f"Rising Demand: {region}",
                        body=f"{region} is up {r_pct:.0f}% — consider allocating more resources.",
                        region=str(region),
                        metric=r_pct,
                        action=f"Increase allocation to {region}",
                    )
                )
            elif r_pct < -25:
                insights.append(
                    OperationalInsight(
                        type="info",
                        title=f"Low Volume: {region}",
                        body=f"{region} volume down {abs(r_pct):.0f}% — potential redeployment opportunity.",
                        region=str(region),
                        metric=r_pct,
                        action=f"Redeploy assets from {region} to higher-demand zones",
                    )
                )

    # Open alerts insight
    open_alerts = db.query(AnomalyAlert).filter(AnomalyAlert.acknowledged.is_(False)).count()
    if open_alerts > 0:
        high_alerts = (
            db.query(AnomalyAlert)
            .filter(AnomalyAlert.acknowledged.is_(False), AnomalyAlert.severity == "high")
            .count()
        )
        insights.append(
            OperationalInsight(
                type="critical" if high_alerts > 0 else "warning",
                title=f"{open_alerts} Unresolved Alert{'s' if open_alerts > 1 else ''}",
                body=f"{open_alerts} anomaly alert(s) pending review ({high_alerts} critical).",
                metric=float(open_alerts),
                action="Review and acknowledge alerts in the Analytics panel",
            )
        )

    if not insights:
        insights.append(
            OperationalInsight(
                type="info",
                title="Operations Stable",
                body="All regions operating within normal demand parameters.",
                action="Continue standard monitoring",
            )
        )

    return insights[:10]


@router.get("/regional-breakdown")
def regional_breakdown(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[dict]:
    """Detailed per-region stats for the last 30 days."""
    end = date.today()
    start_30 = end - timedelta(days=30)
    start_60 = end - timedelta(days=60)

    rows = db.query(DemandRecord).all()
    if not rows:
        return []

    df = pd.DataFrame(
        [{"record_date": r.record_date, "region": r.region, "demand": r.demand_quantity} for r in rows]
    )

    result = []
    for region in sorted(df["region"].unique()):
        sub = df[df["region"] == region]
        d30 = sub[sub["record_date"] >= start_30]["demand"]
        prev = sub[(sub["record_date"] >= start_60) & (sub["record_date"] < start_30)]["demand"]

        total = float(d30.sum())
        avg = float(d30.mean()) if len(d30) else 0.0
        growth = ((d30.sum() - prev.sum()) / (prev.sum() + 1e-9) * 100) if len(prev) else 0.0

        open_alerts = (
            db.query(AnomalyAlert)
            .filter(AnomalyAlert.region == region, AnomalyAlert.acknowledged.is_(False))
            .count()
        )

        result.append(
            {
                "region": region,
                "total_30d": round(total, 1),
                "avg_daily": round(avg, 1),
                "growth_pct": round(growth, 1),
                "open_alerts": open_alerts,
                "status": (
                    "critical" if open_alerts > 2 or abs(growth) > 30
                    else "warning" if open_alerts > 0 or abs(growth) > 15
                    else "normal"
                ),
            }
        )

    return sorted(result, key=lambda x: x["total_30d"], reverse=True)
