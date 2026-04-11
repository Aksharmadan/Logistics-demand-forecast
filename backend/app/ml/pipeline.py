"""
Demand forecasting pipeline using gradient-boosted trees on engineered time-series features.

Why not Prophet/LSTM in the default path:
- HistGradientBoosting handles multiple regions in one model with strong accuracy on tabular features.
- Fewer native/C++ deps; deploys cleanly on Linux containers.
- Prophet/LSTM remain drop-in alternatives: same feature table can feed an LSTM window or Prophet per region.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error

try:
    from sklearn.metrics import root_mean_squared_error as _rmse
except ImportError:  # pragma: no cover
    from sklearn.metrics import mean_squared_error

    def _rmse(y_true, y_pred):
        return float(mean_squared_error(y_true, y_pred) ** 0.5)
from sklearn.model_selection import train_test_split

REQUIRED_COLS = {"record_date", "region", "demand_quantity"}


@dataclass
class TrainResult:
    model: Any
    region_encoder: dict[str, int]
    rmse: float
    mae: float
    n_samples: int
    feature_columns: list[str]


def _aggregate_daily(df: pd.DataFrame) -> pd.DataFrame:
    g = (
        df.groupby(["record_date", "region"], as_index=False)["demand_quantity"]
        .sum()
        .sort_values(["region", "record_date"])
    )
    return g


def _add_features(df: pd.DataFrame, region_encoder: dict[str, int]) -> pd.DataFrame:
    out = df.copy()
    out["region_code"] = out["region"].map(region_encoder).astype(int)
    out["dow"] = pd.to_datetime(out["record_date"]).dt.dayofweek
    out["month"] = pd.to_datetime(out["record_date"]).dt.month
    out["lag_1"] = out.groupby("region")["demand_quantity"].shift(1)
    out["lag_7"] = out.groupby("region")["demand_quantity"].shift(7)
    out["roll_mean_7"] = (
        out.groupby("region")["demand_quantity"].transform(lambda s: s.shift(1).rolling(7, min_periods=1).mean())
    )
    out["roll_std_7"] = (
        out.groupby("region")["demand_quantity"].transform(lambda s: s.shift(1).rolling(7, min_periods=1).std())
    )
    return out.dropna()


def train_from_frame(df: pd.DataFrame, test_size: float = 0.2, random_state: int = 42) -> TrainResult:
    for c in REQUIRED_COLS:
        if c not in df.columns:
            raise ValueError(f"Missing column: {c}")

    daily = _aggregate_daily(df)
    regions = sorted(daily["region"].unique())
    region_encoder = {r: i for i, r in enumerate(regions)}
    feat_df = _add_features(daily, region_encoder)
    feature_columns = ["region_code", "dow", "month", "lag_1", "lag_7", "roll_mean_7", "roll_std_7"]
    X = feat_df[feature_columns].replace([np.inf, -np.inf], np.nan).fillna(0)
    y = feat_df["demand_quantity"].values

    if len(X) < 50:
        raise ValueError("Need at least ~50 daily rows per pipeline after feature engineering.")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, shuffle=False, random_state=random_state
    )

    model = HistGradientBoostingRegressor(
        max_depth=8,
        learning_rate=0.08,
        max_iter=200,
        random_state=random_state,
    )
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    rmse = float(_rmse(y_test, pred))
    mae = float(mean_absolute_error(y_test, pred))

    return TrainResult(
        model=model,
        region_encoder=region_encoder,
        rmse=rmse,
        mae=mae,
        n_samples=len(feat_df),
        feature_columns=feature_columns,
    )


def save_artifact(result: TrainResult, path: Path, metrics_path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "model": result.model,
        "region_encoder": result.region_encoder,
        "feature_columns": result.feature_columns,
    }
    joblib.dump(payload, path)
    metrics_path.write_text(
        json.dumps({"rmse": result.rmse, "mae": result.mae, "n_samples": result.n_samples}, indent=2)
    )


def load_artifact(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError("Model artifact not found. Train the model first.")
    return joblib.load(path)


def forecast_recursive(
    artifact: dict[str, Any],
    history_df: pd.DataFrame,
    horizon_days: int,
    regions: list[str] | None = None,
) -> pd.DataFrame:
    """Walk-forward recursive forecast using last known demands per region."""
    model = artifact["model"]
    region_encoder: dict[str, int] = artifact["region_encoder"]
    feature_columns: list[str] = artifact["feature_columns"]

    daily = _aggregate_daily(history_df)
    if regions is None:
        regions = sorted(daily["region"].unique())

    last_date = pd.to_datetime(daily["record_date"]).max()
    if pd.isna(last_date):
        raise ValueError("No history to forecast from.")

    series: dict[str, list[float]] = {}
    for r in regions:
        if r not in region_encoder:
            continue
        sub = daily[daily["region"] == r].sort_values("record_date")
        series[r] = sub["demand_quantity"].tolist()

    rows: list[dict[str, Any]] = []
    for h in range(1, horizon_days + 1):
        fdate = (last_date + pd.Timedelta(days=h)).date()
        for r in regions:
            if r not in region_encoder:
                continue
            hist = series[r]
            if len(hist) < 7:
                lag_1 = hist[-1] if hist else 0.0
                lag_7 = hist[0] if hist else 0.0
                roll_mean_7 = float(np.mean(hist)) if hist else 0.0
                roll_std_7 = float(np.std(hist)) if len(hist) > 1 else 0.0
            else:
                lag_1 = hist[-1]
                lag_7 = hist[-7] if len(hist) >= 7 else hist[0]
                roll_mean_7 = float(np.mean(hist[-7:]))
                roll_std_7 = float(np.std(hist[-7:]))

            dt = pd.Timestamp(fdate)
            x = pd.DataFrame(
                [
                    {
                        "region_code": region_encoder[r],
                        "dow": dt.dayofweek,
                        "month": dt.month,
                        "lag_1": lag_1,
                        "lag_7": lag_7,
                        "roll_mean_7": roll_mean_7,
                        "roll_std_7": roll_std_7,
                    }
                ]
            )[feature_columns]
            pred = float(model.predict(x)[0])
            pred = max(pred, 0.0)
            rows.append({"forecast_date": fdate, "region": r, "predicted_demand": pred})
            hist.append(pred)
            series[r] = hist

    return pd.DataFrame(rows)
