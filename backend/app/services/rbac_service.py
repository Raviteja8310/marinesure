"""
Permission catalogue, default role-permission matrix, and the
``require_permission`` dependency used by API routes.
"""

from typing import Iterable

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user_payload
from app.database.connection import get_db
from app.models.rbac import Permission, RolePermission
from app.models.user import Role, User

# code -> (name, category, description)
DEFAULT_PERMISSIONS: dict[str, tuple[str, str, str]] = {
    "users.view": ("View users", "administration", "List registered user accounts"),
    "users.manage": ("Manage users", "administration", "Assign roles and change account status"),
    "roles.manage": ("Manage roles & permissions", "administration", "Edit the role-permission matrix"),
    "audit.view": ("View audit logs", "administration", "Read the compliance audit trail"),
    "products.view": ("View products", "products", "Browse the insurance product catalogue"),
    "products.manage": ("Manage products", "products", "Create, edit, activate and deactivate products"),
    "finance.view": ("View financial ledger", "finance", "Read ledger entries and financial reports"),
    "finance.manage": ("Post ledger adjustments", "finance", "Post manual adjustments and reversals"),
    "finance.reconcile": ("Run reconciliation", "finance", "Reconcile gateway and bank statements"),
    "payments.view_all": ("View all payments", "finance", "See payment history for every customer"),
    "settlements.view": ("View all settlements", "claims", "See every claim settlement"),
    "settlements.manage": ("Manage settlements", "claims", "Mark payouts failed and retry them"),
    "claims.review": ("Review claims", "claims", "Approve or reject claims"),
    "claims.settle": ("Settle claims", "claims", "Execute claim settlement payouts"),
    "grievances.create": ("Raise grievances", "service", "Register complaints and disputes"),
    "grievances.manage": ("Handle grievances", "service", "Assign, respond to and resolve grievances"),
    "inspections.manage": ("Schedule inspections", "claims", "Create, reschedule and cancel inspections"),
    "inspections.view_all": ("View all inspections", "claims", "See every surveyor's inspection calendar"),
    "assistant.use": ("Use AI assistant", "service", "Ask the policy/product assistant questions"),
}

STAFF = ("insurance_officer", "senior_officer")

DEFAULT_ROLE_PERMISSIONS: dict[str, Iterable[str]] = {
    "customer": ("grievances.create", "assistant.use", "products.view"),
    "shipping_company": ("assistant.use", "products.view"),
    "surveyor": ("assistant.use", "products.view"),
    "agent": ("assistant.use", "products.view"),
    "insurance_officer": (
        "products.view", "claims.review", "claims.settle", "settlements.view", "settlements.manage",
        "grievances.manage", "inspections.manage", "inspections.view_all", "payments.view_all",
        "audit.view", "assistant.use",
    ),
    "senior_officer": (
        "products.view", "claims.review", "claims.settle", "settlements.view", "settlements.manage",
        "grievances.manage", "inspections.manage", "inspections.view_all", "payments.view_all",
        "finance.view", "finance.reconcile", "audit.view", "assistant.use",
    ),
    "admin": tuple(DEFAULT_PERMISSIONS.keys()),
}


def seed_permissions(db: Session) -> None:
    """Insert missing permissions and, for roles that have no mappings yet, the defaults.

    Roles that an administrator has already configured are left untouched so
    restarts never undo manual edits.
    """
    existing = {p.code: p for p in db.query(Permission).all()}
    for code, (name, category, description) in DEFAULT_PERMISSIONS.items():
        if code not in existing:
            perm = Permission(code=code, name=name, category=category, description=description)
            db.add(perm)
            existing[code] = perm
    db.flush()

    for role_name, codes in DEFAULT_ROLE_PERMISSIONS.items():
        role = db.query(Role).filter(Role.role_name == role_name).one_or_none()
        if role is None:
            continue
        has_any = db.query(RolePermission).filter(RolePermission.role_id == role.id).first()
        if has_any:
            continue
        for code in codes:
            db.add(RolePermission(role_id=role.id, permission_id=existing[code].id))
    db.commit()


def permissions_for_user(db: Session, user: User) -> set[str]:
    role_ids = [r.id for r in user.roles]
    if not role_ids:
        return set()
    if "admin" in user.role_names:
        return {p.code for p in db.query(Permission).all()} | set(DEFAULT_PERMISSIONS)
    rows = (
        db.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role_id.in_(role_ids))
        .all()
    )
    return {code for (code,) in rows}


def has_permission(db: Session, user: User, code: str) -> bool:
    return "admin" in user.role_names or code in permissions_for_user(db, user)


def role_permissions(db: Session, role: Role) -> set[str]:
    if role.role_name == "admin":
        return {p.code for p in db.query(Permission).all()} | set(DEFAULT_PERMISSIONS)
    rows = (
        db.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role_id == role.id)
        .all()
    )
    return {code for (code,) in rows}


def ensure_can_grant_role(db: Session, actor: User, role: Role) -> None:
    """Non-admins may only hand out custom roles whose permissions they already hold.

    Built-in roles also carry authority through their name (e.g. "surveyor",
    "insurance_officer" are checked directly in services), so only an
    administrator may assign them.
    """
    if "admin" in actor.role_names:
        return
    if role.is_system or role.role_name in DEFAULT_ROLE_PERMISSIONS:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an administrator can assign built-in roles")
    missing = role_permissions(db, role) - permissions_for_user(db, actor)
    if missing:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"You cannot assign a role with permissions you do not hold: {', '.join(sorted(missing))}",
        )


def ensure_can_manage_user(db: Session, actor: User, target: User) -> None:
    """Non-admins may not act on admins or on anyone holding permissions they lack."""
    if "admin" in actor.role_names:
        return
    target_roles, actor_roles = set(target.role_names), set(actor.role_names) | {"customer"}
    if (
        "admin" in target_roles
        or not target_roles <= actor_roles | {r.role_name for r in target.roles if not r.is_system}
        or not permissions_for_user(db, target) <= permissions_for_user(db, actor)
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot manage a user with more privileges than you")


def load_active_user(db: Session, payload: dict) -> User:
    user = db.get(User, payload.get("sub"))
    if user is None or user.status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is not active")
    return user


def require_permission(*codes: str):
    """Dependency: the current user must hold at least one of ``codes``.

    Permissions are read from the database on each request, so changes in the
    role-permission matrix apply immediately without re-issuing tokens.
    """

    def _check(
        payload: dict = Depends(get_current_user_payload),
        db: Session = Depends(get_db),
    ) -> User:
        user = load_active_user(db, payload)
        if "admin" in user.role_names:
            return user
        granted = permissions_for_user(db, user)
        if not any(code in granted for code in codes):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Missing permission: {' or '.join(codes)}",
            )
        return user

    return _check
