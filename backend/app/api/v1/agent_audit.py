"""
REST APIs for Agent Commissions, In-App Notifications, and Administrative Audit Logs.
"""

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user_payload
from app.database.connection import get_db
from app.models.user import User
from app.schemas.agent_audit import (
    AgentCommissionCreate,
    AgentCommissionOut,
    AuditLogOut,
    CommissionPayoutRequest,
    NotificationOut,
)
from app.services.agent_service import AgentService, AuditService, NotificationService

router = APIRouter(tags=["Agent Broker Portal, Notifications & Audit Logs"])


def _user(db: Session, payload: dict) -> User:
    user = db.get(User, payload["sub"])
    if user is None or user.status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is not active")
    return user


# ── Agent Portal & Commissions ──────────────────────────────────

@router.get("/agent/metrics")
def get_agent_metrics(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Retrieve performance and commission KPI metrics for the logged-in agent."""
    user = _user(db, user_payload)
    return AgentService.get_agent_metrics(db, user.id)


@router.get("/agent/commissions", response_model=List[AgentCommissionOut])
def list_agent_commissions(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """List commissions for logged-in agent or all commissions for officers/admins."""
    user = _user(db, user_payload)
    return AgentService.list_commissions(db, user)


@router.post("/agent/commissions/record", response_model=AgentCommissionOut, status_code=201)
def record_commission(
    payload: AgentCommissionCreate,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Link an agent to an issued policy and accrue sales commission."""
    user = _user(db, user_payload)
    return AgentService.record_policy_commission(
        db, agent=user, policy_id=payload.policy_id, commission_rate=payload.commission_rate
    )


@router.post("/agent/commissions/{commission_id}/payout", response_model=AgentCommissionOut)
def payout_commission(
    commission_id: str,
    payload: CommissionPayoutRequest,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Insurance officer executes commission payout disbursement to agent."""
    user = _user(db, user_payload)
    return AgentService.payout_commission(
        db, commission_id=commission_id, officer=user, payout_reference=payload.payout_reference
    )


# ── In-App Notifications ────────────────────────────────────────

@router.get("/notifications", response_model=List[NotificationOut])
def list_notifications(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Retrieve notifications for the authenticated user."""
    user = _user(db, user_payload)
    return NotificationService.list_for_user(db, user.id)


@router.post("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Mark a single notification as read."""
    user = _user(db, user_payload)
    return NotificationService.mark_as_read(db, notification_id, user.id)


@router.post("/notifications/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Mark all unread notifications as read."""
    user = _user(db, user_payload)
    updated = NotificationService.mark_all_read(db, user.id)
    return {"updated": updated}


# ── Audit Logs ──────────────────────────────────────────────────

@router.get("/audit-logs", response_model=List[AuditLogOut])
def list_audit_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Retrieve administrative compliance audit log trail (Admins & Officers only)."""
    user = _user(db, user_payload)
    if not (set(user.role_names) & {"admin", "insurance_officer", "senior_officer"}):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only administrators can view audit logs")
    return AuditService.list_logs(db, limit=limit)
