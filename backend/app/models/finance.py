"""
Financial ledger, claim settlements, and reconciliation runs.

``LedgerEntry`` rows are append-only: the ORM refuses updates and deletes, and
each row carries a SHA-256 hash chained to the previous row so tampering at the
database level is detectable (see ``ledger_service.verify_chain``). Corrections
are made by posting a reversal entry, never by editing.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    event,
)
from sqlalchemy.orm import relationship

from app.database.base import TimestampMixin
from app.database.connection import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utc_now_seconds() -> datetime:
    """Naive UTC timestamp truncated to seconds so it hashes identically on every DB."""
    return datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)


LEDGER_ACCOUNTS = (
    "cash",
    "premium_income",
    "premium_refunds",
    "claims_paid",
    "commission_expense",
    "adjustments",
)

ENTRY_TYPES = (
    "premium_received",
    "premium_refund",
    "claim_payout",
    "commission_payout",
    "adjustment",
    "reversal",
)


class ImmutableLedgerError(RuntimeError):
    """Raised when code attempts to modify or delete a posted ledger entry."""


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(String(36), primary_key=True, default=_uuid)
    sequence = Column(Integer, nullable=False, unique=True, index=True)
    entry_number = Column(String(32), nullable=False, unique=True, index=True)
    entry_type = Column(String(30), nullable=False, index=True)
    debit_account = Column(String(40), nullable=False, index=True)
    credit_account = Column(String(40), nullable=False, index=True)
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="INR")
    reference_type = Column(String(40), nullable=True, index=True)
    reference_id = Column(String(64), nullable=True, index=True)
    external_reference = Column(String(120), nullable=True, index=True)
    description = Column(String(255), nullable=False)
    reverses_entry_id = Column(String(36), ForeignKey("ledger_entries.id"), nullable=True, unique=True)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    posted_at = Column(DateTime, nullable=False, default=_utc_now_seconds, index=True)
    prev_hash = Column(String(64), nullable=False)
    entry_hash = Column(String(64), nullable=False, unique=True)

    created_by = relationship("User", foreign_keys=[created_by_id])


@event.listens_for(LedgerEntry, "before_update")
def _block_ledger_update(mapper, connection, target):  # pragma: no cover - guard
    raise ImmutableLedgerError("Ledger entries are immutable; post a reversal instead")


@event.listens_for(LedgerEntry, "before_delete")
def _block_ledger_delete(mapper, connection, target):  # pragma: no cover - guard
    raise ImmutableLedgerError("Ledger entries cannot be deleted")


class Settlement(Base, TimestampMixin):
    """Payout record for an approved claim. Status changes are mirrored in the ledger."""

    __tablename__ = "settlements"

    id = Column(String(36), primary_key=True, default=_uuid)
    settlement_number = Column(String(32), nullable=False, unique=True, index=True)
    claim_id = Column(String(36), ForeignKey("claims.id", ondelete="RESTRICT"), nullable=False, unique=True)
    customer_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    approved_amount = Column(Numeric(14, 2), nullable=False)
    deductible_amount = Column(Numeric(14, 2), nullable=False, default=0)
    net_amount = Column(Numeric(14, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="INR")
    status = Column(String(20), nullable=False, default="paid", index=True)  # paid, failed
    payout_method = Column(String(30), nullable=False, default="bank_transfer")
    payout_reference = Column(String(100), nullable=True, index=True)
    paid_at = Column(DateTime, nullable=True)
    failure_reason = Column(Text, nullable=True)
    reconciled = Column(Boolean, nullable=False, default=False, index=True)
    reconciled_at = Column(DateTime, nullable=True)
    processed_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    history = Column(JSON, nullable=False, default=list)

    claim = relationship("Claim", backref="settlement_record")
    customer = relationship("User", foreign_keys=[customer_id])


class PayoutReference(Base):
    """Every bank/UTR reference ever used for an outgoing payout. The unique key
    makes reuse impossible even under concurrent requests."""

    __tablename__ = "payout_references"

    reference = Column(String(100), primary_key=True)
    source_type = Column(String(30), nullable=False)  # settlement, agent_commission
    source_id = Column(String(36), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=_utc_now_seconds)


class ReconciliationRun(Base):
    """Comparison of an external statement (gateway or bank) against internal records."""

    __tablename__ = "reconciliation_runs"

    id = Column(String(36), primary_key=True, default=_uuid)
    run_number = Column(String(32), nullable=False, unique=True, index=True)
    source = Column(String(30), nullable=False)  # payment_gateway, bank_payouts
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    statement_total = Column(Numeric(15, 2), nullable=False)
    ledger_total = Column(Numeric(15, 2), nullable=False)
    difference = Column(Numeric(15, 2), nullable=False)
    matched_count = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False)  # matched, mismatched
    results = Column(JSON, nullable=False, default=dict)
    notes = Column(Text, nullable=True)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utc_now_seconds)
