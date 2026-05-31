"""
ForecastFlow AI — Enterprise ML Pipeline
Ensemble forecasting: XGBoost + LightGBM (with graceful fallback to XGBoost-only)
with confidence intervals, feature importance, and walk-forward recursive prediction.
"""

from __future__ import annotations

import json
import warnings
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split

warnings.filterwarnings("ignore", category=UserWarning)

try:
    import lightgbm as lgb
    HAS_LGB = True
except Exception:
    HAS_LGB = False

try:
    from sklearn.metrics import root_mean_squared_error as _rmse_fn
except ImportError:
    from sklearn.metrics import mean_squared_error
    def _rmse_fn(y_true, y_pred):
        return float(mean_squared_error(y_true, y_pred) ** 0.5)

try:
    from scipy import stats as _scipy_stats
    HAS_SCIPY = True
except Exception:
    HAS_SCIPY = False

REQUIRED_COLS = {"record_date", "region", "demand_quantity"}

FEATURE_COLUMNS = [
    "region_code", "dow", "month", "day_of_year", "week_of_year",
    "is_weekend", "quarter",
    "lag_1", "lag_2", "lag_3", "lag_7", "lag_14", "lag_21", "lag_28",
    "roll_mean_3", "roll_mean_7", "roll_mean_14", "roll_mean_28",
    "roll_std_7", "roll_std_14",
    "roll_min_7", "roll_max_7",
    "ewm_7", "ewm_14",
    "trend_7",
]


@dataclass
class TrainResult:
    xgb_model: Any
    lgb_model: Any  # None if LightGBM unavailable
    region_encoder: dict[str, int]
    rmse: float
    mae: float
    mape: float
    n_samples: int
    feature_columns: list[str]
    feature_importance: dict[str, float]
    xgb_rmse: float
    lgb_rmse: float
    ensemble_weights: list[float] = field(default_factory=lambda: [1.0, 0.0])


def _aggregate_daily(df: pd.DataFrame) -> pd.DataFrame:
    return (
        df.groupby(["record_date", "region"], as_index=False)["demand_quantity"]
        .sum()
        .sort_values(["region", "record_date"])
    )


def _add_features(df: pd.DataFrame, region_encoder: dict[str, int]) -> pd.DataFrame:
    out = df.copy()
    out["region_code"] = out["region"].map(region_encoder).fillna(-1).astype(int)

    dt = pd.to_datetime(out["record_date"])
    out["dow"] = dt.dt.dayofweek
    out["month"] = dt.dt.month
    out["day_of_year"] = dt.dt.dayofyear
    out["week_of_year"] = dt.dt.isocalendar().week.astype(int)
    out["is_weekend"] = (out["dow"] >= 5).astype(int)
    out["quarter"] = dt.dt.quarter

    grp = out.groupby("region")["demand_quantity"]

    for lag in [1, 2, 3, 7, 14, 21, 28]:
        out[f"lag_{lag}"] = grp.shift(lag)

    for w in [3, 7, 14, 28]:
        out[f"roll_mean_{w}"] = grp.transform(
            lambda s: s.shift(1).rolling(w, min_periods=1).mean()
        )
    for w in [7, 14]:
        out[f"roll_std_{w}"] = grp.transform(
            lambda s: s.shift(1).rolling(w, min_periods=1).std()
        )
    out["roll_min_7"] = grp.transform(lambda s: s.shift(1).rolling(7, min_periods=1).min())
    out["roll_max_7"] = grp.transform(lambda s: s.shift(1).rolling(7, min_periods=1).max())
    out["ewm_7"] = grp.transform(lambda s: s.shift(1).ewm(span=7, min_periods=1).mean())
    out["ewm_14"] = grp.transform(lambda s: s.shift(1).ewm(span=14, min_periods=1).mean())

    def _trend(s: pd.Series) -> pd.Series:
        shifted = s.shift(1)
        return shifted.rolling(7, min_periods=2).apply(
            lambda x: float(np.polyfit(range(len(x)), x, 1)[0]) if len(x) >= 2 else 0.0,
            raw=True,
        )
    out["trend_7"] = grp.transform(_trend)

    return out.dropna(subset=FEATURE_COLUMNS)


