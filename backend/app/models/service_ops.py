"""Grievances (customer complaints) and surveyor inspection appointments."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database.base import TimestampMixin
from app.database.connection import Base


def _uuid() -> str:
    return str(uuid.uuid4())


GRIEVANCE_CATEGORIES = (
    "claim_dispute",
    "policy_service",
    "payment_issue",
    "settlement_delay",
    "surveyor_conduct",
    "other",
)
GRIEVANCE_PRIORITIES = ("low", "medium", "high", "urgent")
GRIEVANCE_TRANSITIONS = {
    "open": {"in_progress", "rejected"},
    "in_progress": {"resolved", "rejected", "open"},
    "resolved": {"closed", "in_progress"},
    "rejected": {"closed", "in_progress"},
    "closed": set(),
}


class Grievance(Base, TimestampMixin):
    __tablename__ = "grievances"

    id = Column(String(36), primary_key=True, default=_uuid)
    grievance_number = Column(String(32), nullable=False, unique=True, index=True)
    customer_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(30), nullable=False)
    priority = Column(String(10), nullable=False, default="medium")
    subject = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    related_claim_id = Column(String(36), ForeignKey("claims.id", ondelete="SET NULL"), nullable=True)
    related_policy_id = Column(String(36), ForeignKey("policies.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20), nullable=False, default="open", index=True)
    assigned_to_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    resolution = Column(Text, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    customer = relationship("User", foreign_keys=[customer_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    comments = relationship(
        "GrievanceComment", back_populates="grievance", cascade="all, delete-orphan",
        order_by="GrievanceComment.created_at",
    )
    attachments = relationship(
        "GrievanceAttachment", back_populates="grievance", cascade="all, delete-orphan"
    )


class GrievanceComment(Base):
    __tablename__ = "grievance_comments"

    id = Column(String(36), primary_key=True, default=_uuid)
    grievance_id = Column(String(36), ForeignKey("grievances.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    message = Column(Text, nullable=False)
    is_internal = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    grievance = relationship("Grievance", back_populates="comments")
    author = relationship("User")


class GrievanceAttachment(Base):
    __tablename__ = "grievance_attachments"

    id = Column(String(36), primary_key=True, default=_uuid)
    grievance_id = Column(String(36), ForeignKey("grievances.id", ondelete="CASCADE"), nullable=False, index=True)
    original_filename = Column(String(255), nullable=False)
    storage_key = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    uploaded_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    grievance = relationship("Grievance", back_populates="attachments")


class InspectionAppointment(Base, TimestampMixin):
    __tablename__ = "inspection_appointments"

    id = Column(String(36), primary_key=True, default=_uuid)
    appointment_number = Column(String(32), nullable=False, unique=True, index=True)
    claim_id = Column(String(36), ForeignKey("claims.id", ondelete="CASCADE"), nullable=False, index=True)
    surveyor_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    scheduled_start = Column(DateTime, nullable=False, index=True)
    scheduled_end = Column(DateTime, nullable=False)
    location = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="scheduled", index=True)  # scheduled, completed, cancelled
    notes = Column(Text, nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    reschedule_count = Column(Integer, nullable=False, default=0)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    claim = relationship("Claim", backref="inspection_appointments")
    surveyor = relationship("User", foreign_keys=[surveyor_id])
