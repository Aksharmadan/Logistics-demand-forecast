"""
ForecastFlow AI — Intelligent Copilot Engine
Rule-based + statistical AI assistant that answers operational questions
using real data from the database. No external LLM required.
"""

from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Any

import numpy as np
import pandas as pd


class ForecastCopilot:
    """
    Context-aware AI assistant for logistics operations.
    Analyzes real demand data, anomalies, and forecasts to generate
    intelligent, actionable responses.
    """

    def __init__(
        self,
        demand_df: pd.DataFrame,
        alerts: list[dict],
        model_metrics: dict | None = None,
        forecast_df: pd.DataFrame | None = None,
    ):
        self.demand_df = demand_df.copy() if not demand_df.empty else pd.DataFrame()
        self.alerts = alerts
        self.model_metrics = model_metrics or {}
        self.forecast_df = forecast_df.copy() if forecast_df is not None and not forecast_df.empty else pd.DataFrame()
        self._precompute()

    def _precompute(self) -> None:
        if self.demand_df.empty:
            self.regions: list[str] = []
            self.region_stats: dict[str, dict] = {}
            self.network_stats: dict[str, float] = {}
            return

        df = self.demand_df.copy()
        df["record_date"] = pd.to_datetime(df["record_date"])
        today = pd.Timestamp.today().normalize()

        self.regions = sorted(df["region"].unique().tolist())

        # Per-region stats
        self.region_stats = {}
        for r in self.regions:
            sub = df[df["region"] == r].sort_values("record_date")
            last_7 = sub[sub["record_date"] >= today - timedelta(days=7)]["demand_quantity"]
            prev_7 = sub[
                (sub["record_date"] >= today - timedelta(days=14))
                & (sub["record_date"] < today - timedelta(days=7))
            ]["demand_quantity"]
            last_30 = sub[sub["record_date"] >= today - timedelta(days=30)]["demand_quantity"]

            self.region_stats[r] = {
                "total_30d": float(last_30.sum()),
                "avg_7d": float(last_7.mean()) if len(last_7) else 0.0,
                "avg_prev_7d": float(prev_7.mean()) if len(prev_7) else 0.0,
                "growth_7d": (
                    ((last_7.mean() - prev_7.mean()) / (prev_7.mean() + 1e-9)) * 100
                    if len(last_7) and len(prev_7)
                    else 0.0
                ),
                "std": float(sub["demand_quantity"].std()) if len(sub) > 1 else 0.0,
                "max": float(sub["demand_quantity"].max()) if len(sub) else 0.0,
                "min": float(sub["demand_quantity"].min()) if len(sub) else 0.0,
                "n_records": len(sub),
            }

        # Network-wide stats
        last_30 = df[df["record_date"] >= today - timedelta(days=30)]
        prev_30 = df[
            (df["record_date"] >= today - timedelta(days=60))
            & (df["record_date"] < today - timedelta(days=30))
        ]
        self.network_stats = {
            "total_30d": float(last_30["demand_quantity"].sum()),
            "avg_daily_30d": float(last_30.groupby("record_date")["demand_quantity"].sum().mean()),
            "growth_30d": (
                ((last_30["demand_quantity"].sum() - prev_30["demand_quantity"].sum())
                 / (prev_30["demand_quantity"].sum() + 1e-9)) * 100
                if len(prev_30)
                else 0.0
            ),
            "total_records": len(df),
            "active_regions": len(self.regions),
        }

    def answer(self, question: str) -> dict[str, Any]:
        q = question.lower().strip()

        # Route to specialized handlers
        if any(w in q for w in ["overload", "overloaded", "capacity", "overwhelm"]):
            return self._handle_overload(q)
        if any(w in q for w in ["anomal", "spike", "unusual", "alert", "warning"]):
            return self._handle_anomalies(q)
        if any(w in q for w in ["forecast", "predict", "future", "next week", "tomorrow"]):
            return self._handle_forecast(q)
        if any(w in q for w in ["truck", "fleet", "vehicle", "allocat", "move", "dispatch"]):
            return self._handle_fleet(q)
        if any(w in q for w in ["region", "hub", "zone", "area", "location"]):
            return self._handle_regions(q)
        if any(w in q for w in ["trend", "growth", "decline", "momentum", "direction"]):
            return self._handle_trends(q)
        if any(w in q for w in ["model", "accuracy", "rmse", "mae", "performance", "train"]):
            return self._handle_model(q)
        if any(w in q for w in ["summary", "overview", "status", "health", "report"]):
            return self._handle_summary(q)
        if any(w in q for w in ["recommend", "suggest", "action", "should", "optimize"]):
            return self._handle_recommendations(q)
        if any(w in q for w in ["risk", "danger", "concern", "problem", "issue"]):
            return self._handle_risks(q)

        return self._handle_general(q)

    def _handle_overload(self, q: str) -> dict[str, Any]:
        # Find regions with highest recent growth
        at_risk = [
            (r, stats["growth_7d"], stats["avg_7d"])
            for r, stats in self.region_stats.items()
            if stats["growth_7d"] > 15
        ]
        at_risk.sort(key=lambda x: x[1], reverse=True)

        open_alerts = [a for a in self.alerts if not a.get("acknowledged")]
        high_alerts = [a for a in open_alerts if a.get("severity") == "high"]

        if at_risk:
            top = at_risk[0]
            answer = (
                f"Capacity risk detected in {len(at_risk)} region(s). "
                f"{top[0]} is the highest-risk zone with {top[1]:.1f}% demand growth this week "
                f"(avg {top[2]:.0f} units/day). "
            )
            if high_alerts:
                answer += f"There are {len(high_alerts)} critical anomaly alerts requiring immediate attention. "
            answer += "Recommend pre-positioning additional resources before peak hours."
        else:
            answer = (
                "No immediate overload risk detected across the network. "
                f"All {len(self.regions)} regions are operating within normal demand ranges. "
            )
            if open_alerts:
                answer += f"Note: {len(open_alerts)} unacknowledged alerts remain open."

        recs = []
        for r, growth, avg in at_risk[:3]:
            trucks_needed = max(1, int(avg * growth / 100 / 50))
            recs.append(f"Pre-position {trucks_needed} additional vehicle(s) to {r} — demand up {growth:.0f}%")

        return {
            "answer": answer,
            "confidence": 0.88 if at_risk else 0.92,
            "sources": ["demand_records", "anomaly_alerts"],
            "recommendations": recs or ["Continue monitoring — no immediate action required"],
            "data_points": {
                "at_risk_regions": len(at_risk),
                "high_alerts": len(high_alerts),
                "regions_analyzed": len(self.regions),
            },
        }

    def _handle_anomalies(self, q: str) -> dict[str, Any]:
        open_alerts = [a for a in self.alerts if not a.get("acknowledged")]
        high = [a for a in open_alerts if a.get("severity") == "high"]
        medium = [a for a in open_alerts if a.get("severity") == "medium"]

        if not open_alerts:
            answer = "No active anomalies detected. The network is operating within expected demand parameters."
            recs = ["Continue scheduled monitoring", "Run anomaly detection after next data upload"]
        else:
            regions_affected = list({a["region"] for a in open_alerts})
            answer = (
                f"{len(open_alerts)} active anomal{'y' if len(open_alerts) == 1 else 'ies'} detected: "
                f"{len(high)} critical, {len(medium)} warnings. "
                f"Affected regions: {', '.join(regions_affected[:5])}. "
            )
            if high:
                top = high[0]
                answer += (
                    f"Most critical: {top['region']} on {top.get('alert_date', 'recent date')} — "
                    f"{top.get('message', 'unusual demand pattern')}."
                )
            recs = [
                f"Investigate {a['region']}: {a.get('message', 'anomaly detected')}"
                for a in high[:3]
            ]
            if medium:
                recs.append(f"Monitor {len(medium)} medium-severity regions for escalation")

        return {
            "answer": answer,
            "confidence": 0.91,
            "sources": ["anomaly_alerts"],
            "recommendations": recs,
            "data_points": {
                "total_open": len(open_alerts),
                "critical": len(high),
                "warnings": len(medium),
            },
        }

    def _handle_forecast(self, q: str) -> dict[str, Any]:
        if self.forecast_df.empty:
            answer = (
                "No active forecast available. Generate a forecast from the Forecasting Lab "
                "to get AI-powered demand projections with confidence intervals."
            )
            return {
                "answer": answer,
                "confidence": 0.7,
                "sources": [],
                "recommendations": ["Run a 14-day forecast from the Predictions page"],
                "data_points": {},
            }

        total_forecast = float(self.forecast_df["predicted_demand"].sum())
        avg_daily = float(self.forecast_df.groupby("forecast_date")["predicted_demand"].sum().mean())
        horizon = self.forecast_df["forecast_date"].nunique()
        top_region = (
            self.forecast_df.groupby("region")["predicted_demand"]
            .sum()
            .idxmax()
        )

        answer = (
            f"The {horizon}-day forecast projects {total_forecast:,.0f} total demand units "
            f"({avg_daily:,.0f}/day average). "
            f"{top_region} is forecast as the highest-demand region. "
        )

        # Check for forecast growth vs recent actuals
        if not self.demand_df.empty:
            recent_avg = self.network_stats.get("avg_daily_30d", 0)
            if recent_avg > 0:
                growth = ((avg_daily - recent_avg) / recent_avg) * 100
                direction = "increase" if growth > 0 else "decrease"
                answer += f"Forecast shows a {abs(growth):.1f}% {direction} vs recent 30-day average."

        return {
            "answer": answer,
            "confidence": 0.85,
            "sources": ["forecast_model", "demand_records"],
            "recommendations": [
                f"Ensure {top_region} has adequate capacity for forecasted demand",
                "Review confidence intervals for high-uncertainty periods",
                "Schedule retraining if forecast error exceeds 15%",
            ],
            "data_points": {
                "total_forecast": total_forecast,
                "avg_daily": avg_daily,
                "horizon_days": horizon,
                "top_region": top_region,
            },
        }

    def _handle_fleet(self, q: str) -> dict[str, Any]:
        # Identify regions needing resources based on demand growth
        high_growth = [
            (r, stats["growth_7d"], stats["avg_7d"])
            for r, stats in self.region_stats.items()
            if stats["growth_7d"] > 10
        ]
        high_growth.sort(key=lambda x: x[1], reverse=True)

        low_demand = [
            (r, stats["avg_7d"])
            for r, stats in self.region_stats.items()
            if stats["growth_7d"] < -10
        ]

        if high_growth and low_demand:
            answer = (
                f"Fleet reallocation recommended. {len(high_growth)} region(s) show rising demand "
                f"while {len(low_demand)} show declining volume. "
                f"Priority: move capacity from {low_demand[0][0]} to {high_growth[0][0]}."
            )
            recs = []
            for r, growth, avg in high_growth[:3]:
                trucks = max(1, int(avg / 100))
                recs.append(f"Deploy {trucks} vehicle(s) to {r} — demand trending +{growth:.0f}%")
            for r, avg in low_demand[:2]:
                recs.append(f"Reduce allocation in {r} — demand down, redeploy assets")
        elif high_growth:
            answer = (
                f"Demand is rising in {len(high_growth)} region(s). "
                f"Consider increasing fleet capacity in: {', '.join(r for r, _, _ in high_growth[:3])}."
            )
            recs = [f"Add capacity to {r} (+{g:.0f}% demand growth)" for r, g, _ in high_growth[:3]]
        else:
            answer = "Fleet allocation appears balanced. No significant demand imbalances detected across regions."
            recs = ["Maintain current fleet distribution", "Monitor for weekend demand shifts"]

        return {
            "answer": answer,
            "confidence": 0.82,
            "sources": ["demand_records"],
            "recommendations": recs,
            "data_points": {
                "high_demand_regions": len(high_growth),
                "low_demand_regions": len(low_demand),
            },
        }

    def _handle_regions(self, q: str) -> dict[str, Any]:
        # Check if asking about a specific region
        mentioned = [r for r in self.regions if r.lower() in q]

        if mentioned:
            r = mentioned[0]
            stats = self.region_stats.get(r, {})
            growth = stats.get("growth_7d", 0)
            avg = stats.get("avg_7d", 0)
            total = stats.get("total_30d", 0)
            direction = "up" if growth > 0 else "down"
            answer = (
                f"{r}: 30-day volume {total:,.0f} units, "
                f"7-day average {avg:.0f} units/day ({direction} {abs(growth):.1f}% vs prior week). "
            )
            region_alerts = [a for a in self.alerts if a.get("region") == r and not a.get("acknowledged")]
            if region_alerts:
                answer += f"{len(region_alerts)} open alert(s) require attention."
            else:
                answer += "No active alerts — operating normally."
            recs = []
            if growth > 20:
                recs.append(f"Pre-position additional inventory in {r} — strong growth signal")
            elif growth < -20:
                recs.append(f"Review {r} for demand drivers — significant volume decline")
        else:
            # General region overview
            sorted_regions = sorted(
                self.region_stats.items(),
                key=lambda x: x[1]["total_30d"],
                reverse=True,
            )
            top3 = sorted_regions[:3]
            answer = (
                f"Network spans {len(self.regions)} active regions. "
                f"Top performers (30d): "
                + ", ".join(f"{r} ({s['total_30d']:,.0f} units)" for r, s in top3)
                + "."
            )
            recs = [
                f"Focus capacity planning on {top3[0][0]} — highest volume region" if top3 else "No data",
            ]

        return {
            "answer": answer,
            "confidence": 0.90,
            "sources": ["demand_records"],
            "recommendations": recs or ["Monitor all regions for demand shifts"],
            "data_points": {r: self.region_stats.get(r, {}) for r in (mentioned or [])},
        }

    def _handle_trends(self, q: str) -> dict[str, Any]:
        growth = self.network_stats.get("growth_30d", 0)
        direction = "growing" if growth > 0 else "declining"
        magnitude = "strongly" if abs(growth) > 15 else "moderately" if abs(growth) > 5 else "slightly"

        rising = [(r, s["growth_7d"]) for r, s in self.region_stats.items() if s["growth_7d"] > 10]
        falling = [(r, s["growth_7d"]) for r, s in self.region_stats.items() if s["growth_7d"] < -10]
        rising.sort(key=lambda x: x[1], reverse=True)
        falling.sort(key=lambda x: x[1])

        answer = (
            f"Network demand is {magnitude} {direction} ({growth:+.1f}% vs prior 30 days). "
        )
        if rising:
            answer += f"Rising regions: {', '.join(r for r, _ in rising[:3])}. "
        if falling:
            answer += f"Declining regions: {', '.join(r for r, _ in falling[:3])}."

        recs = []
        if growth > 10:
            recs.append("Scale up warehouse capacity — network-wide demand acceleration")
        if rising:
            recs.append(f"Prioritize inventory replenishment in {rising[0][0]}")
        if falling:
            recs.append(f"Investigate demand drivers in {falling[0][0]} — potential churn risk")

        return {
            "answer": answer,
            "confidence": 0.87,
            "sources": ["demand_records"],
            "recommendations": recs or ["Demand is stable — maintain current operations"],
            "data_points": {
                "network_growth_30d": growth,
                "rising_regions": len(rising),
                "falling_regions": len(falling),
            },
        }

    def _handle_model(self, q: str) -> dict[str, Any]:
        if not self.model_metrics:
            answer = "No trained model found. Upload demand data and train the ensemble model to unlock AI forecasting."
            return {
                "answer": answer,
                "confidence": 1.0,
                "sources": [],
                "recommendations": ["Upload CSV data", "Train the XGBoost + LightGBM ensemble"],
                "data_points": {},
            }

        rmse = self.model_metrics.get("rmse", 0)
        mae = self.model_metrics.get("mae", 0)
        mape = self.model_metrics.get("mape", 0)
        n = self.model_metrics.get("n_samples", 0)
        xgb_rmse = self.model_metrics.get("xgb_rmse", rmse)
        lgb_rmse = self.model_metrics.get("lgb_rmse", rmse)

        quality = "excellent" if mape < 5 else "good" if mape < 10 else "acceptable" if mape < 20 else "needs improvement"
        better = "XGBoost" if xgb_rmse < lgb_rmse else "LightGBM"

        answer = (
            f"Ensemble model performance is {quality}. "
            f"RMSE: {rmse:.2f}, MAE: {mae:.2f}, MAPE: {mape:.1f}%. "
            f"Trained on {n:,} samples. "
            f"{better} is the stronger individual model in this ensemble."
        )

        recs = []
        if mape > 15:
            recs.append("Consider retraining with more recent data — MAPE above 15%")
        if n < 200:
            recs.append("Collect more historical data to improve model accuracy")
        recs.append("Run hyperparameter optimization to potentially reduce RMSE further")

        return {
            "answer": answer,
            "confidence": 0.95,
            "sources": ["model_registry"],
            "recommendations": recs,
            "data_points": self.model_metrics,
        }

    def _handle_summary(self, q: str) -> dict[str, Any]:
        total = self.network_stats.get("total_30d", 0)
        avg = self.network_stats.get("avg_daily_30d", 0)
        growth = self.network_stats.get("growth_30d", 0)
        open_alerts = len([a for a in self.alerts if not a.get("acknowledged")])
        high_alerts = len([a for a in self.alerts if not a.get("acknowledged") and a.get("severity") == "high"])

        status = "CRITICAL" if high_alerts > 3 else "WARNING" if open_alerts > 5 else "NOMINAL"

        answer = (
            f"System Status: {status}. "
            f"Network processed {total:,.0f} demand units in the last 30 days "
            f"({avg:,.0f}/day avg, {growth:+.1f}% vs prior period). "
            f"{len(self.regions)} active regions. "
            f"{open_alerts} open alerts ({high_alerts} critical). "
        )

        if self.model_metrics:
            mape = self.model_metrics.get("mape", 0)
            answer += f"Forecast model MAPE: {mape:.1f}%."

        recs = []
        if high_alerts > 0:
            recs.append(f"Acknowledge {high_alerts} critical alert(s) immediately")
        if growth > 15:
            recs.append("Scale operations — demand acceleration detected")
        elif growth < -15:
            recs.append("Investigate demand decline — review regional performance")
        recs.append("Review weekly forecast accuracy and retrain if needed")

        return {
            "answer": answer,
            "confidence": 0.93,
            "sources": ["demand_records", "anomaly_alerts", "model_registry"],
            "recommendations": recs,
            "data_points": {
                "system_status": status,
                **self.network_stats,
                "open_alerts": open_alerts,
            },
        }

    def _handle_recommendations(self, q: str) -> dict[str, Any]:
        recs = []
        data_points: dict[str, Any] = {}

        # High-growth regions
        high_growth = [(r, s["growth_7d"]) for r, s in self.region_stats.items() if s["growth_7d"] > 15]
        if high_growth:
            high_growth.sort(key=lambda x: x[1], reverse=True)
            recs.append(f"Increase capacity in {high_growth[0][0]} — demand up {high_growth[0][1]:.0f}% this week")
            data_points["high_growth_regions"] = len(high_growth)

        # Open critical alerts
        critical = [a for a in self.alerts if not a.get("acknowledged") and a.get("severity") == "high"]
        if critical:
            recs.append(f"Resolve {len(critical)} critical anomaly alert(s) — potential SLA risk")

        # Model quality
        if self.model_metrics:
            mape = self.model_metrics.get("mape", 0)
            n = self.model_metrics.get("n_samples", 0)
            if mape > 12:
                recs.append("Retrain forecast model — MAPE above acceptable threshold")
            if n < 300:
                recs.append("Ingest more historical data to improve forecast accuracy")

        # Declining regions
        declining = [(r, s["growth_7d"]) for r, s in self.region_stats.items() if s["growth_7d"] < -20]
        if declining:
            recs.append(f"Investigate demand drop in {declining[0][0]} — {declining[0][1]:.0f}% decline")

        if not recs:
            recs = [
                "System is operating optimally",
                "Schedule next model retraining in 7 days",
                "Review weekly demand patterns for seasonal adjustments",
            ]

        answer = f"AI has generated {len(recs)} operational recommendation(s) based on current data analysis."

        return {
            "answer": answer,
            "confidence": 0.86,
            "sources": ["demand_records", "anomaly_alerts", "model_registry"],
            "recommendations": recs,
            "data_points": data_points,
        }

    def _handle_risks(self, q: str) -> dict[str, Any]:
        risks = []

        critical_alerts = [a for a in self.alerts if not a.get("acknowledged") and a.get("severity") == "high"]
        if critical_alerts:
            risks.append(f"CRITICAL: {len(critical_alerts)} unresolved high-severity anomalies")

        high_growth = [(r, s["growth_7d"]) for r, s in self.region_stats.items() if s["growth_7d"] > 25]
        if high_growth:
            risks.append(f"CAPACITY RISK: {', '.join(r for r, _ in high_growth)} showing >25% demand surge")

        if self.model_metrics:
            mape = self.model_metrics.get("mape", 0)
            if mape > 20:
                risks.append(f"FORECAST RISK: Model MAPE at {mape:.1f}% — predictions may be unreliable")

        if not risks:
            answer = "No significant operational risks detected. System health is nominal."
            recs = ["Continue standard monitoring protocols"]
        else:
            answer = f"{len(risks)} risk factor(s) identified: " + "; ".join(risks[:2]) + "."
            recs = [
                "Escalate critical alerts to operations team",
                "Pre-position buffer inventory in high-growth regions",
                "Increase monitoring frequency for at-risk zones",
            ]

        return {
            "answer": answer,
            "confidence": 0.89,
            "sources": ["anomaly_alerts", "demand_records"],
            "recommendations": recs,
            "data_points": {"risk_count": len(risks)},
        }

    def _handle_general(self, q: str) -> dict[str, Any]:
        total = self.network_stats.get("total_30d", 0)
        regions = len(self.regions)
        open_alerts = len([a for a in self.alerts if not a.get("acknowledged")])

        answer = (
            f"ForecastFlow AI is monitoring {regions} region(s) with {total:,.0f} demand units "
            f"processed in the last 30 days. "
            f"There are {open_alerts} open alert(s). "
            "Ask me about forecasts, anomalies, fleet allocation, regional performance, "
            "model accuracy, or operational recommendations."
        )

        return {
            "answer": answer,
            "confidence": 0.75,
            "sources": ["demand_records"],
            "recommendations": [
                "Try: 'What regions are overloaded?'",
                "Try: 'Summarize current operations'",
                "Try: 'What are the top risks right now?'",
            ],
            "data_points": {"total_demand_30d": total, "active_regions": regions},
        }
