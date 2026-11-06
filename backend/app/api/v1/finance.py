"""Payment history, claim settlements, immutable ledger, and reconciliation APIs."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user_payload
from app.database.connection import get_db
from app.models.finance import ENTRY_TYPES, LEDGER_ACCOUNTS, ReconciliationRun, Settlement
from app.models.payment_policy import PaymentOrder, Policy
from app.models.user import User
from app.services import finance_service
from app.services.agent_service import AuditService, NotificationService
from app.services.rbac_service import has_permission, load_active_user, require_permission

router = APIRouter(tags=["Finance, Ledger & Settlements"])


# ── Schemas ─────────────────────────────────────────────────────

class PaymentTransactionOut(BaseModel):
    id: str
    gateway_payment_id: str
    amount: Decimal
    currency: str
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}


class PaymentHistoryOut(BaseModel):
    id: str
    order_reference: str
    customer_id: str
    customer_name: Optional[str] = None
    application_id: str
    gateway_order_id: Optional[str]
    amount: Decimal
    currency: str
    status: str
    policy_number: Optional[str] = None
    receipt_reference: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: datetime
    transactions: list[PaymentTransactionOut]


class SettlementOut(BaseModel):
    id: str
    settlement_number: str
    claim_id: str
    claim_number: Optional[str] = None
    customer_id: str
    approved_amount: Decimal
    deductible_amount: Decimal
    net_amount: Decimal
    currency: str
    status: str
    payout_method: str
    payout_reference: Optional[str]
    paid_at: Optional[datetime]
    failure_reason: Optional[str]
    reconciled: bool
    reconciled_at: Optional[datetime]
    history: list
    created_at: datetime


class SettlementFail(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


class SettlementRetry(BaseModel):
    payout_reference: str = Field(min_length=4, max_length=100)


class LedgerEntryOut(BaseModel):
    id: str
    sequence: int
    entry_number: str
    entry_type: str
    debit_account: str
    credit_account: str
    amount: Decimal
    currency: str
    reference_type: Optional[str]
    reference_id: Optional[str]
    external_reference: Optional[str]
    description: str
    reverses_entry_id: Optional[str]
    created_by_id: Optional[str]
    posted_at: datetime
    prev_hash: str
    entry_hash: str
    model_config = {"from_attributes": True}


class AdjustmentIn(BaseModel):
    debit_account: Literal[LEDGER_ACCOUNTS]  # type: ignore[valid-type]
    credit_account: Literal[LEDGER_ACCOUNTS]  # type: ignore[valid-type]
    amount: Decimal = Field(gt=0, max_digits=15, decimal_places=2)
    description: str = Field(min_length=5, max_length=255)
    external_reference: Optional[str] = Field(default=None, max_length=120)


class ReversalIn(BaseModel):
    reason: str = Field(min_length=5, max_length=200)


class StatementLine(BaseModel):
    reference: str = Field(min_length=1, max_length=120)
    amount: Decimal = Field(ge=0, max_digits=15, decimal_places=2)


class ReconciliationIn(BaseModel):
    source: Literal["payment_gateway", "bank_payouts"]
    period_start: date
    period_end: date
    lines: list[StatementLine] = Field(max_length=10000)
    notes: Optional[str] = Field(default=None, max_length=1000)


class ReconciliationOut(BaseModel):
    id: str
    run_number: str
    source: str
    period_start: datetime
    period_end: datetime
    statement_total: Decimal
    ledger_total: Decimal
    difference: Decimal
    matched_count: int
    status: str
    results: dict
    notes: Optional[str]
    created_by_id: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


def _active(payload: dict, db: Session) -> User:
    return load_active_user(db, payload)


# ── Payments ────────────────────────────────────────────────────

def _payment_out(db: Session, order: PaymentOrder) -> PaymentHistoryOut:
    policy = db.query(Policy).filter(Policy.application_id == order.application_id).one_or_none()
    txs = sorted(order.transactions, key=lambda t: t.created_at)
    success = next((t for t in txs if t.status == "success"), None)
    return PaymentHistoryOut(
        id=order.id, order_reference=order.order_reference, customer_id=order.customer_id,
        customer_name=order.customer.name if order.customer else None,
        application_id=order.application_id, gateway_order_id=order.gateway_order_id,
        amount=order.amount, currency=order.currency, status=order.status,
        policy_number=policy.policy_number if policy and order.status == "paid" else None,
        receipt_reference=success.gateway_payment_id if success else None,
        paid_at=success.created_at if success else None,
        created_at=order.created_at,
        transactions=[PaymentTransactionOut.model_validate(t) for t in txs],
    )


@router.get("/payments", response_model=list[PaymentHistoryOut])
def list_payments(payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)):
    """Customers see their own payments; staff with payments.view_all see every payment."""
    user = _active(payload, db)
    q = db.query(PaymentOrder)
    if not has_permission(db, user, "payments.view_all"):
        q = q.filter(PaymentOrder.customer_id == user.id)
    return [_payment_out(db, o) for o in q.order_by(PaymentOrder.created_at.desc()).all()]


@router.get("/payments/{order_id}", response_model=PaymentHistoryOut)
def get_payment(order_id: str, payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)):
    user = _active(payload, db)
    order = db.get(PaymentOrder, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment order not found")
    if order.customer_id != user.id and not has_permission(db, user, "payments.view_all"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    return _payment_out(db, order)


# ── Settlements ─────────────────────────────────────────────────

def _settlement_out(s: Settlement) -> SettlementOut:
    return SettlementOut(
        id=s.id, settlement_number=s.settlement_number, claim_id=s.claim_id,
        claim_number=s.claim.claim_number if s.claim else None, customer_id=s.customer_id,
        approved_amount=s.approved_amount, deductible_amount=s.deductible_amount, net_amount=s.net_amount,
        currency=s.currency, status=s.status, payout_method=s.payout_method,
        payout_reference=s.payout_reference, paid_at=s.paid_at, failure_reason=s.failure_reason,
        reconciled=bool(s.reconciled), reconciled_at=s.reconciled_at, history=s.history or [],
        created_at=s.created_at,
    )


@router.get("/settlements/me", response_model=list[SettlementOut])
def my_settlements(payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)):
    user = _active(payload, db)
    rows = db.query(Settlement).filter(Settlement.customer_id == user.id).order_by(Settlement.created_at.desc()).all()
    return [_settlement_out(s) for s in rows]


@router.get("/settlements", response_model=list[SettlementOut])
def list_settlements(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    _: User = Depends(require_permission("settlements.view")),
    db: Session = Depends(get_db),
):
    q = db.query(Settlement)
    if status_filter:
        q = q.filter(Settlement.status == status_filter)
    return [_settlement_out(s) for s in q.order_by(Settlement.created_at.desc()).all()]


@router.get("/settlements/{settlement_id}", response_model=SettlementOut)
def get_settlement(settlement_id: str, payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)):
    user = _active(payload, db)
    s = finance_service.get_settlement(db, settlement_id)
    if s.customer_id != user.id and not has_permission(db, user, "settlements.view"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    return _settlement_out(s)


@router.post("/settlements/{settlement_id}/mark-failed", response_model=SettlementOut)
def fail_settlement(settlement_id: str, data: SettlementFail, actor: User = Depends(require_permission("settlements.manage")), db: Session = Depends(get_db)):
    """Record a bounced/failed payout. The ledger payout entry is reversed."""
    s = finance_service.mark_settlement_failed(db, finance_service.get_settlement(db, settlement_id), data.reason, actor)
    NotificationService.send(db, s.customer_id, "Settlement payout failed",
                             f"Payout for settlement {s.settlement_number} failed: {data.reason}. Our team will retry.",
                             "warning", "/customer/settlements")
    AuditService.record(db, "SETTLEMENT_FAILED", "settlement", s.id, actor.id, {"reason": data.reason})
    return _settlement_out(s)


@router.post("/settlements/{settlement_id}/retry", response_model=SettlementOut)
def retry_settlement(settlement_id: str, data: SettlementRetry, actor: User = Depends(require_permission("settlements.manage")), db: Session = Depends(get_db)):
    s = finance_service.retry_settlement(db, finance_service.get_settlement(db, settlement_id), data.payout_reference, actor)
    NotificationService.send(db, s.customer_id, "Settlement paid",
                             f"Settlement {s.settlement_number} of ₹{s.net_amount:,.2f} has been paid (Ref: {s.payout_reference}).",
                             "success", "/customer/settlements")
    AuditService.record(db, "SETTLEMENT_RETRIED", "settlement", s.id, actor.id, {"payout_reference": s.payout_reference})
    return _settlement_out(s)


# ── Ledger ──────────────────────────────────────────────────────

@router.get("/finance/ledger", response_model=list[LedgerEntryOut])
def list_ledger(
    entry_type: Optional[str] = Query(default=None),
    account: Optional[str] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_permission("finance.view")),
    db: Session = Depends(get_db),
):
    if entry_type and entry_type not in ENTRY_TYPES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown entry type")
    if account and account not in LEDGER_ACCOUNTS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown account")
    return finance_service.list_entries(db, entry_type, account, date_from, date_to, limit, offset)


@router.get("/finance/ledger/verify")
def verify_ledger(_: User = Depends(require_permission("finance.view")), db: Session = Depends(get_db)):
    """Recompute the hash chain to prove no entry was altered, removed, or inserted."""
    return finance_service.verify_chain(db)


@router.get("/finance/ledger/{entry_id}", response_model=LedgerEntryOut)
def get_ledger_entry(entry_id: str, _: User = Depends(require_permission("finance.view")), db: Session = Depends(get_db)):
    return finance_service.get_entry(db, entry_id)


@router.post("/finance/ledger/adjustments", response_model=LedgerEntryOut, status_code=201)
def post_adjustment(data: AdjustmentIn, actor: User = Depends(require_permission("finance.manage")), db: Session = Depends(get_db)):
    entry = finance_service.post_entry(
        db, entry_type="adjustment", amount=data.amount, debit_account=data.debit_account,
        credit_account=data.credit_account, description=data.description,
        external_reference=data.external_reference, reference_type="manual_adjustment", actor=actor,
    )
    db.commit()
    AuditService.record(db, "LEDGER_ADJUSTMENT", "ledger_entry", entry.id, actor.id,
                        {"amount": str(entry.amount), "debit": entry.debit_account, "credit": entry.credit_account})
    return entry


@router.post("/finance/ledger/{entry_id}/reverse", response_model=LedgerEntryOut, status_code=201)
def reverse_entry(entry_id: str, data: ReversalIn, actor: User = Depends(require_permission("finance.manage")), db: Session = Depends(get_db)):
    original = finance_service.get_entry(db, entry_id)
    if original.reference_type == "settlement":
        raise HTTPException(status.HTTP_409_CONFLICT, "Settlement payouts are reversed via the settlement mark-failed action")
    entry = finance_service.post_reversal(db, original, data.reason, actor)
    db.commit()
    AuditService.record(db, "LEDGER_REVERSAL", "ledger_entry", entry.id, actor.id,
                        {"reverses": original.entry_number, "reason": data.reason})
    return entry


@router.get("/finance/summary")
def financial_summary(
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    _: User = Depends(require_permission("finance.view")),
    db: Session = Depends(get_db),
):
    """Financial report derived exclusively from immutable ledger entries."""
    return _money_strings(finance_service.summary(db, date_from, date_to))


def _money_strings(value):
    """Serialise Decimals as fixed-point strings, matching the rest of the API."""
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    if isinstance(value, dict):
        return {k: _money_strings(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_money_strings(v) for v in value]
    return value


# ── Reconciliation ─────────────────────────────────────────────

@router.post("/finance/reconciliations", response_model=ReconciliationOut, status_code=201)
def run_reconciliation(data: ReconciliationIn, actor: User = Depends(require_permission("finance.reconcile")), db: Session = Depends(get_db)):
    run = finance_service.reconcile(
        db, source=data.source, period_start=data.period_start, period_end=data.period_end,
        lines=[l.model_dump() for l in data.lines], actor=actor, notes=data.notes,
    )
    AuditService.record(db, "RECONCILIATION_RUN", "reconciliation_run", run.id, actor.id,
                        {"status": run.status, "difference": str(run.difference)})
    return run


@router.get("/finance/reconciliations", response_model=list[ReconciliationOut])
def list_reconciliations(_: User = Depends(require_permission("finance.view", "finance.reconcile")), db: Session = Depends(get_db)):
    return db.query(ReconciliationRun).order_by(ReconciliationRun.created_at.desc()).limit(200).all()


@router.get("/finance/reconciliations/{run_id}", response_model=ReconciliationOut)
def get_reconciliation(run_id: str, _: User = Depends(require_permission("finance.view", "finance.reconcile")), db: Session = Depends(get_db)):
    run = db.get(ReconciliationRun, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reconciliation run not found")
    return run
