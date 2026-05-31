from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(32), default="viewer")  # admin, analyst, viewer
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class DemandRecord(Base):
    __tablename__ = "demand_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    record_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    region: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    sku: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    demand_quantity: Mapped[float] = mapped_column(Float, nullable=False)
    source: Mapped[str] = mapped_column(String(64), default="upload")  # upload, api, simulated
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ModelRun(Base):
    __tablename__ = "model_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trained_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    rmse: Mapped[float | None] = mapped_column(Float, nullable=True)
    mae: Mapped[float | None] = mapped_column(Float, nullable=True)
    mape: Mapped[float | None] = mapped_column(Float, nullable=True)
    n_samples: Mapped[int | None] = mapped_column(Integer, nullable=True)
    model_path: Mapped[str] = mapped_column(String(512), nullable=False)
    extra_metrics: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    xgb_rmse: Mapped[float | None] = mapped_column(Float, nullable=True)
    lgb_rmse: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="completed")  # training, completed, failed


class AnomalyAlert(Base):
    __tablename__ = "anomaly_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    alert_date: Mapped[date] = mapped_column(Date, index=True)
    region: Mapped[str] = mapped_column(String(128), index=True)
    demand_quantity: Mapped[float] = mapped_column(Float)
    expected_demand: Mapped[float | None] = mapped_column(Float, nullable=True)
    anomaly_score: Mapped[float] = mapped_column(Float)
    severity: Mapped[str] = mapped_column(String(32))  # high, medium
    message: Mapped[str] = mapped_column(Text)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    acknowledged_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    user_email: Mapped[str] = mapped_column(String(255), index=True)
    action: Mapped[str] = mapped_column(String(128))
    resource: Mapped[str | None] = mapped_column(String(255), nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="success")  # success, failure


class FleetVehicle(Base):
    __tablename__ = "fleet_vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    vehicle_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    vehicle_type: Mapped[str] = mapped_column(String(64), default="truck")  # truck, van, drone
    region: Mapped[str] = mapped_column(String(128), index=True)
    status: Mapped[str] = mapped_column(String(32), default="active")  # active, idle, maintenance, en_route
    capacity: Mapped[float] = mapped_column(Float, default=1000.0)
    current_load: Mapped[float] = mapped_column(Float, default=0.0)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    fuel_level: Mapped[float] = mapped_column(Float, default=100.0)
    total_deliveries: Mapped[int] = mapped_column(Integer, default=0)
