"""
Multi-model training: HistGradientBoosting + XGBoost (+ optional Prophet on aggregate series).
Selects best by temporal holdout RMSE; exports feature importance and per-region residual spread for intervals.
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

from app.ml.pipeline import REQUIRED_COLS, _add_features, _aggregate_daily

# XGBoost may fail to load native libs (e.g. missing libomp on macOS) — degrade gracefully.
HAS_XGB = False
xgb = None  # type: ignore[assignment]
try:
    import xgboost as _xgb  # noqa: WPS433

    _ = _xgb.XGBRegressor  # touch class to force lib load
    xgb = _xgb
    HAS_XGB = True
except Exception:  # pragma: no cover — ImportError, XGBoostError, etc.
    HAS_XGB = False

try:
    from prophet import Prophet  # type: ignore

    HAS_PROPHET = True
except ImportError:  # pragma: no cover
    HAS_PROPHET = False


@dataclass
class EnsembleTrainResult:
    artifact_dict: dict[str, Any]
    rmse: float
    mae: float
    n_samples: int
    best_name: str
    comparison: dict[str, Any]


def _temporal_split(n: int, test_ratio: float = 0.2) -> tuple[np.ndarray, np.ndarray]:
    k = max(int(n * (1 - test_ratio)), 10)
    idx = np.arange(n)
    return idx[:k], idx[k:]


def _train_prophet_aggregate(daily: pd.DataFrame) -> dict[str, Any] | None:
    if not HAS_PROPHET or len(daily) < 30:
        return None
    agg = daily.groupby("record_date", as_index=False)["demand_quantity"].sum()
    agg = agg.rename(columns={"record_date": "ds", "demand_quantity": "y"})
    agg["ds"] = pd.to_datetime(agg["ds"])
    if len(agg) < 40:
        return None
    split = int(len(agg) * 0.8)
    train, test = agg.iloc[:split], agg.iloc[split:]
    try:
        m = Prophet(daily_seasonality=True, yearly_seasonality=False, weekly_seasonality=True)
        m.fit(train)
        fc = m.predict(test[["ds"]])
        pred = fc["yhat"].values
        rmse = float(_rmse(test["y"].values, pred))
        return {"name": "prophet_aggregate", "rmse": rmse, "note": "Trained on network-wide daily total (benchmark only)."}
    except Exception as e:  # pragma: no cover
        return {"name": "prophet_aggregate", "error": str(e)}


def train_ensemble_from_frame(df: pd.DataFrame, random_state: int = 42) -> EnsembleTrainResult:
    for c in REQUIRED_COLS:
        if c not in df.columns:
            raise ValueError(f"Missing column: {c}")

    daily = _aggregate_daily(df)
    regions = sorted(daily["region"].unique())
    region_encoder = {r: i for i, r in enumerate(regions)}
    feat_df = _add_features(daily, region_encoder)
    feature_columns = ["region_code", "dow", "month", "lag_1", "lag_7", "roll_mean_7", "roll_std_7"]
    X = feat_df[feature_columns].replace([np.inf, -np.inf], np.nan).fillna(0).values
    y = feat_df["demand_quantity"].values
    regions_col = feat_df["region"].values

    if len(X) < 50:
        raise ValueError("Need at least ~50 rows after feature engineering.")

    tr_idx, te_idx = _temporal_split(len(X), 0.2)
    X_train, X_test = X[tr_idx], X[te_idx]
    y_train, y_test = y[tr_idx], y[te_idx]
    reg_test = regions_col[te_idx]

    hgb = HistGradientBoostingRegressor(
        max_depth=8,
        learning_rate=0.08,
        max_iter=220,
        random_state=random_state,
    )
    hgb.fit(X_train, y_train)
    pred_h = hgb.predict(X_test)
    rmse_h = float(_rmse(y_test, pred_h))
    mae_h = float(mean_absolute_error(y_test, pred_h))

    comparison: dict[str, Any] = {
        "histgradient": {"rmse": rmse_h, "mae": mae_h},
        "lstm": {"status": "optional", "message": "Enable PyTorch/TensorFlow + sequence pipeline for LSTM baseline."},
    }

    best_model: Any = hgb
    best_name = "histgradient"
    rmse_best, mae_best = rmse_h, mae_h
    feat_imp: list[dict[str, float]] = []

    if HAS_XGB and xgb is not None:
        xgb_model = xgb.XGBRegressor(  # type: ignore[union-attr]
            n_estimators=400,
            max_depth=8,
            learning_rate=0.06,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=random_state,
            n_jobs=0,
        )
        xgb_model.fit(X_train, y_train)
        pred_x = xgb_model.predict(X_test)
        rmse_x = float(_rmse(y_test, pred_x))
        mae_x = float(mean_absolute_error(y_test, pred_x))
        comparison["xgboost"] = {"rmse": rmse_x, "mae": mae_x}
        imps = xgb_model.feature_importances_
        feat_imp = [
            {"feature": feature_columns[i], "importance": float(imps[i])}
            for i in range(len(feature_columns))
        ]
        feat_imp.sort(key=lambda z: z["importance"], reverse=True)
        if rmse_x < rmse_best:
            best_model = xgb_model
            best_name = "xgboost"
            rmse_best, mae_best = rmse_x, mae_x
            pred_best = pred_x
        else:
            pred_best = pred_h
    else:
        pred_best = pred_h
        try:
            imps = getattr(hgb, "feature_importances_", None)
            if imps is not None and len(imps) == len(feature_columns):
                feat_imp = [
                    {"feature": feature_columns[i], "importance": float(imps[i])}
                    for i in range(len(feature_columns))
                ]
                feat_imp.sort(key=lambda z: z["importance"], reverse=True)
        except Exception:
            pass
        if not feat_imp:
            corr = [abs(np.corrcoef(X_train[:, i], y_train)[0, 1]) for i in range(X_train.shape[1])]
            feat_imp = [
                {"feature": feature_columns[i], "importance": float(c if np.isfinite(c) else 0.0)}
                for i, c in enumerate(corr)
            ]
            feat_imp.sort(key=lambda z: z["importance"], reverse=True)

    ph = _train_prophet_aggregate(daily)
    if ph:
        comparison["prophet_aggregate"] = ph

    residual = y_test - pred_best
    sigma_by_region: dict[str, float] = {}
    for r in np.unique(reg_test):
        mask = reg_test == r
        vals = residual[mask]
        sigma_by_region[str(r)] = float(np.std(vals) + 1e-6)

    global_sigma = float(np.std(residual) + 1e-6)

    artifact = {
        "version": 2,
        "model": best_model,
        "best_name": best_name,
        "region_encoder": region_encoder,
        "feature_columns": feature_columns,
        "comparison_metrics": comparison,
        "feature_importance": feat_imp[:12],
        "residual_sigma_by_region": sigma_by_region,
        "residual_sigma_global": global_sigma,
        "models_sidecar": {},
    }
    if HAS_XGB and xgb is not None and best_name == "histgradient":
        # keep xgb in sidecar for UI comparison charts without doubling predict path
        try:
            artifact["models_sidecar"]["xgboost"] = xgb_model  # type: ignore[name-defined]
        except Exception:
            pass
    if HAS_XGB and xgb is not None and best_name == "xgboost":
        artifact["models_sidecar"]["histgradient"] = hgb

    return EnsembleTrainResult(
        artifact_dict=artifact,
        rmse=rmse_best,
        mae=mae_best,
        n_samples=len(feat_df),
        best_name=best_name,
        comparison=comparison,
    )


def save_ensemble(result: EnsembleTrainResult, path: Path, metrics_path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(result.artifact_dict, path)
    metrics_path.write_text(
        json.dumps(
            {
                "rmse": result.rmse,
                "mae": result.mae,
                "n_samples": result.n_samples,
                "best_name": result.best_name,
                "comparison": result.comparison,
            },
            indent=2,
        )
    )


def load_ensemble_or_legacy(path: Path, legacy_path: Path | None = None) -> dict[str, Any]:
    if path.exists():
        return joblib.load(path)
    if legacy_path and legacy_path.exists():
        return joblib.load(legacy_path)
    raise FileNotFoundError("No trained model found. Run training first.")


def interval_for_region(artifact: dict[str, Any], region: str, z: float = 1.96) -> float:
    sigma_map = artifact.get("residual_sigma_by_region") or {}
    g = artifact.get("residual_sigma_global", 10.0)
    sigma = float(sigma_map.get(region, g))
    return z * sigma


def explain_from_features(
    feature_columns: list[str],
    row: dict[str, float],
    importance: list[dict[str, float]],
) -> dict[str, Any]:
    imp_map = {x["feature"]: x["importance"] for x in importance}
    scored = []
    for col in feature_columns:
        base = imp_map.get(col, 0.1)
        magnitude = abs(float(row.get(col, 0)))
        scored.append((col, base * (1 + np.log1p(magnitude))))
    scored.sort(key=lambda t: t[1], reverse=True)
    top = scored[:4]
    narrative_parts = []
    for col, _ in top:
        val = row.get(col, 0)
        if col == "roll_mean_7":
            narrative_parts.append(f"recent 7-day level is around {val:.1f}")
        elif col == "lag_1":
            narrative_parts.append(f"yesterday's demand anchor is {val:.1f}")
        elif col == "lag_7":
            narrative_parts.append(f"same weekday last week was {val:.1f}")
        elif col == "dow":
            narrative_parts.append(f"weekday pattern slot {int(val)} influences baseline")
        elif col == "month":
            narrative_parts.append(f"monthly seasonality bucket {int(val)}")
        else:
            narrative_parts.append(f"{col}={val:.2f}")
    narrative = "The forecast leans on " + "; ".join(narrative_parts) + "."
    return {"top_drivers": [{"feature": c, "score": float(s)} for c, s in top], "narrative": narrative}
