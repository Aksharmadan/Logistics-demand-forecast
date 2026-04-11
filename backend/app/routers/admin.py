from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_roles
from app.models import User
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
