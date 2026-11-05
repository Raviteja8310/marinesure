"""
Insurance product, quotation, application, and underwriting models.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database.base import SoftDeleteMixin, TimestampMixin
from app.database.connection import Base


def _uuid() -> str:
    return str(uuid.uuid4())


APPLICATION_STATUSES = (
    "submitted",
    "under_review",
    "documents_required",
    "approved",
    "rejected",
    "withdrawn",
)


class InsuranceProduct(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "insurance_products"

    id = Column(String(36), primary_key=True, default=_uuid)
    product_code = Column(String(20), nullable=False, unique=True, index=True)
    product_name = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="active", index=True)
    min_insured_value = Column(Numeric(15, 2), nullable=False, default=10000.00)
    max_insured_value = Column(Numeric(15, 2), nullable=False, default=100000000.00)
    base_rate = Column(Numeric(6, 4), nullable=False, default=0.0050)  # e.g., 0.5%
    deductible_percentage = Column(Numeric(5, 2), nullable=False, default=5.00)  # e.g. 5%
    min_deductible = Column(Numeric(15, 2), nullable=False, default=5000.00)
    applicable_modes = Column(String(100), nullable=False, default="sea,air,road,rail,multimodal")
    coverage_duration_days = Column(Integer, nullable=False, default=30)
    terms_and_conditions = Column(Text, nullable=False)

    coverages = relationship(
        "ProductCoverage", back_populates="product", cascade="all, delete-orphan"
    )
    exclusions = relationship(
        "ProductExclusion", back_populates="product", cascade="all, delete-orphan"
    )
    premium_rules = relationship(
        "PremiumRule", back_populates="product", cascade="all, delete-orphan"
    )
    quotations = relationship("Quotation", back_populates="product")
    applications = relationship("InsuranceApplication", back_populates="product")


class ProductCoverage(Base):
    __tablename__ = "product_coverages"

    id = Column(String(36), primary_key=True, default=_uuid)
    product_id = Column(
        String(36), ForeignKey("insurance_products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    coverage_name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)

    product = relationship("InsuranceProduct", back_populates="coverages")


class ProductExclusion(Base):
    __tablename__ = "product_exclusions"

    id = Column(String(36), primary_key=True, default=_uuid)
    product_id = Column(
        String(36), ForeignKey("insurance_products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exclusion_name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)

    product = relationship("InsuranceProduct", back_populates="exclusions")


class PremiumRule(Base, TimestampMixin):
    __tablename__ = "premium_rules"

    id = Column(String(36), primary_key=True, default=_uuid)
    product_id = Column(
        String(36), ForeignKey("insurance_products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cargo_category = Column(String(80), nullable=False, default="*")  # '*' means all categories
    transport_mode = Column(String(20), nullable=False, default="*")
    rate_multiplier = Column(Numeric(6, 4), nullable=False, default=1.0000)
    additional_fee = Column(Numeric(10, 2), nullable=False, default=0.00)

    product = relationship("InsuranceProduct", back_populates="premium_rules")


class Quotation(Base, TimestampMixin):
    __tablename__ = "quotations"

    id = Column(String(36), primary_key=True, default=_uuid)
    quotation_number = Column(String(30), nullable=False, unique=True, index=True)
    customer_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    shipment_id = Column(String(36), ForeignKey("shipments.id"), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey("insurance_products.id"), nullable=False, index=True)
    insured_value = Column(Numeric(15, 2), nullable=False)
    rate_applied = Column(Numeric(6, 4), nullable=False)
    base_premium = Column(Numeric(15, 2), nullable=False)
    additional_charges = Column(Numeric(10, 2), nullable=False, default=500.00)
    tax_amount = Column(Numeric(15, 2), nullable=False)  # 18% GST
    total_premium = Column(Numeric(15, 2), nullable=False)
    deductible_amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="INR")
    status = Column(String(20), nullable=False, default="active", index=True)  # active, expired, converted
    valid_until = Column(DateTime(timezone=True), nullable=False)

    product = relationship("InsuranceProduct", back_populates="quotations")
    shipment = relationship("Shipment")
    customer = relationship("User")


class InsuranceApplication(Base, TimestampMixin):
    __tablename__ = "insurance_applications"

    id = Column(String(36), primary_key=True, default=_uuid)
    application_number = Column(String(30), nullable=False, unique=True, index=True)
    customer_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    shipment_id = Column(String(36), ForeignKey("shipments.id"), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey("insurance_products.id"), nullable=False, index=True)
    quotation_id = Column(String(36), ForeignKey("quotations.id"), nullable=True)
    requested_insured_amount = Column(Numeric(15, 2), nullable=False)
    calculated_premium = Column(Numeric(15, 2), nullable=False)
    status = Column(String(30), nullable=False, default="submitted", index=True)
    special_conditions = Column(Text, nullable=True)
    officer_remarks = Column(Text, nullable=True)
    reviewed_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    product = relationship("InsuranceProduct", back_populates="applications")
    shipment = relationship("Shipment")
    customer = relationship("User", foreign_keys=[customer_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    quotation = relationship("Quotation")
    underwriting_reviews = relationship(
        "UnderwritingReview", back_populates="application", cascade="all, delete-orphan"
    )


class UnderwritingReview(Base, TimestampMixin):
    __tablename__ = "underwriting_reviews"

    id = Column(String(36), primary_key=True, default=_uuid)
    application_id = Column(
        String(36), ForeignKey("insurance_applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    officer_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    risk_score = Column(String(20), nullable=False, default="low")  # low, medium, high
    risk_remarks = Column(Text, nullable=True)
    decision = Column(String(20), nullable=False)  # approved, rejected, info_requested

    application = relationship("InsuranceApplication", back_populates="underwriting_reviews")
    officer = relationship("User")
