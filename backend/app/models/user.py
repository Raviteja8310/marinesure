"""
User, role, profile, and authentication tables.

Public identifiers are UUIDs. Privileged roles (officer, senior officer,
administrator) are never self-assigned at registration.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database.base import TimestampMixin
from app.database.connection import Base

# Roles a person may choose when registering. Privileged roles are assigned
# only by an administrator.
SELF_REGISTER_ROLES = (
    "customer",
    "shipping_company",
    "surveyor",
    "agent",
)

PRIVILEGED_ROLES = (
    "insurance_officer",
    "senior_officer",
    "admin",
)

ALL_ROLES = SELF_REGISTER_ROLES + PRIVILEGED_ROLES


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(150), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="pending", index=True)
    email_verified = Column(Boolean, nullable=False, default=False)
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    roles = relationship(
        "Role", secondary="user_roles", back_populates="users", lazy="selectin"
    )
    customer_profile = relationship(
        "CustomerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    shipping_profile = relationship(
        "ShippingCompanyProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    surveyor_profile = relationship(
        "SurveyorProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    agent_profile = relationship(
        "AgentProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    officer_profile = relationship(
        "OfficerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    login_history = relationship(
        "LoginHistory", back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def role_names(self) -> list[str]:
        return [role.role_name for role in self.roles]

    @property
    def is_locked(self) -> bool:
        if self.locked_until is None:
            return False
        lu = self.locked_until
        if lu.tzinfo is None:
            lu = lu.replace(tzinfo=timezone.utc)
        return lu > datetime.now(timezone.utc)


class Role(Base):
    __tablename__ = "roles"

    id = Column(String(36), primary_key=True, default=_uuid)
    role_name = Column(String(50), nullable=False, unique=True)
    description = Column(String(255), nullable=True)
    # Built-in roles cannot be renamed or deleted from the permission editor.
    is_system = Column(Boolean, nullable=False, default=False)

    users = relationship("User", secondary="user_roles", back_populates="roles")


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_role"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(String(36), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)


class CustomerProfile(Base, TimestampMixin):
    __tablename__ = "customer_profiles"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    customer_type = Column(String(30), nullable=False, default="importer")
    company_name = Column(String(200), nullable=True)
    phone = Column(String(30), nullable=True)
    address = Column(Text, nullable=True)
    country = Column(String(80), nullable=True)

    user = relationship("User", back_populates="customer_profile")


class ShippingCompanyProfile(Base, TimestampMixin):
    __tablename__ = "shipping_company_profiles"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    company_name = Column(String(200), nullable=False)
    registration_number = Column(String(80), nullable=True)
    phone = Column(String(30), nullable=True)
    address = Column(Text, nullable=True)

    user = relationship("User", back_populates="shipping_profile")


class SurveyorProfile(Base, TimestampMixin):
    __tablename__ = "surveyor_profiles"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    qualification = Column(String(200), nullable=True)
    license_number = Column(String(80), nullable=True)
    verification_status = Column(String(20), nullable=False, default="pending")
    phone = Column(String(30), nullable=True)

    user = relationship("User", back_populates="surveyor_profile")


class AgentProfile(Base, TimestampMixin):
    __tablename__ = "agent_profiles"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    agency_name = Column(String(200), nullable=False)
    license_number = Column(String(80), nullable=True)
    phone = Column(String(30), nullable=True)

    user = relationship("User", back_populates="agent_profile")


class OfficerProfile(Base, TimestampMixin):
    __tablename__ = "officer_profiles"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    employee_code = Column(String(40), nullable=False, unique=True)
    department = Column(String(80), nullable=True)
    designation = Column(String(80), nullable=True)

    user = relationship("User", back_populates="officer_profile")


class EmailVerification(Base):
    __tablename__ = "email_verifications"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(128), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(128), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    refresh_token_hash = Column(String(128), nullable=False, unique=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    user_agent = Column(String(255), nullable=True)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user = relationship("User", back_populates="sessions")


class LoginHistory(Base):
    __tablename__ = "login_history"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    email = Column(String(255), nullable=False)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False)
    detail = Column(String(255), nullable=True)
    login_time = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user = relationship("User", back_populates="login_history")
