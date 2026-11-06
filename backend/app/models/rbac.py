"""
Fine-grained permissions and the role-permission matrix.

Roles (``roles`` table) group users. Permissions are named capabilities such as
``finance.view``; the ``role_permissions`` table maps roles to permissions and
is what backend dependencies check. The administrator role always passes.
"""

import uuid

from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database.base import TimestampMixin
from app.database.connection import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Permission(Base, TimestampMixin):
    __tablename__ = "permissions"

    id = Column(String(36), primary_key=True, default=_uuid)
    code = Column(String(80), nullable=False, unique=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(String(255), nullable=True)
    category = Column(String(50), nullable=False, default="general", index=True)

    role_links = relationship(
        "RolePermission", back_populates="permission", cascade="all, delete-orphan"
    )


class RolePermission(Base):
    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    role_id = Column(String(36), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_id = Column(
        String(36), ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False, index=True
    )

    permission = relationship("Permission", back_populates="role_links")
    role = relationship("Role")
