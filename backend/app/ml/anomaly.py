"""Residual-based anomaly detection: large deviation from model expectation."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from app.ml.ensemble import load_ensemble_or_legacy
from app.ml.pipeline import _add_features, _aggregate_daily


def score_recent(
    history_df: pd.DataFrame,
    model_path,
    contamination: float = 0.05,
) -> pd.DataFrame:
    p = Path(model_path) if not isinstance(model_path, Path) else model_path
    artifact = load_ensemble_or_legacy(p)
    model = artifact["model"]
    region_encoder: dict[str, int] = artifact["region_encoder"]
    feature_columns: list[str] = artifact["feature_columns"]

    daily = _aggregate_daily(history_df)
    feat_df = _add_features(daily, region_encoder)
    X = feat_df[feature_columns].replace([np.inf, -np.inf], np.nan).fillna(0)
    expected = model.predict(X)
    residual = feat_df["demand_quantity"].values - expected
    z = (residual - np.mean(residual)) / (np.std(residual) + 1e-9)

    iso = IsolationForest(contamination=contamination, random_state=42)
    iso.fit(X)
    iso_score = iso.decision_function(X)

    out = feat_df.assign(
        expected_demand=expected,
        residual=residual,
        z_score=z,
        iso_score=iso_score,
    )
    return out.sort_values("record_date").tail(200)
