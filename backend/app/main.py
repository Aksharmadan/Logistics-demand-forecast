import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.models import User
from app.routers import admin, analytics, auth, demand, export, ml_ops
from app.routers.fleet import router as fleet_router
from app.security import hash_password
from app.websockets import router as ws_router, live_data_broadcaster

settings = get_settings()


def seed_demo_users(db: Session) -> None:
    if db.query(User).first():
        return
    users = [
        User(
            email="admin@logistics.demo",
            hashed_password=hash_password("ChangeMe!2026"),
            full_name="Demo Admin",
            role="admin",
        ),
        User(
            email="analyst@logistics.demo",
            hashed_password=hash_password("ChangeMe!2026"),
            full_name="Demo Analyst",
            role="analyst",
        ),
        User(
            email="viewer@logistics.demo",
            hashed_password=hash_password("ChangeMe!2026"),
            full_name="Demo Viewer",
            role="viewer",
        ),
    ]
    db.add_all(users)
    db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_demo_users(db)
    finally:
        db.close()

    task = asyncio.create_task(live_data_broadcaster())
    yield
    task.cancel()


app = FastAPI(
    title="ForecastFlow AI — Logistics Intelligence API",
    description="Enterprise-grade AI-powered logistics demand forecasting, anomaly detection, and operational intelligence.",
    version="2.0.0",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(demand.router)
app.include_router(analytics.router)
app.include_router(ml_ops.router)
app.include_router(export.router)
app.include_router(admin.router)
app.include_router(fleet_router)
app.include_router(ws_router)


@app.get("/")
def root() -> dict:
    return {
        "name": "ForecastFlow AI",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health",
        "status": "operational",
    }


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "forecastflow-api",
        "version": "2.0.0",
    }
