"""
ForecastFlow AI — Advanced Anomaly Detection
Multi-signal: Z-score residuals + IsolationForest + IQR fence.
Returns scored DataFrame with severity classification and explanations.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from app.ml.pipeline import FEATURE_COLUMNS, _add_features, _aggregate_daily, load_artifact


def score_recent(
    history_df: pd.DataFrame,
    model_path,
    contamination: float = 0.05,
    tail: int = 200,
) -> pd.DataFrame:
    artifact = load_artifact(model_path)
    xgb_model = artifact["xgb_model"]
    lgb_model = artifact["lgb_model"]
    region_encoder: dict[str, int] = artifact["region_encoder"]
    feature_columns: list[str] = artifact.get("feature_columns", FEATURE_COLUMNS)
    ensemble_weights: list[float] = artifact.get("ensemble_weights", [0.5, 0.5])

    daily = _aggregate_daily(history_df)
    feat_df = _add_features(daily, region_encoder)
    if feat_df.empty:
        return pd.DataFrame()

    X = feat_df[feature_columns].replace([np.inf, -np.inf], np.nan).fillna(0)

    xp = xgb_model.predict(X)
    lp = lgb_model.predict(X)
    expected = ensemble_weights[0] * xp + ensemble_weights[1] * lp

    residual = feat_df["demand_quantity"].values - expected
    z = (residual - np.mean(residual)) / (np.std(residual) + 1e-9)

    # IsolationForest on feature space
    iso = IsolationForest(contamination=contamination, random_state=42, n_estimators=100)
    iso.fit(X)
    iso_score = iso.decision_function(X)

    # IQR fence on demand values per region
    iqr_flags = np.zeros(len(feat_df), dtype=bool)
    for region in feat_df["region"].unique():
        mask = feat_df["region"] == region
        vals = feat_df.loc[mask, "demand_quantity"]
        q1, q3 = vals.quantile(0.25), vals.quantile(0.75)
        iqr = q3 - q1
        lower, upper = q1 - 2.5 * iqr, q3 + 2.5 * iqr
        iqr_flags[mask.values] = (vals < lower) | (vals > upper)

    out = feat_df.assign(
        expected_demand=expected,
        residual=residual,
        z_score=z,
        iso_score=iso_score,
        iqr_anomaly=iqr_flags,
    )
    return out.sort_values("record_date").tail(tail)


def classify_severity(z_score: float, iso_score: float, iqr_anomaly: bool) -> str:
    """Return 'high', 'medium', or 'normal'."""
    abs_z = abs(z_score)
    if abs_z >= 3.5 or iso_score <= -0.30 or (abs_z >= 2.5 and iqr_anomaly):
        return "high"
    if abs_z >= 2.0 or iso_score <= -0.15 or iqr_anomaly:
        return "medium"
    return "normal"


def build_anomaly_message(
    region: str,
    record_date,
    actual: float,
    expected: float,
    z_score: float,
    severity: str,
) -> str:
    direction = "spike" if actual > expected else "drop"
    pct = abs((actual - expected) / (expected + 1e-9)) * 100
    severity_label = "Critical" if severity == "high" else "Warning"
    return (
        f"{severity_label}: Demand {direction} in {region} on {record_date}. "
        f"Actual {actual:.0f} vs expected {expected:.0f} "
        f"({pct:.1f}% deviation, z={z_score:.2f})."
    )
