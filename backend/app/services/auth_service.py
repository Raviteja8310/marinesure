"""
Authentication business rules.

Tokens are stored only as SHA-256 hashes. Privileged roles cannot be taken
during self-registration, and a user cannot change their own roles.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.user import (
    PRIVILEGED_ROLES,
    SELF_REGISTER_ROLES,
    AgentProfile,
    CustomerProfile,
    EmailVerification,
    LoginHistory,
    OfficerProfile,
    PasswordResetToken,
    Role,
    ShippingCompanyProfile,
    SurveyorProfile,
    User,
    UserSession,
)

settings = get_settings()

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
VERIFY_HOURS = 24
RESET_MINUTES = 30

ROLE_DESCRIPTIONS = {
    "customer": "Registers shipments and manages policies and claims",
    "shipping_company": "Registers shipments and updates tracking",
    "surveyor": "Inspects assigned claims and submits survey reports",
    "agent": "Assists assigned customers with quotations",
    "insurance_officer": "Underwrites applications and processes claims",
    "senior_officer": "Approves high-value applications and settlements",
    "admin": "Configures the platform; no underwriting authority",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _utc(dt: datetime | None) -> datetime | None:
    """Normalize a database datetime to UTC. SQLite drops the timezone offset."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def seed_roles(db: Session) -> None:
    """Insert the seven platform roles if they are missing."""
    existing = {row.role_name for row in db.query(Role.role_name).all()}
    for name, description in ROLE_DESCRIPTIONS.items():
        if name not in existing:
            db.add(Role(role_name=name, description=description))
    db.commit()


def _role(db: Session, name: str) -> Role:
    role = db.query(Role).filter(Role.role_name == name).one_or_none()
    if role is None:
        seed_roles(db)
        role = db.query(Role).filter(Role.role_name == name).one()
    return role


def profile_dict(user: User) -> dict:
    if user.customer_profile:
        p = user.customer_profile
        return {
            "kind": "customer",
            "customer_type": p.customer_type,
            "company_name": p.company_name,
            "phone": p.phone,
            "address": p.address,
            "country": p.country,
        }
    if user.shipping_profile:
        p = user.shipping_profile
        return {
            "kind": "shipping_company",
            "company_name": p.company_name,
            "registration_number": p.registration_number,
            "phone": p.phone,
            "address": p.address,
        }
    if user.surveyor_profile:
        p = user.surveyor_profile
        return {
            "kind": "surveyor",
            "qualification": p.qualification,
            "license_number": p.license_number,
            "verification_status": p.verification_status,
            "phone": p.phone,
        }
    if user.agent_profile:
        p = user.agent_profile
        return {
            "kind": "agent",
            "agency_name": p.agency_name,
            "license_number": p.license_number,
            "phone": p.phone,
        }
    if user.officer_profile:
        p = user.officer_profile
        return {
            "kind": "officer",
            "employee_code": p.employee_code,
            "department": p.department,
            "designation": p.designation,
        }
    return {}


def public_user(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "status": user.status,
        "email_verified": user.email_verified,
        "roles": user.role_names,
        "created_at": user.created_at,
        "last_login_at": user.last_login_at,
        "profile": profile_dict(user),
    }


def _attach_profile(user: User, data) -> None:
    if data.role == "customer":
        user.customer_profile = CustomerProfile(
            customer_type=data.customer_type,
            company_name=data.company_name,
            phone=data.phone,
            country=data.country,
        )
    elif data.role == "shipping_company":
        if not data.company_name:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Company name is required")
        user.shipping_profile = ShippingCompanyProfile(
            company_name=data.company_name,
            registration_number=data.registration_number,
            phone=data.phone,
        )
    elif data.role == "surveyor":
        user.surveyor_profile = SurveyorProfile(
            qualification=data.qualification,
            license_number=data.license_number,
            phone=data.phone,
        )
    elif data.role == "agent":
        if not (data.agency_name or data.company_name):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Agency name is required")
        user.agent_profile = AgentProfile(
            agency_name=data.agency_name or data.company_name,
            license_number=data.license_number,
            phone=data.phone,
        )


def register_user(db: Session, data) -> tuple[User, str]:
    if data.role not in SELF_REGISTER_ROLES:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "This role can only be assigned by an administrator",
        )
    existing = db.query(User).filter(User.email == data.email.lower()).one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    user = User(
        name=data.name.strip(),
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        status="pending",
    )
    user.roles.append(_role(db, data.role))
    _attach_profile(user, data)
    db.add(user)
    db.flush()
    token = _issue_email_token(db, user)
    db.commit()
    db.refresh(user)
    return user, token


def _issue_email_token(db: Session, user: User) -> str:
    raw = secrets.token_urlsafe(32)
    db.add(
        EmailVerification(
            user_id=user.id,
            token_hash=_hash_token(raw),
            expires_at=_now() + timedelta(hours=VERIFY_HOURS),
        )
    )
    return raw


def verify_email(db: Session, token: str) -> User:
    record = (
        db.query(EmailVerification)
        .filter(EmailVerification.token_hash == _hash_token(token))
        .one_or_none()
    )
    if record is None or record.used_at is not None or _utc(record.expires_at) < _now():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Verification link is invalid or expired")
    user = db.get(User, record.user_id)
    record.used_at = _now()
    user.email_verified = True
    if user.status == "pending":
        user.status = "active"
    db.commit()
    db.refresh(user)
    return user


def resend_verification(db: Session, email: str) -> str | None:
    user = db.query(User).filter(User.email == email.lower()).one_or_none()
    if user is None or user.email_verified:
        return None
    token = _issue_email_token(db, user)
    db.commit()
    return token


