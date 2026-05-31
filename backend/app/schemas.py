from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


# ── Auth ──────────────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str | None = None
    role: str | None = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str | None = None


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str | None
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Demand ────────────────────────────────────────────────────────────────────

class DemandRowIn(BaseModel):
    date: date
    region: str
    demand: float = Field(alias="demand_quantity")
    sku: str | None = None

    model_config = {"populate_by_name": True}


# ── ML ────────────────────────────────────────────────────────────────────────

class TrainResponse(BaseModel):
    message: str
    rmse: float
    mae: float
    mape: float
    n_samples: int
    model_path: str
    xgb_rmse: float
    lgb_rmse: float
    ensemble_weights: list[float]
    feature_importance: dict[str, float]


class PredictRequest(BaseModel):
    horizon_days: int = Field(default=7, ge=1, le=90)
    regions: list[str] | None = None
    confidence_level: float = Field(default=0.9, ge=0.5, le=0.99)


class PredictPoint(BaseModel):
    forecast_date: date
    region: str
    predicted_demand: float
    lower_bound: float
    upper_bound: float
    confidence_level: float
    xgb_pred: float
    lgb_pred: float


class PredictResponse(BaseModel):
    predictions: list[PredictPoint]
    model_trained_at: datetime | None = None
    model_rmse: float | None = None
    model_mae: float | None = None
    model_mape: float | None = None


class ModelRunOut(BaseModel):
    id: int
    trained_at: datetime
    rmse: float | None
    mae: float | None
    mape: float | None
    n_samples: int | None
    xgb_rmse: float | None
    lgb_rmse: float | None
    status: str

    model_config = {"from_attributes": True}


class FeatureImportanceOut(BaseModel):
    features: list[dict[str, Any]]  # [{name, importance, rank}]
    model_trained_at: datetime | None


# ── Analytics ─────────────────────────────────────────────────────────────────

class AnalyticsSummary(BaseModel):
    total_demand_last_30d: float
    avg_daily_demand: float
    growth_pct_vs_prior_30d: float
    active_regions: int
    open_alerts: int
    total_records: int
    peak_region: str
    peak_demand: float


class RegionDemandBar(BaseModel):
    region: str
    total_demand: float
    pct_of_total: float


class TimeSeriesPoint(BaseModel):
    d: date
    demand: float
    rolling_avg: float


class HeatmapCell(BaseModel):
    region: str
    week_start: date
    intensity: float
    raw_demand: float


class AnalyticsResponse(BaseModel):
    summary: AnalyticsSummary
    demand_by_region: list[RegionDemandBar]
    demand_over_time: list[TimeSeriesPoint]
    heatmap: list[HeatmapCell]


# ── Anomalies ─────────────────────────────────────────────────────────────────

class AnomalyOut(BaseModel):
    id: int
    alert_date: date
    region: str
    demand_quantity: float
    expected_demand: float | None
    anomaly_score: float
    severity: str
    message: str
    acknowledged: bool
    acknowledged_by: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Audit ─────────────────────────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: int
    timestamp: datetime
    user_email: str
    action: str
    resource: str | None
    details: str | None
    status: str

    model_config = {"from_attributes": True}


# ── Fleet ─────────────────────────────────────────────────────────────────────

class FleetVehicleOut(BaseModel):
    id: int
    vehicle_id: str
    vehicle_type: str
    region: str
    status: str
    capacity: float
    current_load: float
    lat: float | None
    lng: float | None
    fuel_level: float
    total_deliveries: int
    last_updated: datetime

    model_config = {"from_attributes": True}


# ── AI Copilot ────────────────────────────────────────────────────────────────

class CopilotRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)


class CopilotResponse(BaseModel):
    answer: str
    confidence: float
    sources: list[str]
    recommendations: list[str]
    data_points: dict[str, Any]


# ── Misc ──────────────────────────────────────────────────────────────────────

class SimulatedTick(BaseModel):
    region: str
    base_demand: float = Field(default=100, ge=0)
    noise: float = Field(default=15, ge=0)


class ExportQuery(BaseModel):
    format: str = "csv"  # csv | pdf


class OperationalInsight(BaseModel):
    type: str  # info, warning, critical, recommendation
    title: str
    body: str
    region: str | None = None
    metric: float | None = None
    action: str | None = None
