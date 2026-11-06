"""
Pydantic schemas for Agent Commissions, Notifications, and Audit Logs.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


# ── Agent Commissions ──────────────────────────────────────────

class AgentCommissionCreate(BaseModel):
    policy_id: str
    commission_rate: Optional[Decimal] = Field(default=Decimal("10.00"), ge=1, le=50)


class CommissionPayoutRequest(BaseModel):
    payout_reference: Optional[str] = None


class AgentCommissionOut(BaseModel):
    id: str
    commission_reference: str
    agent_id: str
    policy_id: str
    customer_id: str
    premium_amount: Decimal
    commission_rate: Decimal
    commission_amount: Decimal
    status: str
    payout_reference: Optional[str]
    paid_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Notifications ──────────────────────────────────────────────

class NotificationCreate(BaseModel):
    user_id: str
    title: str = Field(..., max_length=200)
    message: str
    notification_type: str = Field(default="info", pattern="^(info|success|warning|alert)$")
    link: Optional[str] = None


class NotificationOut(BaseModel):
    id: str
    user_id: str
    title: str
    message: str
    notification_type: str
    link: Optional[str]
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Audit Logs ─────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: str
    actor_id: Optional[str]
    action: str
    resource_type: str
    resource_id: Optional[str]
    details: Optional[Dict[str, Any]]
    ip_address: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
