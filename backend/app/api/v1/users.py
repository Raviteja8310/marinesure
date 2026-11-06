"""Current-user profile and administrator user management."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.permissions import UserRole, get_current_user_payload, require_roles
from app.database.connection import get_db
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginEvent,
    MessageResponse,
    ProfileUpdate,
    RoleAssignRequest,
    StatusChangeRequest,
    UserPublic,
)
from app.services import auth_service
from app.services.rbac_service import require_permission

router = APIRouter(prefix="/users", tags=["Users"])


def _load(db: Session, payload: dict) -> User:
    user = db.get(User, payload["sub"])
    if user is None or user.status == "suspended":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is not active")
    return user


@router.get("/me", response_model=UserPublic)
def me(payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)):
    return auth_service.public_user(_load(db, payload))


@router.patch("/me", response_model=UserPublic)
def update_me(
    data: ProfileUpdate,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    user = auth_service.update_profile(db, _load(db, payload), data)
    return auth_service.public_user(user)


@router.post("/me/password", response_model=MessageResponse)
def change_password(
    data: ChangePasswordRequest,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    auth_service.change_password(db, _load(db, payload), data.current_password, data.new_password)
    return MessageResponse(message="Password changed")


@router.get("/me/login-history", response_model=list[LoginEvent])
def my_history(
    payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)
):
    user = _load(db, payload)
    events = sorted(user.login_history, key=lambda e: e.login_time, reverse=True)[:20]
    return events


@router.get("", response_model=list[UserPublic])
def list_users(
    _actor: User = Depends(require_permission("users.view", "users.manage")),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [auth_service.public_user(u) for u in users]


@router.post("/{user_id}/roles", response_model=UserPublic)
def assign_role(
    user_id: str,
    data: RoleAssignRequest,
    actor: User = Depends(require_permission("users.manage")),
    db: Session = Depends(get_db),
):
    target = auth_service.get_user(db, user_id)
    updated = auth_service.assign_role(db, actor, target, data.role, data)
    return auth_service.public_user(updated)


@router.post("/{user_id}/status", response_model=UserPublic)
def change_status(
    user_id: str,
    data: StatusChangeRequest,
    actor: User = Depends(require_permission("users.manage")),
    db: Session = Depends(get_db),
):
    target = auth_service.get_user(db, user_id)
    if actor.id == target.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot change your own status")
    return auth_service.public_user(auth_service.set_status(db, target, data.status))
