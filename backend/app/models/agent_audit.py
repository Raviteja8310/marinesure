"""
Database models for Agent Commissions, In-App Notifications, and Administrative Audit Logs.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    JSON,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database.base import TimestampMixin
from app.database.connection import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class AgentCommission(Base, TimestampMixin):
    """Commission earned by an authorized marine insurance agent or broker."""

    __tablename__ = "agent_commissions"

    id = Column(String(36), primary_key=True, default=_uuid)
    commission_reference = Column(String(32), unique=True, nullable=False, index=True)

    agent_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    policy_id = Column(
        String(36), ForeignKey("policies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    customer_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    premium_amount = Column(Numeric(15, 2), nullable=False)
    commission_rate = Column(Numeric(5, 2), nullable=False, default=10.00)  # e.g., 10%
    commission_amount = Column(Numeric(15, 2), nullable=False)

    status = Column(
        String(30), nullable=False, default="accrued", index=True
    )  # accrued, approved, paid
    payout_reference = Column(String(100), nullable=True)
    paid_at = Column(DateTime, nullable=True)

    # Relationships
    agent = relationship("User", foreign_keys=[agent_id], backref="commissions_earned")
    customer = relationship("User", foreign_keys=[customer_id], backref="agent_commissions")
    policy = relationship("Policy", backref="commission_records")


class Notification(Base):
    """In-app alert notification sent to a user for application/claim/policy updates."""

    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(
        String(30), nullable=False, default="info"
    )  # info, success, warning, alert
    link = Column(String(255), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", backref="notifications")


class AuditLog(Base):
    """Tamper-evident record of compliance, underwriting, claim settlement, and security actions."""

    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=_uuid)
    actor_id = Column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action = Column(String(80), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False, index=True)
    resource_id = Column(String(100), nullable=True, index=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    actor = relationship("User", foreign_keys=[actor_id], backref="audit_actions")