def train_from_frame(df: pd.DataFrame, test_size: float = 0.2, random_state: int = 42) -> TrainResult:
    for c in REQUIRED_COLS:
        if c not in df.columns:
            raise ValueError(f"Missing column: {c}")

    daily = _aggregate_daily(df)
    regions = sorted(daily["region"].unique())
    region_encoder = {r: i for i, r in enumerate(regions)}
    feat_df = _add_features(daily, region_encoder)

    X = feat_df[FEATURE_COLUMNS].replace([np.inf, -np.inf], np.nan).fillna(0)
    y = feat_df["demand_quantity"].values

    if len(X) < 50:
        raise ValueError("Need at least ~50 daily rows after feature engineering.")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, shuffle=False, random_state=random_state
    )

    # XGBoost — always available
    xgb_model = xgb.XGBRegressor(
        n_estimators=300, max_depth=7, learning_rate=0.06,
        subsample=0.85, colsample_bytree=0.85, min_child_weight=3,
        reg_alpha=0.1, reg_lambda=1.0, random_state=random_state,
        n_jobs=-1, verbosity=0,
    )
    xgb_model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
    xgb_pred = xgb_model.predict(X_test)
    xgb_rmse = float(_rmse_fn(y_test, xgb_pred))

    # LightGBM — optional
    lgb_model = None
    lgb_rmse = xgb_rmse
    ensemble_weights = [1.0, 0.0]

    if HAS_LGB:
        try:
            lgb_model = lgb.LGBMRegressor(
                n_estimators=300, max_depth=7, learning_rate=0.06,
                subsample=0.85, colsample_bytree=0.85, min_child_samples=10,
                reg_alpha=0.1, reg_lambda=1.0, random_state=random_state,
                n_jobs=-1, verbose=-1,
            )
            lgb_model.fit(X_train, y_train)
            lgb_pred = lgb_model.predict(X_test)
            lgb_rmse = float(_rmse_fn(y_test, lgb_pred))
            # Inverse-RMSE ensemble weights
            total_inv = (1 / xgb_rmse) + (1 / lgb_rmse)
            w_xgb = (1 / xgb_rmse) / total_inv
            w_lgb = (1 / lgb_rmse) / total_inv
            ensemble_weights = [w_xgb, w_lgb]
            ensemble_pred = w_xgb * xgb_pred + w_lgb * lgb_pred
        except Exception:
            lgb_model = None
            ensemble_pred = xgb_pred
            ensemble_weights = [1.0, 0.0]
    else:
        ensemble_pred = xgb_pred

    rmse = float(_rmse_fn(y_test, ensemble_pred))
    mae = float(mean_absolute_error(y_test, ensemble_pred))
    mask = y_test != 0
    mape = float(np.mean(np.abs((y_test[mask] - ensemble_pred[mask]) / y_test[mask])) * 100) if mask.any() else 0.0

    # Feature importance
    xgb_imp = xgb_model.feature_importances_
    xgb_norm = xgb_imp / (xgb_imp.sum() + 1e-9)
    if lgb_model is not None and HAS_LGB:
        lgb_imp = lgb_model.feature_importances_
        lgb_norm = lgb_imp / (lgb_imp.sum() + 1e-9)
        combined = ensemble_weights[0] * xgb_norm + ensemble_weights[1] * lgb_norm
    else:
        combined = xgb_norm
    feature_importance = {f: float(v) for f, v in zip(FEATURE_COLUMNS, combined)}

    return TrainResult(
        xgb_model=xgb_model, lgb_model=lgb_model,
        region_encoder=region_encoder, rmse=rmse, mae=mae, mape=mape,
        n_samples=len(feat_df), feature_columns=FEATURE_COLUMNS,
        feature_importance=feature_importance, xgb_rmse=xgb_rmse,
        lgb_rmse=lgb_rmse, ensemble_weights=ensemble_weights,
    )


def save_artifact(result: TrainResult, path: Path, metrics_path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "xgb_model": result.xgb_model,
        "lgb_model": result.lgb_model,
        "region_encoder": result.region_encoder,
        "feature_columns": result.feature_columns,
        "ensemble_weights": result.ensemble_weights,
        "feature_importance": result.feature_importance,
    }
    joblib.dump(payload, path)
    metrics_path.write_text(json.dumps({
        "rmse": result.rmse, "mae": result.mae, "mape": result.mape,
        "n_samples": result.n_samples, "xgb_rmse": result.xgb_rmse,
        "lgb_rmse": result.lgb_rmse, "ensemble_weights": result.ensemble_weights,
        "feature_importance": result.feature_importance,
    }, indent=2))


