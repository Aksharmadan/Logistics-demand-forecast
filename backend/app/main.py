from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.models import User
from app.routers import admin, analytics, auth, demand, export, intelligence, ml_ops, ws_live
from app.security import hash_password

settings = get_settings()


def seed_demo_users(db: Session) -> None:
    if db.query(User).first():
        return
    admin_user = User(
        email="admin@logistics.demo",
        hashed_password=hash_password("ChangeMe!2026"),
        full_name="Demo Admin",
        role="admin",
    )
    analyst = User(
        email="analyst@logistics.demo",
        hashed_password=hash_password("ChangeMe!2026"),
        full_name="Demo Analyst",
        role="analyst",
    )
    db.add_all([admin_user, analyst])
    db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_demo_users(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Smart Demand Forecasting API",
    description="Transportation & logistics demand forecasting with ML, analytics, and alerts.",
    version="1.0.0",
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
app.include_router(intelligence.router)
app.include_router(ws_live.router)


@app.get("/")
def root() -> dict:
    return {
        "name": "Smart Demand Forecasting API",
        "docs": "/docs",
        "health": "/health",
    }
