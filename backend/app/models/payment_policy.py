"""
Payment, policy, endorsement, renewal, and cancellation models.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
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

from app.database.base import TimestampMixin
from app.database.connection import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class PaymentOrder(Base, TimestampMixin):
    __tablename__ = "payment_orders"

    id = Column(String(36), primary_key=True, default=_uuid)
    order_reference = Column(String(50), nullable=False, unique=True, index=True)
    customer_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    application_id = Column(String(36), ForeignKey("insurance_applications.id"), nullable=False, index=True)
    gateway_order_id = Column(String(100), nullable=True)
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="INR")
    status = Column(String(30), nullable=False, default="created", index=True)  # created, paid, failed

    customer = relationship("User")
    application = relationship("InsuranceApplication")
    transactions = relationship("PaymentTransaction", back_populates="payment_order", cascade="all, delete-orphan")


class PaymentTransaction(Base, TimestampMixin):
    __tablename__ = "payment_transactions"

    id = Column(String(36), primary_key=True, default=_uuid)
    payment_order_id = Column(String(36), ForeignKey("payment_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    gateway_payment_id = Column(String(100), nullable=False, unique=True)
    gateway_signature = Column(String(255), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="INR")
    status = Column(String(30), nullable=False, default="success")  # success, refunded

    payment_order = relationship("PaymentOrder", back_populates="transactions")


class Policy(Base, TimestampMixin):
    __tablename__ = "policies"

    id = Column(String(36), primary_key=True, default=_uuid)
    policy_number = Column(String(30), nullable=False, unique=True, index=True)
    application_id = Column(String(36), ForeignKey("insurance_applications.id"), nullable=False, unique=True)
    customer_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    shipment_id = Column(String(36), ForeignKey("shipments.id"), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey("insurance_products.id"), nullable=False)
    insured_amount = Column(Numeric(15, 2), nullable=False)
    premium_paid = Column(Numeric(15, 2), nullable=False)
    deductible_amount = Column(Numeric(15, 2), nullable=False)
    effective_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=False)
    status = Column(String(30), nullable=False, default="active", index=True)  # active, expired, cancelled, renewed
    pdf_storage_key = Column(String(255), nullable=True)

    application = relationship("InsuranceApplication")
    customer = relationship("User")
    shipment = relationship("Shipment")
    product = relationship("InsuranceProduct")
    endorsements = relationship("PolicyEndorsement", back_populates="policy", cascade="all, delete-orphan")
    renewals = relationship("PolicyRenewal", back_populates="policy", cascade="all, delete-orphan")
    cancellation = relationship("PolicyCancellation", back_populates="policy", uselist=False, cascade="all, delete-orphan")


class PolicyEndorsement(Base, TimestampMixin):
    __tablename__ = "policy_endorsements"

    id = Column(String(36), primary_key=True, default=_uuid)
    policy_id = Column(String(36), ForeignKey("policies.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_changes = Column(Text, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="approved")  # pending, approved, rejected
    officer_remarks = Column(Text, nullable=True)

    policy = relationship("Policy", back_populates="endorsements")


class PolicyRenewal(Base, TimestampMixin):
    __tablename__ = "policy_renewals"

    id = Column(String(36), primary_key=True, default=_uuid)
    policy_id = Column(String(36), ForeignKey("policies.id", ondelete="CASCADE"), nullable=False, index=True)
    renewal_date = Column(Date, nullable=False)
    new_expiry_date = Column(Date, nullable=False)
    premium_amount = Column(Numeric(15, 2), nullable=False)
    status = Column(String(30), nullable=False, default="completed")

    policy = relationship("Policy", back_populates="renewals")


class PolicyCancellation(Base, TimestampMixin):
    __tablename__ = "policy_cancellations"

    id = Column(String(36), primary_key=True, default=_uuid)
    policy_id = Column(String(36), ForeignKey("policies.id", ondelete="CASCADE"), nullable=False, unique=True)
    reason = Column(Text, nullable=False)
    refund_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    status = Column(String(30), nullable=False, default="approved")

    policy = relationship("Policy", back_populates="cancellation")
