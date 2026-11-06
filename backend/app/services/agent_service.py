"""
Business services for Agent commissions, Notifications, and Audit logging.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models.agent_audit import AgentCommission, AuditLog, Notification
from app.models.payment_policy import Policy
from app.models.user import User


class NotificationService:

    @staticmethod
    def send(
        db: Session,
        user_id: str,
        title: str,
        message: str,
        notification_type: str = "info",
        link: Optional[str] = None,
    ) -> Notification:
        note = Notification(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
            link=link,
            is_read=False,
            created_at=datetime.now(timezone.utc),
        )
        db.add(note)
        db.commit()
        db.refresh(note)
        return note

    @staticmethod
    def list_for_user(db: Session, user_id: str, limit: int = 50) -> List[Notification]:
        return (
            db.query(Notification)
            .filter(Notification.user_id == user_id)
            .order_by(desc(Notification.created_at))
            .limit(limit)
            .all()
        )

    @staticmethod
    def mark_as_read(db: Session, notification_id: str, user_id: str) -> Notification:
        note = (
            db.query(Notification)
            .filter(Notification.id == notification_id, Notification.user_id == user_id)
            .first()
        )
        if not note:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
        note.is_read = True
        db.commit()
        db.refresh(note)
        return note

    @staticmethod
    def mark_all_read(db: Session, user_id: str) -> int:
        count = (
            db.query(Notification)
            .filter(Notification.user_id == user_id, Notification.is_read == False)
            .update({"is_read": True})
        )
        db.commit()
        return count


class AuditService:

    @staticmethod
    def record(
        db: Session,
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        actor_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        log = AuditLog(
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details or {},
            ip_address=ip_address,
            created_at=datetime.now(timezone.utc),
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def list_logs(db: Session, limit: int = 100) -> List[AuditLog]:
        return db.query(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit).all()


class AgentService:

    @staticmethod
    def generate_commission_reference(db: Session) -> str:
        year = datetime.now(timezone.utc).year
        prefix = f"COM-{year}-"
        last = (
            db.query(AgentCommission)
            .filter(AgentCommission.commission_reference.startswith(prefix))
            .order_by(desc(AgentCommission.commission_reference))
            .first()
        )
        if not last:
            return f"{prefix}000001"
        try:
            seq = int(last.commission_reference.split("-")[-1]) + 1
        except Exception:
            seq = 1
        return f"{prefix}{seq:06d}"

    @classmethod
    def record_policy_commission(
        cls,
        db: Session,
        agent: User,
        policy_id: str,
        commission_rate: Decimal = Decimal("10.00"),
    ) -> AgentCommission:
        if "agent" not in agent.role_names and not (set(agent.role_names) & {"admin", "insurance_officer"}):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "User is not an authorized agent")

        policy = db.query(Policy).filter(Policy.id == policy_id).first()
        if not policy:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Policy not found")

        # Check if commission already recorded for this policy
        existing = (
            db.query(AgentCommission)
            .filter(AgentCommission.policy_id == policy.id, AgentCommission.agent_id == agent.id)
            .first()
        )
        if existing:
            return existing

        commission_amount = round(
            policy.premium_paid * (commission_rate / Decimal("100.0")), 2
        )
        ref = cls.generate_commission_reference(db)

        commission = AgentCommission(
            commission_reference=ref,
            agent_id=agent.id,
            policy_id=policy.id,
            customer_id=policy.customer_id,
            premium_amount=policy.premium_paid,
            commission_rate=commission_rate,
            commission_amount=commission_amount,
            status="accrued",
        )
        db.add(commission)
        db.commit()
        db.refresh(commission)

        # Notify agent
        NotificationService.send(
            db=db,
            user_id=agent.id,
            title="Commission Accrued",
            message=f"₹{commission_amount:,.2f} commission credited for Policy {policy.policy_number}.",
            notification_type="success",
            link="/agent/commissions",
        )

        # Audit log
        AuditService.record(
            db=db,
            actor_id=agent.id,
            action="COMMISSION_ACCRUED",
            resource_type="agent_commission",
            resource_id=commission.id,
            details={"policy_number": policy.policy_number, "commission": float(commission_amount)},
        )

        return commission

    @classmethod
    def list_commissions(cls, db: Session, current_user: User) -> List[AgentCommission]:
        if "agent" in current_user.role_names and not (set(current_user.role_names) & {"admin", "insurance_officer"}):
            return (
                db.query(AgentCommission)
                .filter(AgentCommission.agent_id == current_user.id)
                .order_by(desc(AgentCommission.created_at))
                .all()
            )
        return (
            db.query(AgentCommission)
            .order_by(desc(AgentCommission.created_at))
            .all()
        )

    @classmethod
    def payout_commission(
        cls,
        db: Session,
        commission_id: str,
        officer: User,
        payout_reference: Optional[str] = None,
    ) -> AgentCommission:
        if not (set(officer.role_names) & {"insurance_officer", "senior_officer", "admin"}):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only officers can execute commission payouts")

        comm = db.query(AgentCommission).filter(AgentCommission.id == commission_id).first()
        if not comm:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Commission not found")

        if comm.status == "paid":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Commission has already been paid")

        comm.status = "paid"
        comm.paid_at = datetime.now(timezone.utc)
        comm.payout_reference = payout_reference or f"PAY-COM-{datetime.now(timezone.utc):%Y%m%d}-{comm.id[:6]}"

        db.commit()
        db.refresh(comm)

        # Notify agent
        NotificationService.send(
            db=db,
            user_id=comm.agent_id,
            title="Commission Disbursed",
            message=f"Commission payout of ₹{comm.commission_amount:,.2f} completed (Ref: {comm.payout_reference}).",
            notification_type="success",
            link="/agent/commissions",
        )

        # Audit log
        AuditService.record(
            db=db,
            actor_id=officer.id,
            action="COMMISSION_PAYOUT",
            resource_type="agent_commission",
            resource_id=comm.id,
            details={"payout_reference": comm.payout_reference, "amount": float(comm.commission_amount)},
        )

        return comm

    @classmethod
    def get_agent_metrics(cls, db: Session, agent_id: str) -> Dict[str, Any]:
        commissions = db.query(AgentCommission).filter(AgentCommission.agent_id == agent_id).all()
        total_earned = sum((c.commission_amount for c in commissions), Decimal("0"))
        paid_amount = sum((c.commission_amount for c in commissions if c.status == "paid"), Decimal("0"))
        pending_amount = sum((c.commission_amount for c in commissions if c.status in ("accrued", "approved")), Decimal("0"))

        unique_customers = len(set(c.customer_id for c in commissions))
        policies_sold = len(commissions)

        return {
            "total_commission_earned": float(total_earned),
            "paid_commission": float(paid_amount),
            "pending_commission": float(pending_amount),
            "policies_sold": policies_sold,
            "referred_customers_count": unique_customers,
        }
