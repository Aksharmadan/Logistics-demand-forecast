from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


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

    model_config = {"from_attributes": True}


class DemandRowIn(BaseModel):
    date: date
    region: str
    demand: float = Field(alias="demand_quantity")
    sku: str | None = None

    model_config = {"populate_by_name": True}


class TrainResponse(BaseModel):
    message: str
    rmse: float
    mae: float
    n_samples: int
    model_path: str


class PredictRequest(BaseModel):
    horizon_days: int = Field(default=7, ge=1, le=90)
    regions: list[str] | None = None


class PredictPoint(BaseModel):
    forecast_date: date
    region: str
    predicted_demand: float


class PredictResponse(BaseModel):
    predictions: list[PredictPoint]
    model_trained_at: datetime | None = None


class AnalyticsSummary(BaseModel):
    total_demand_last_30d: float
    avg_daily_demand: float
    growth_pct_vs_prior_30d: float
    active_regions: int
    open_alerts: int


class RegionDemandBar(BaseModel):
    region: str
    total_demand: float


class TimeSeriesPoint(BaseModel):
    d: date
    demand: float


class HeatmapCell(BaseModel):
    region: str
    week_start: date
    intensity: float


class AnalyticsResponse(BaseModel):
    summary: AnalyticsSummary
    demand_by_region: list[RegionDemandBar]
    demand_over_time: list[TimeSeriesPoint]
    heatmap: list[HeatmapCell]


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

    model_config = {"from_attributes": True}


class SimulatedTick(BaseModel):
    region: str
    base_demand: float = Field(default=100, ge=0)
    noise: float = Field(default=15, ge=0)


class ExportQuery(BaseModel):
    format: str = "csv"  # csv | pdf
