"""Database models for incidents, insurance claims, and marine surveyor reports."""

import uuid
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


class Incident(Base, TimestampMixin):
    """An incident or casualty reported during cargo transit."""

    __tablename__ = "incidents"

    id = Column(String(36), primary_key=True, default=_uuid)
    incident_number = Column(String(32), unique=True, nullable=False, index=True)

    shipment_id = Column(
        String(36), ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    policy_id = Column(
        String(36), ForeignKey("policies.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reported_by_id = Column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    incident_date = Column(DateTime, nullable=False)
    incident_type = Column(String(60), nullable=False)  # cargo_damage, water_ingress, collision, etc.
    severity = Column(String(30), nullable=False, default="moderate")  # minor, moderate, severe, total_loss
    location_name = Column(String(255), nullable=True)
    location_coordinates = Column(String(100), nullable=True)  # "lat,lng"

    description = Column(Text, nullable=False)
    estimated_loss = Column(Numeric(14, 2), nullable=True, default=0)
    status = Column(String(40), nullable=False, default="reported")  # reported, under_investigation, claim_filed, closed
    photos_documents = Column(JSON, nullable=True, default=list)

    # Relationships
    shipment = relationship("Shipment", backref="incidents")
    policy = relationship("Policy", backref="incidents")
    reported_by = relationship("User", foreign_keys=[reported_by_id])
    claims = relationship("Claim", back_populates="incident", cascade="all, delete-orphan")


class Claim(Base, TimestampMixin):
    """An insurance claim filed by an insured customer against an active policy."""

    __tablename__ = "claims"

    id = Column(String(36), primary_key=True, default=_uuid)
    claim_number = Column(String(32), unique=True, nullable=False, index=True)

    policy_id = Column(
        String(36), ForeignKey("policies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    incident_id = Column(
        String(36), ForeignKey("incidents.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    claimant_id = Column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    assigned_surveyor_id = Column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reviewed_by_id = Column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    claim_amount = Column(Numeric(14, 2), nullable=False)
    approved_amount = Column(Numeric(14, 2), nullable=True)
    deductible_applied = Column(Numeric(14, 2), nullable=True, default=0)
    net_payable = Column(Numeric(14, 2), nullable=True, default=0)

    status = Column(
        String(40), nullable=False, default="submitted"
    )  # submitted, surveyor_assigned, inspection_completed, under_review, approved, rejected, settled
    claim_type = Column(
        String(50), nullable=False, default="partial_loss"
    )  # partial_loss, total_loss, general_average, salvage

    claimant_notes = Column(Text, nullable=True)
    officer_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    settlement_reference = Column(String(100), nullable=True)
    settled_at = Column(DateTime, nullable=True)
    supporting_documents = Column(JSON, nullable=True, default=list)

    # Relationships
    policy = relationship("Policy", backref="claims")
    incident = relationship("Incident", back_populates="claims")
    claimant = relationship("User", foreign_keys=[claimant_id])
    assigned_surveyor = relationship("User", foreign_keys=[assigned_surveyor_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    survey_reports = relationship(
        "SurveyReport", back_populates="claim", cascade="all, delete-orphan"
    )


class SurveyReport(Base, TimestampMixin):
    """An independent physical cargo inspection report conducted by a Marine Surveyor."""

    __tablename__ = "survey_reports"

    id = Column(String(36), primary_key=True, default=_uuid)
    report_number = Column(String(32), unique=True, nullable=False, index=True)

    claim_id = Column(
        String(36), ForeignKey("claims.id", ondelete="CASCADE"), nullable=False, index=True
    )
    surveyor_id = Column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    inspection_date = Column(DateTime, nullable=False)
    inspection_location = Column(String(255), nullable=False)

    damage_assessment = Column(Text, nullable=False)
    cause_of_loss = Column(String(100), nullable=False)
    is_covered_peril = Column(Boolean, nullable=False, default=True)

    estimated_loss_amount = Column(Numeric(14, 2), nullable=False)
    salvage_value = Column(Numeric(14, 2), nullable=False, default=0)
    recommended_settlement = Column(Numeric(14, 2), nullable=False)

    evidence_photos = Column(JSON, nullable=True, default=list)
    status = Column(String(30), nullable=False, default="submitted")  # draft, submitted, accepted, rejected
    officer_comments = Column(Text, nullable=True)

    # Relationships
    claim = relationship("Claim", back_populates="survey_reports")
    surveyor = relationship("User", foreign_keys=[surveyor_id])