def load_artifact(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError("Model artifact not found. Train the model first.")
    return joblib.load(path)


def _build_feature_row(region_code: int, fdate: pd.Timestamp, hist: list[float]) -> dict:
    n = len(hist)
    def lag(k): return hist[-k] if n >= k else (hist[0] if hist else 0.0)
    def roll_mean(w): return float(np.mean(hist[-w:])) if n >= 1 else 0.0
    def roll_std(w): return float(np.std(hist[-w:])) if n >= 2 else 0.0
    def ewm(span):
        if not hist: return 0.0
        alpha = 2.0 / (span + 1)
        val = hist[0]
        for v in hist[1:]: val = alpha * v + (1 - alpha) * val
        return float(val)
    def trend(w):
        if n < 2: return 0.0
        window = hist[-w:] if n >= w else hist
        return float(np.polyfit(range(len(window)), window, 1)[0]) if len(window) >= 2 else 0.0

    iso = fdate.isocalendar()
    return {
        "region_code": region_code, "dow": fdate.dayofweek, "month": fdate.month,
        "day_of_year": fdate.dayofyear, "week_of_year": iso[1],
        "is_weekend": int(fdate.dayofweek >= 5), "quarter": fdate.quarter,
        "lag_1": lag(1), "lag_2": lag(2), "lag_3": lag(3),
        "lag_7": lag(7), "lag_14": lag(14), "lag_21": lag(21), "lag_28": lag(28),
        "roll_mean_3": roll_mean(3), "roll_mean_7": roll_mean(7),
        "roll_mean_14": roll_mean(14), "roll_mean_28": roll_mean(28),
        "roll_std_7": roll_std(7), "roll_std_14": roll_std(14),
        "roll_min_7": float(min(hist[-7:])) if n >= 1 else 0.0,
        "roll_max_7": float(max(hist[-7:])) if n >= 1 else 0.0,
        "ewm_7": ewm(7), "ewm_14": ewm(14), "trend_7": trend(7),
    }


def forecast_recursive(
    artifact: dict[str, Any],
    history_df: pd.DataFrame,
    horizon_days: int,
    regions: list[str] | None = None,
    confidence_level: float = 0.9,
) -> pd.DataFrame:
    xgb_model = artifact["xgb_model"]
    lgb_model = artifact.get("lgb_model")
    region_encoder: dict[str, int] = artifact["region_encoder"]
    feature_columns: list[str] = artifact.get("feature_columns", FEATURE_COLUMNS)
    ensemble_weights: list[float] = artifact.get("ensemble_weights", [1.0, 0.0])

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

    # Residual std per region for confidence intervals
    residual_stds: dict[str, float] = {}
    for r in regions:
        if r not in region_encoder:
            continue
        sub = daily[daily["region"] == r].sort_values("record_date")
        if len(sub) < 5:
            residual_stds[r] = float(sub["demand_quantity"].std()) if len(sub) > 1 else 10.0
            continue
        feat_df = _add_features(sub.copy(), region_encoder)
        if feat_df.empty:
            residual_stds[r] = 10.0
            continue
        Xr = feat_df[feature_columns].replace([np.inf, -np.inf], np.nan).fillna(0)
        xp = xgb_model.predict(Xr)
        if lgb_model is not None:
            lp = lgb_model.predict(Xr)
            ep = ensemble_weights[0] * xp + ensemble_weights[1] * lp
        else:
            ep = xp
        residuals = feat_df["demand_quantity"].values - ep
        residual_stds[r] = float(np.std(residuals)) if len(residuals) > 1 else 10.0

    # z-score for confidence interval
    if HAS_SCIPY:
        from scipy import stats as _stats
        z_score = float(_stats.norm.ppf((1 + confidence_level) / 2))
    else:
        z_score = 1.645 if confidence_level >= 0.9 else 1.28

    rows: list[dict[str, Any]] = []
    for h in range(1, horizon_days + 1):
        fdate = last_date + pd.Timedelta(days=h)
        for r in regions:
            if r not in region_encoder:
                continue
            hist = series[r]
            feat_row = _build_feature_row(region_encoder[r], fdate, hist)
            X = pd.DataFrame([feat_row])[feature_columns]

            xp = float(xgb_model.predict(X)[0])
            if lgb_model is not None:
                lp = float(lgb_model.predict(X)[0])
                pred = max(0.0, ensemble_weights[0] * xp + ensemble_weights[1] * lp)
            else:
                lp = xp
                pred = max(0.0, xp)

            horizon_factor = 1.0 + (h - 1) * 0.03
            std = residual_stds.get(r, 10.0) * horizon_factor
            margin = z_score * std

            rows.append({
                "forecast_date": fdate.date(),
                "region": r,
                "predicted_demand": pred,
                "lower_bound": max(0.0, pred - margin),
                "upper_bound": pred + margin,
                "confidence_level": confidence_level,
                "xgb_pred": max(0.0, xp),
                "lgb_pred": max(0.0, lp),
            })
            hist.append(pred)
            series[r] = hist

    return pd.DataFrame(rows)
