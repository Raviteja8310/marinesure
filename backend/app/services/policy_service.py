"""
Payment and Policy Lifecycle Service.
"""

import hmac
import hashlib
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.insurance import InsuranceApplication
from app.models.payment_policy import (
    PaymentOrder,
    PaymentTransaction,
    Policy,
    PolicyCancellation,
    PolicyEndorsement,
    PolicyRenewal,
)
from app.models.user import User
from app.services.pdf_service import generate_policy_certificate

settings = get_settings()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def next_policy_number(db: Session) -> str:
    count = db.query(Policy).count() + 1
    return f"POL-{_now():%Y}-{count:06d}"


def next_order_reference(db: Session) -> str:
    count = db.query(PaymentOrder).count() + 1
    return f"ORD-{_now():%Y}-{count:06d}"


def create_payment_order(db: Session, user: User, application_id: str) -> PaymentOrder:
    app_record = db.get(InsuranceApplication, application_id)
    if app_record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Insurance application not found")
    if app_record.customer_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not own this application")
    if app_record.status != "approved":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Application must be approved before payment (current status: {app_record.status})",
        )

    # Check if policy already exists
    existing_policy = db.query(Policy).filter(Policy.application_id == app_record.id).one_or_none()
    if existing_policy:
        raise HTTPException(status.HTTP_409_CONFLICT, "Policy has already been issued for this application")

    order = PaymentOrder(
        order_reference=next_order_reference(db),
        customer_id=user.id,
        application_id=app_record.id,
        gateway_order_id=f"order_test_{uuid.uuid4().hex[:12]}",
        amount=app_record.calculated_premium,
        currency="INR",
        status="created",
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def verify_payment_and_issue_policy(
    db: Session, user: User, order_id: str, gateway_payment_id: str, gateway_signature: str
) -> Policy:
    order = db.get(PaymentOrder, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment order not found")
    if order.customer_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    if order.status == "paid":
        raise HTTPException(status.HTTP_409_CONFLICT, "Payment order is already paid")

    # Verify signature if Razorpay keys are configured and not default
    if settings.RAZORPAY_KEY_SECRET and settings.RAZORPAY_KEY_SECRET != "change_me":
        msg = f"{order.gateway_order_id}|{gateway_payment_id}"
        expected = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
            msg.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, gateway_signature):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid payment signature")

    # Record transaction (idempotent check)
    existing_tx = db.query(PaymentTransaction).filter(PaymentTransaction.gateway_payment_id == gateway_payment_id).one_or_none()
    if existing_tx:
        raise HTTPException(status.HTTP_409_CONFLICT, "Transaction already processed")

    tx = PaymentTransaction(
        payment_order_id=order.id,
        gateway_payment_id=gateway_payment_id,
        gateway_signature=gateway_signature or "test_sig_verified",
        amount=order.amount,
        currency=order.currency,
        status="success",
    )
    db.add(tx)
    order.status = "paid"

    # Issue Policy
    app_record = order.application
    product = app_record.product

    today = date.today()
    expiry = today + timedelta(days=product.coverage_duration_days)

    policy = Policy(
        policy_number=next_policy_number(db),
        application_id=app_record.id,
        customer_id=order.customer_id,
        shipment_id=app_record.shipment_id,
        product_id=product.id,
        insured_amount=app_record.requested_insured_amount,
        premium_paid=order.amount,
        deductible_amount=max(
            order.amount * (product.deductible_percentage / Decimal("100.00")),
            product.min_deductible,
        ),
        effective_date=today,
        expiry_date=expiry,
        status="active",
    )
    db.add(policy)
    db.flush()

    # Generate PDF certificate
    pdf_key = generate_policy_certificate(
        policy=policy,
        application=app_record,
        shipment=app_record.shipment,
        product=product,
        customer=app_record.customer,
    )
    policy.pdf_storage_key = pdf_key

    db.commit()
    db.refresh(policy)
    return policy


def list_policies(db: Session, user: User) -> list[Policy]:
    roles = set(user.role_names)
    if roles & {"admin", "insurance_officer", "senior_officer"}:
        return db.query(Policy).order_by(Policy.created_at.desc()).all()
    return db.query(Policy).filter(Policy.customer_id == user.id).order_by(Policy.created_at.desc()).all()


def get_policy(db: Session, user: User, policy_id: str) -> Policy:
    policy = db.get(Policy, policy_id)
    if policy is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Policy not found")
    roles = set(user.role_names)
    if policy.customer_id != user.id and not (roles & {"admin", "insurance_officer", "senior_officer"}):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    return policy


def request_endorsement(db: Session, user: User, policy_id: str, requested_changes: str, reason: str) -> PolicyEndorsement:
    policy = get_policy(db, user, policy_id)
    if policy.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only active policies can be endorsed")
    endorsement = PolicyEndorsement(
        policy_id=policy.id,
        requested_changes=requested_changes,
        reason=reason,
        status="approved",  # simplified direct approval for demonstration
        officer_remarks="Endorsement automatically validated and approved.",
    )
    db.add(endorsement)
    db.commit()
    db.refresh(endorsement)
    return endorsement


def request_renewal(db: Session, user: User, policy_id: str) -> PolicyRenewal:
    policy = get_policy(db, user, policy_id)
    product = policy.product
    new_expiry = policy.expiry_date + timedelta(days=product.coverage_duration_days)

    renewal = PolicyRenewal(
        policy_id=policy.id,
        renewal_date=date.today(),
        new_expiry_date=new_expiry,
        premium_amount=policy.premium_paid,
        status="completed",
    )
    policy.expiry_date = new_expiry
    db.add(renewal)
    db.commit()
    db.refresh(renewal)
    return renewal


def request_cancellation(db: Session, user: User, policy_id: str, reason: str) -> PolicyCancellation:
    policy = get_policy(db, user, policy_id)
    if policy.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "Policy is not active")

    # Refund calculation: 90% refund if cancelled within 7 days
    days_active = (date.today() - policy.effective_date).days
    refund = policy.premium_paid * Decimal("0.90") if days_active <= 7 else Decimal("0.00")

    cancellation = PolicyCancellation(
        policy_id=policy.id,
        reason=reason,
        refund_amount=refund,
        status="approved",
    )
    policy.status = "cancelled"
    db.add(cancellation)
    db.commit()
    db.refresh(cancellation)
    return cancellation
