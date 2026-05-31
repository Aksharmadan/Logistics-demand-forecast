from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_roles
from app.models import DemandRecord, ModelRun, User
from app.schemas import UserOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
) -> list[User]:
    return db.query(User).order_by(User.id).all()


@router.patch("/users/{user_id}/role")
def set_role(
    user_id: int,
    role: str = Query(..., pattern="^(admin|analyst|viewer)$"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin")),
) -> dict:
    if role not in ("admin", "analyst", "viewer"):
        raise HTTPException(400, "Invalid role")
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "User not found")
    if u.id == admin.id and role != "admin":
        raise HTTPException(400, "Cannot demote yourself")
    u.role = role
    db.commit()
    return {"ok": True, "user_id": user_id, "role": role}

@router.get("/activity")
def list_activity(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
) -> list[dict]:
    # Mock activity log
    return [
        {"id": 1, "timestamp": "2026-05-01T10:00:00Z", "action": "User login", "user": "admin@logistics.demo", "details": "Successful login via web UI."},
        {"id": 2, "timestamp": "2026-05-01T10:05:00Z", "action": "Model trained", "user": "analyst@logistics.demo", "details": "XGBoost pipeline triggered."},
        {"id": 3, "timestamp": "2026-05-01T10:30:00Z", "action": "Data uploaded", "user": "admin@logistics.demo", "details": "Uploaded 1200 rows of demand history."},
        {"id": 4, "timestamp": "2026-05-01T11:00:00Z", "action": "Anomaly detected", "user": "system", "details": "High severity spike in region North."},
    ]


@router.get("/system-stats")
def system_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
) -> dict:
    last_run = db.query(ModelRun).order_by(ModelRun.trained_at.desc()).first()
    return {
        "total_users": db.query(User).count(),
        "active_users": db.query(User).filter(User.is_active.is_(True)).count(),
        "total_demand_records": db.query(DemandRecord).count(),
        "total_model_runs": db.query(ModelRun).count(),
        "last_model_trained": last_run.trained_at.isoformat() if last_run else None,
        "last_model_rmse": last_run.rmse if last_run else None,
    }
