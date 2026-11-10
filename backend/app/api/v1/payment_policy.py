"""
REST APIs for Razorpay payments, policy generation, and lifecycle management.
"""

import os
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user_payload
from app.database.connection import get_db
from app.models.user import User
from app.schemas.payment_policy import (
    CancellationCreate,
    EndorsementCreate,
    PaymentOrderCreate,
    PaymentOrderOut,
    PaymentVerifyRequest,
    PolicyOut,
)
from app.services import policy_service

router = APIRouter(tags=["Payments & Policy Lifecycle"])


def _user(db: Session, payload: dict) -> User:
    user = db.get(User, payload["sub"])
    if user is None or user.status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is not active")
    return user


# ── Payments ─────────────────────────────────────────────────────

@router.get("/payments/gateway")
def payment_gateway_status(payload: dict = Depends(get_current_user_payload)):
    """How payments are verified on this server, so the UI never implies a real charge.

    - ``test``: no gateway secret and APP_ENV=development; payments are simulated and
      verified without a signature. No money moves.
    - ``live``: a gateway secret is configured; a signed gateway response is required.
    - ``unavailable``: no secret outside development; payments are refused.
    """
    from app.core.config import get_settings

    s = get_settings()
    configured = bool(s.RAZORPAY_KEY_SECRET) and s.RAZORPAY_KEY_SECRET != "change_me"
    if configured:
        mode = "live"
    elif s.APP_ENV.lower() == "development":
        mode = "test"
    else:
        mode = "unavailable"
    return {"mode": mode, "provider": "razorpay", "key_id": s.RAZORPAY_KEY_ID if configured else None,
            "checkout_integrated": False}


@router.post("/payments/create-order", response_model=PaymentOrderOut, status_code=201)
def create_payment_order(
    data: PaymentOrderCreate,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """Create Razorpay test payment order for an approved insurance application."""
    user = _user(db, payload)
    return policy_service.create_payment_order(db, user, data.application_id)


@router.post("/payments/{order_id}/verify", response_model=PolicyOut)
def verify_payment(
    order_id: str,
    data: PaymentVerifyRequest,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """Verify payment signature and issue insurance policy certificate."""
    user = _user(db, payload)
    return policy_service.verify_payment_and_issue_policy(
        db, user, order_id, data.gateway_payment_id, data.gateway_signature
    )


# ── Policies ─────────────────────────────────────────────────────

@router.get("/policies", response_model=list[PolicyOut])
def list_policies(
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """List issued insurance policies."""
    user = _user(db, payload)
    return policy_service.list_policies(db, user)


@router.get("/policies/{policy_id}", response_model=PolicyOut)
def get_policy(
    policy_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """Get policy details."""
    user = _user(db, payload)
    return policy_service.get_policy(db, user, policy_id)


@router.get("/policies/{policy_id}/certificate")
def download_certificate(
    policy_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """Download official ReportLab PDF insurance certificate."""
    user = _user(db, payload)
    policy = policy_service.get_policy(db, user, policy_id)
    if not policy.pdf_storage_key or not os.path.exists(policy.pdf_storage_key):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "PDF certificate file not found")
    return FileResponse(
        policy.pdf_storage_key,
        media_type="application/pdf",
        filename=f"MarineSure_Policy_{policy.policy_number.replace('/', '_')}.pdf",
    )


@router.post("/policies/{policy_id}/endorsements", status_code=201)
def request_endorsement(
    policy_id: str,
    data: EndorsementCreate,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """Request policy endorsement / amendment."""
    user = _user(db, payload)
    return policy_service.request_endorsement(db, user, policy_id, data.requested_changes, data.reason)


@router.post("/policies/{policy_id}/renewals", status_code=201)
def request_renewal(
    policy_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """Renew insurance policy."""
    user = _user(db, payload)
    return policy_service.request_renewal(db, user, policy_id)


@router.post("/policies/{policy_id}/cancellations", status_code=201)
def request_cancellation(
    policy_id: str,
    data: CancellationCreate,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """Cancel insurance policy and calculate refund."""
    user = _user(db, payload)
    return policy_service.request_cancellation(db, user, policy_id, data.reason)
