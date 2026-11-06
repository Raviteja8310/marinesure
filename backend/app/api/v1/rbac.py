"""Admin-only CRUD for roles, permissions, and the role-permission matrix."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user_payload
from app.database.connection import get_db
from app.models.rbac import Permission, RolePermission
from app.models.user import Role, User, UserRole
from app.services.agent_service import AuditService
from app.services.rbac_service import (
    DEFAULT_PERMISSIONS,
    load_active_user,
    permissions_for_user,
    require_permission,
)

router = APIRouter(tags=["Roles & Permissions"])

CODE_PATTERN = r"^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$"
ROLE_PATTERN = r"^[a-z][a-z0-9_]{2,49}$"


class PermissionIn(BaseModel):
    code: str = Field(pattern=CODE_PATTERN, max_length=80)
    name: str = Field(min_length=3, max_length=150)
    category: str = Field(default="general", min_length=2, max_length=50)
    description: Optional[str] = Field(default=None, max_length=255)


class PermissionPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=3, max_length=150)
    category: Optional[str] = Field(default=None, min_length=2, max_length=50)
    description: Optional[str] = Field(default=None, max_length=255)


class PermissionOut(BaseModel):
    id: str
    code: str
    name: str
    category: str
    description: Optional[str] = None
    is_builtin: bool
    model_config = {"from_attributes": True}


class RoleIn(BaseModel):
    role_name: str = Field(pattern=ROLE_PATTERN)
    description: Optional[str] = Field(default=None, max_length=255)
    permission_codes: list[str] = Field(default_factory=list)


class RolePatch(BaseModel):
    role_name: Optional[str] = Field(default=None, pattern=ROLE_PATTERN)
    description: Optional[str] = Field(default=None, max_length=255)


class RolePermissionsIn(BaseModel):
    permission_codes: list[str]


class RoleOut(BaseModel):
    id: str
    role_name: str
    description: Optional[str] = None
    is_system: bool
    user_count: int
    permissions: list[str]


def _perm_out(p: Permission) -> PermissionOut:
    return PermissionOut(
        id=p.id, code=p.code, name=p.name, category=p.category,
        description=p.description, is_builtin=p.code in DEFAULT_PERMISSIONS,
    )


def _role_out(db: Session, role: Role) -> RoleOut:
    if role.role_name == "admin":
        codes = sorted(p.code for p in db.query(Permission).all())
    else:
        codes = sorted(
            code for (code,) in db.query(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .filter(RolePermission.role_id == role.id).all()
        )
    users = db.query(UserRole).filter(UserRole.role_id == role.id).count()
    return RoleOut(
        id=role.id, role_name=role.role_name, description=role.description,
        is_system=bool(role.is_system), user_count=users, permissions=codes,
    )


def _resolve_codes(db: Session, codes: list[str]) -> list[Permission]:
    unique = sorted(set(codes))
    found = db.query(Permission).filter(Permission.code.in_(unique)).all() if unique else []
    missing = set(unique) - {p.code for p in found}
    if missing:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown permissions: {', '.join(sorted(missing))}")
    return found


def _get_role(db: Session, role_id: str) -> Role:
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role not found")
    return role


def _get_perm(db: Session, permission_id: str) -> Permission:
    perm = db.get(Permission, permission_id)
    if perm is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Permission not found")
    return perm


def _audit(db: Session, actor: User, action: str, rtype: str, rid: str, details: dict) -> None:
    AuditService.record(db=db, actor_id=actor.id, action=action, resource_type=rtype, resource_id=rid, details=details)


# ── Current user ────────────────────────────────────────────────

@router.get("/users/me/permissions", response_model=list[str])
def my_permissions(payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)):
    """Permission codes held by the signed-in user (used by the UI to show/hide actions)."""
    return sorted(permissions_for_user(db, load_active_user(db, payload)))


# ── Permissions ─────────────────────────────────────────────────

@router.get("/admin/permissions", response_model=list[PermissionOut])
def list_permissions(_: User = Depends(require_permission("roles.manage")), db: Session = Depends(get_db)):
    return [_perm_out(p) for p in db.query(Permission).order_by(Permission.category, Permission.code).all()]


@router.post("/admin/permissions", response_model=PermissionOut, status_code=201)
def create_permission(data: PermissionIn, actor: User = Depends(require_permission("roles.manage")), db: Session = Depends(get_db)):
    if db.query(Permission).filter(Permission.code == data.code).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "A permission with this code already exists")
    perm = Permission(**data.model_dump())
    db.add(perm)
    db.commit()
    db.refresh(perm)
    _audit(db, actor, "PERMISSION_CREATED", "permission", perm.id, {"code": perm.code})
    return _perm_out(perm)


@router.patch("/admin/permissions/{permission_id}", response_model=PermissionOut)
def update_permission(permission_id: str, data: PermissionPatch, actor: User = Depends(require_permission("roles.manage")), db: Session = Depends(get_db)):
    perm = _get_perm(db, permission_id)
    changes = data.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(perm, key, value)
    db.commit()
    db.refresh(perm)
    _audit(db, actor, "PERMISSION_UPDATED", "permission", perm.id, changes)
    return _perm_out(perm)


@router.delete("/admin/permissions/{permission_id}", status_code=204)
def delete_permission(permission_id: str, actor: User = Depends(require_permission("roles.manage")), db: Session = Depends(get_db)):
    perm = _get_perm(db, permission_id)
    if perm.code in DEFAULT_PERMISSIONS:
        raise HTTPException(status.HTTP_409_CONFLICT, "Built-in permissions are enforced by the API and cannot be deleted")
    code = perm.code
    db.delete(perm)
    db.commit()
    _audit(db, actor, "PERMISSION_DELETED", "permission", permission_id, {"code": code})
    return Response(status_code=204)


# ── Roles ───────────────────────────────────────────────────────

@router.get("/admin/roles", response_model=list[RoleOut])
def list_roles(_: User = Depends(require_permission("roles.manage")), db: Session = Depends(get_db)):
    roles = db.query(Role).order_by(Role.is_system.desc(), Role.role_name).all()
    return [_role_out(db, r) for r in roles]


@router.get("/admin/permission-matrix")
def permission_matrix(_: User = Depends(require_permission("roles.manage")), db: Session = Depends(get_db)):
    perms = db.query(Permission).order_by(Permission.category, Permission.code).all()
    roles = db.query(Role).order_by(Role.is_system.desc(), Role.role_name).all()
    return {
        "permissions": [_perm_out(p).model_dump() for p in perms],
        "roles": [_role_out(db, r).model_dump() for r in roles],
    }


@router.post("/admin/roles", response_model=RoleOut, status_code=201)
def create_role(data: RoleIn, actor: User = Depends(require_permission("roles.manage")), db: Session = Depends(get_db)):
    if db.query(Role).filter(Role.role_name == data.role_name).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "A role with this name already exists")
    perms = _resolve_codes(db, data.permission_codes)
    role = Role(role_name=data.role_name, description=data.description, is_system=False)
    db.add(role)
    db.flush()
    for p in perms:
        db.add(RolePermission(role_id=role.id, permission_id=p.id))
    db.commit()
    db.refresh(role)
    _audit(db, actor, "ROLE_CREATED", "role", role.id, {"role_name": role.role_name, "permissions": [p.code for p in perms]})
    return _role_out(db, role)


@router.patch("/admin/roles/{role_id}", response_model=RoleOut)
def update_role(role_id: str, data: RolePatch, actor: User = Depends(require_permission("roles.manage")), db: Session = Depends(get_db)):
    role = _get_role(db, role_id)
    changes = data.model_dump(exclude_unset=True)
    if "role_name" in changes and changes["role_name"] != role.role_name:
        if role.is_system:
            raise HTTPException(status.HTTP_409_CONFLICT, "Built-in roles cannot be renamed")
        if db.query(Role).filter(Role.role_name == changes["role_name"]).first():
            raise HTTPException(status.HTTP_409_CONFLICT, "A role with this name already exists")
    for key, value in changes.items():
        setattr(role, key, value)
    db.commit()
    db.refresh(role)
    _audit(db, actor, "ROLE_UPDATED", "role", role.id, changes)
    return _role_out(db, role)


@router.put("/admin/roles/{role_id}/permissions", response_model=RoleOut)
def set_role_permissions(role_id: str, data: RolePermissionsIn, actor: User = Depends(require_permission("roles.manage")), db: Session = Depends(get_db)):
    role = _get_role(db, role_id)
    if role.role_name == "admin":
        raise HTTPException(status.HTTP_409_CONFLICT, "The administrator role always holds every permission")
    perms = _resolve_codes(db, data.permission_codes)
    before = set(_role_out(db, role).permissions)
    db.query(RolePermission).filter(RolePermission.role_id == role.id).delete()
    for p in perms:
        db.add(RolePermission(role_id=role.id, permission_id=p.id))
    db.commit()
    after = {p.code for p in perms}
    _audit(db, actor, "ROLE_PERMISSIONS_CHANGED", "role", role.id, {
        "role_name": role.role_name,
        "granted": sorted(after - before),
        "revoked": sorted(before - after),
    })
    return _role_out(db, role)


@router.delete("/admin/roles/{role_id}", status_code=204)
def delete_role(role_id: str, actor: User = Depends(require_permission("roles.manage")), db: Session = Depends(get_db)):
    role = _get_role(db, role_id)
    if role.is_system:
        raise HTTPException(status.HTTP_409_CONFLICT, "Built-in roles cannot be deleted")
    if db.query(UserRole).filter(UserRole.role_id == role.id).count():
        raise HTTPException(status.HTTP_409_CONFLICT, "Remove this role from all users before deleting it")
    name = role.role_name
    db.query(RolePermission).filter(RolePermission.role_id == role.id).delete()
    db.delete(role)
    db.commit()
    _audit(db, actor, "ROLE_DELETED", "role", role_id, {"role_name": name})
    return Response(status_code=204)