def _record_login(db: Session, email: str, outcome: str, detail: str, request, user=None) -> None:
    db.add(
        LoginHistory(
            user_id=user.id if user else None,
            email=email.lower(),
            ip_address=request.client.host if request and request.client else None,
            user_agent=(request.headers.get("user-agent", "")[:255] if request else None),
            status=outcome,
            detail=detail,
        )
    )


def authenticate(db: Session, email: str, password: str, request) -> dict:
    user = db.query(User).filter(User.email == email.lower()).one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        if user is not None:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
                user.locked_until = _now() + timedelta(minutes=LOCKOUT_MINUTES)
                user.failed_login_attempts = 0
        _record_login(db, email, "failed", "invalid credentials", request, user)
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")

    if user.is_locked:
        _record_login(db, email, "blocked", "account locked", request, user)
        db.commit()
        raise HTTPException(
            status.HTTP_423_LOCKED,
            "Account is temporarily locked after repeated failed attempts",
        )
    if user.status == "suspended":
        _record_login(db, email, "blocked", "account suspended", request, user)
        db.commit()
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been suspended")
    if not user.email_verified or user.status != "active":
        _record_login(db, email, "blocked", "email not verified", request, user)
        db.commit()
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Verify your email before signing in")

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = _now()
    _record_login(db, email, "success", "login", request, user)
    tokens = _open_session(db, user, request)
    db.commit()
    return {**tokens, "user": public_user(user)}


def _open_session(db: Session, user: User, request) -> dict:
    refresh = create_refresh_token({"sub": user.id})
    db.add(
        UserSession(
            user_id=user.id,
            refresh_token_hash=_hash_token(refresh),
            expires_at=_now() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
            ip_address=request.client.host if request and request.client else None,
            user_agent=(request.headers.get("user-agent", "")[:255] if request else None),
        )
    )
    access = create_access_token({"sub": user.id, "roles": user.role_names})
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}


def rotate_refresh(db: Session, refresh_token: str, request) -> dict:
    from app.core.security import decode_token

    payload = decode_token(refresh_token)
    session = (
        db.query(UserSession)
        .filter(UserSession.refresh_token_hash == _hash_token(refresh_token))
        .one_or_none()
    )
    invalid = (
        payload is None
        or payload.get("type") != "refresh"
        or session is None
        or session.revoked_at is not None
        or _utc(session.expires_at) < _now()
    )
    if invalid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token is invalid or expired")
    user = db.get(User, session.user_id)
    if user is None or user.status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is not active")
    # Rotation: the presented refresh token can never be used again.
    session.revoked_at = _now()
    tokens = _open_session(db, user, request)
    db.commit()
    return {**tokens, "user": public_user(user)}


def logout(db: Session, refresh_token: str) -> None:
    session = (
        db.query(UserSession)
        .filter(UserSession.refresh_token_hash == _hash_token(refresh_token))
        .one_or_none()
    )
    if session and session.revoked_at is None:
        session.revoked_at = _now()
        db.commit()


def request_password_reset(db: Session, email: str) -> str | None:
    user = db.query(User).filter(User.email == email.lower()).one_or_none()
    if user is None:
        return None
    raw = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=_hash_token(raw),
            expires_at=_now() + timedelta(minutes=RESET_MINUTES),
        )
    )
    db.commit()
    return raw


def reset_password(db: Session, token: str, new_password: str) -> None:
    record = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == _hash_token(token))
        .one_or_none()
    )
    if record is None or record.used_at is not None or _utc(record.expires_at) < _now():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reset link is invalid or expired")
    user = db.get(User, record.user_id)
    user.password_hash = hash_password(new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    record.used_at = _now()
    # A reset ends every existing session.
    for session in user.sessions:
        if session.revoked_at is None:
            session.revoked_at = _now()
    db.commit()


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    if current_password == new_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose a password you have not used")
    user.password_hash = hash_password(new_password)
    db.commit()


def update_profile(db: Session, user: User, data) -> User:
    if data.name:
        user.name = data.name.strip()
    profile = (
        user.customer_profile
        or user.shipping_profile
        or user.surveyor_profile
        or user.agent_profile
    )
    if profile is not None:
        for field in ("phone", "address", "country", "qualification", "customer_type"):
            value = getattr(data, field, None)
            if value is not None and hasattr(profile, field):
                setattr(profile, field, value)
        if data.company_name is not None and hasattr(profile, "company_name"):
            profile.company_name = data.company_name
        if data.company_name is not None and hasattr(profile, "agency_name"):
            profile.agency_name = data.company_name
    db.commit()
    db.refresh(user)
    return user


def set_status(db: Session, user: User, new_status: str) -> User:
    user.status = new_status
    if new_status == "suspended":
        for session in user.sessions:
            if session.revoked_at is None:
                session.revoked_at = _now()
    db.commit()
    db.refresh(user)
    return user


def assign_role(db: Session, actor: User, target: User, role_name: str, data) -> User:
    if actor.id == target.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot change your own roles")
    if role_name in PRIVILEGED_ROLES and "admin" not in actor.role_names:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only an administrator can assign this role"
        )
    role = _role(db, role_name)
    if role not in target.roles:
        target.roles.append(role)
    if role_name in ("insurance_officer", "senior_officer", "admin"):
        if target.officer_profile is None:
            if not data.employee_code:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    "An employee code is required for an officer role",
                )
            target.officer_profile = OfficerProfile(
                employee_code=data.employee_code,
                department=data.department,
                designation=role_name,
            )
        if target.status == "pending":
            target.status = "active"
            target.email_verified = True
    db.commit()
    db.refresh(target)
    return target


def get_user(db: Session, user_id: str) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user
