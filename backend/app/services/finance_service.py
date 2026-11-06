"""
Immutable ledger, claim settlements, and statement reconciliation.

Every money movement (premium received, refund, claim payout, commission
payout) posts a ledger entry in the same database transaction as the business
change. Callers own the commit; ``post_entry`` only flushes.
"""

import hashlib
from collections import Counter
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Iterable, Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.claim_incident import Claim
from app.models.finance import (
    LEDGER_ACCOUNTS,
    LedgerEntry,
    PayoutReference,
    ReconciliationRun,
    Settlement,
    _utc_now_seconds,
)
from app.models.user import User

GENESIS_HASH = "0" * 64
CENT = Decimal("0.01")

# entry_type -> (debit account, credit account)
POSTING_RULES = {
    "premium_received": ("cash", "premium_income"),
    "premium_refund": ("premium_refunds", "cash"),
    "claim_payout": ("claims_paid", "cash"),
    "commission_payout": ("commission_expense", "cash"),
}


def _money(value) -> Decimal:
    return Decimal(str(value)).quantize(CENT)


def _hash_fields(entry: LedgerEntry) -> str:
    parts = [
        str(entry.sequence),
        entry.entry_number,
        entry.entry_type,
        entry.debit_account,
        entry.credit_account,
        f"{_money(entry.amount):.2f}",
        entry.currency,
        entry.reference_type or "",
        entry.reference_id or "",
        entry.external_reference or "",
        entry.description,
        entry.reverses_entry_id or "",
        entry.created_by_id or "",
        entry.posted_at.strftime("%Y-%m-%dT%H:%M:%S"),
        entry.prev_hash,
    ]
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


# ── Ledger ──────────────────────────────────────────────────────

def post_entry(
    db: Session,
    *,
    entry_type: str,
    amount,
    description: str,
    debit_account: Optional[str] = None,
    credit_account: Optional[str] = None,
    currency: str = "INR",
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
    external_reference: Optional[str] = None,
    reverses_entry_id: Optional[str] = None,
    actor: Optional[User] = None,
) -> LedgerEntry:
    amount = _money(amount)
    if amount <= 0:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Ledger amount must be positive")
    if entry_type in POSTING_RULES:
        debit_account, credit_account = POSTING_RULES[entry_type]
    if debit_account not in LEDGER_ACCOUNTS or credit_account not in LEDGER_ACCOUNTS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown ledger account")
    if debit_account == credit_account:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Debit and credit accounts must differ")

    last = (
        db.query(LedgerEntry)
        .order_by(LedgerEntry.sequence.desc())
        .with_for_update()
        .first()
    )
    sequence = (last.sequence + 1) if last else 1
    entry = LedgerEntry(
        sequence=sequence,
        entry_number=f"LED-{sequence:08d}",
        entry_type=entry_type,
        debit_account=debit_account,
        credit_account=credit_account,
        amount=amount,
        currency=currency,
        reference_type=reference_type,
        reference_id=reference_id,
        external_reference=external_reference,
        description=description[:255],
        reverses_entry_id=reverses_entry_id,
        created_by_id=actor.id if actor else None,
        posted_at=_utc_now_seconds(),
        prev_hash=last.entry_hash if last else GENESIS_HASH,
    )
    entry.entry_hash = _hash_fields(entry)
    db.add(entry)
    db.flush()
    return entry


def reversed_ids(db: Session) -> set[str]:
    return {
        rid for (rid,) in db.query(LedgerEntry.reverses_entry_id)
        .filter(LedgerEntry.reverses_entry_id.isnot(None)).all()
    }


def post_reversal(db: Session, entry: LedgerEntry, reason: str, actor: Optional[User]) -> LedgerEntry:
    if entry.entry_type == "reversal":
        raise HTTPException(status.HTTP_409_CONFLICT, "A reversal entry cannot itself be reversed")
    if entry.id in reversed_ids(db):
        raise HTTPException(status.HTTP_409_CONFLICT, "This entry has already been reversed")
    return post_entry(
        db,
        entry_type="reversal",
        amount=entry.amount,
        currency=entry.currency,
        debit_account=entry.credit_account,
        credit_account=entry.debit_account,
        reference_type=entry.reference_type,
        reference_id=entry.reference_id,
        external_reference=entry.external_reference,
        reverses_entry_id=entry.id,
        description=f"Reversal of {entry.entry_number}: {reason}",
        actor=actor,
    )


def get_entry(db: Session, entry_id: str) -> LedgerEntry:
    entry = db.get(LedgerEntry, entry_id)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ledger entry not found")
    return entry


def _day_range(date_from: Optional[date], date_to: Optional[date]):
    start = datetime.combine(date_from, time.min) if date_from else None
    end = datetime.combine(date_to + timedelta(days=1), time.min) if date_to else None
    return start, end


def list_entries(
    db: Session,
    entry_type: Optional[str] = None,
    account: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: int = 200,
    offset: int = 0,
) -> list[LedgerEntry]:
    q = db.query(LedgerEntry)
    if entry_type:
        q = q.filter(LedgerEntry.entry_type == entry_type)
    if account:
        q = q.filter((LedgerEntry.debit_account == account) | (LedgerEntry.credit_account == account))
    start, end = _day_range(date_from, date_to)
    if start:
        q = q.filter(LedgerEntry.posted_at >= start)
    if end:
        q = q.filter(LedgerEntry.posted_at < end)
    return q.order_by(LedgerEntry.sequence.desc()).offset(offset).limit(limit).all()


def verify_chain(db: Session) -> dict:
    """Recompute every hash in order; report the first break if any."""
    prev = GENESIS_HASH
    checked = 0
    expected_seq = 1
    for entry in db.query(LedgerEntry).order_by(LedgerEntry.sequence.asc()).yield_per(500):
        checked += 1
        if entry.sequence != expected_seq:
            return {"valid": False, "entries_checked": checked, "first_invalid_sequence": entry.sequence,
                    "reason": f"Sequence gap: expected {expected_seq}"}
        if entry.prev_hash != prev:
            return {"valid": False, "entries_checked": checked, "first_invalid_sequence": entry.sequence,
                    "reason": "Previous-hash link broken"}
        if _hash_fields(entry) != entry.entry_hash:
            return {"valid": False, "entries_checked": checked, "first_invalid_sequence": entry.sequence,
                    "reason": "Entry contents do not match stored hash"}
        prev = entry.entry_hash
        expected_seq += 1
    return {"valid": True, "entries_checked": checked, "first_invalid_sequence": None,
            "reason": None, "head_hash": prev}


def summary(db: Session, date_from: Optional[date] = None, date_to: Optional[date] = None) -> dict:
    """Account balances and headline totals, derived only from ledger entries."""
    start, end = _day_range(date_from, date_to)

    def _sum(column):
        q = db.query(column, func.coalesce(func.sum(LedgerEntry.amount), 0))
        if start:
            q = q.filter(LedgerEntry.posted_at >= start)
        if end:
            q = q.filter(LedgerEntry.posted_at < end)
        return {acct: _money(total) for acct, total in q.group_by(column).all()}

    debits = _sum(LedgerEntry.debit_account)
    credits = _sum(LedgerEntry.credit_account)
    balances = {}
    for acct in LEDGER_ACCOUNTS:
        d = debits.get(acct, Decimal("0.00"))
        c = credits.get(acct, Decimal("0.00"))
        balances[acct] = {"debits": d, "credits": c, "net_debit": d - c}

    count_q = db.query(LedgerEntry.entry_type, func.count(LedgerEntry.id))
    if start:
        count_q = count_q.filter(LedgerEntry.posted_at >= start)
    if end:
        count_q = count_q.filter(LedgerEntry.posted_at < end)
    counts = dict(count_q.group_by(LedgerEntry.entry_type).all())

    premium = -balances["premium_income"]["net_debit"]
    refunds = balances["premium_refunds"]["net_debit"]
    claims = balances["claims_paid"]["net_debit"]
    commissions = balances["commission_expense"]["net_debit"]
    return {
        "period": {"from": date_from, "to": date_to},
        "currency": "INR",
        "gross_premium": premium,
        "premium_refunds": refunds,
        "net_premium": premium - refunds,
        "claims_paid": claims,
        "commissions_paid": commissions,
        "net_cash_movement": balances["cash"]["net_debit"],
        "underwriting_result": premium - refunds - claims - commissions,
        "loss_ratio_percent": (claims / (premium - refunds) * 100).quantize(CENT) if premium - refunds > 0 else None,
        "entry_counts": counts,
        "accounts": balances,
        "source": "ledger",
    }


# ── Settlements ────────────────────────────────────────────────

def next_settlement_number(db: Session) -> str:
    return f"STL-{datetime.now(timezone.utc):%Y}-{db.query(Settlement).count() + 1:06d}"


def _history(settlement: Settlement, event_name: str, actor: Optional[User], **extra) -> None:
    item = {"event": event_name, "at": datetime.now(timezone.utc).isoformat(), "by": actor.id if actor else None}
    item.update({k: (str(v) if isinstance(v, Decimal) else v) for k, v in extra.items()})
    settlement.history = [*(settlement.history or []), item]


def normalize_reference(reference: str) -> str:
    ref = (reference or "").strip().upper()
    if not ref:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Payout reference is required")
    return ref


def claim_payout_reference(db: Session, reference: str, source_type: str, source_id: str) -> str:
    """Reserve a payout reference. Fails with 409 if it was ever used before, by
    anyone (including an earlier attempt of the same payout). The unique key on
    ``payout_references`` closes the race between concurrent requests."""
    ref = normalize_reference(reference)
    if db.get(PayoutReference, ref) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Payout reference '{ref}' has already been used")
    try:
        with db.begin_nested():
            db.add(PayoutReference(reference=ref, source_type=source_type, source_id=source_id))
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Payout reference '{ref}' has already been used")
    return ref


def record_claim_settlement(db: Session, claim: Claim, actor: User, payout_reference: str) -> Settlement:
    """Create the settlement record and post the payout to the ledger (no commit)."""
    payout_reference = claim_payout_reference(db, payout_reference, "settlement", claim.id)
    claim.settlement_reference = payout_reference
    net = _money(claim.net_payable or 0)
    settlement = Settlement(
        settlement_number=next_settlement_number(db),
        claim_id=claim.id,
        customer_id=claim.claimant_id,
        approved_amount=_money(claim.approved_amount or 0),
        deductible_amount=_money(claim.deductible_applied or 0),
        net_amount=net,
        status="paid",
        payout_reference=payout_reference,
        paid_at=_utc_now_seconds(),
        processed_by_id=actor.id,
        history=[],
    )
    db.add(settlement)
    db.flush()
    _history(settlement, "paid", actor, payout_reference=payout_reference, amount=net)
    if net > 0:
        post_entry(
            db, entry_type="claim_payout", amount=net, reference_type="settlement",
            reference_id=settlement.id, external_reference=payout_reference,
            description=f"Claim {claim.claim_number} settlement payout", actor=actor,
        )
    return settlement


def _active_payout_entry(db: Session, settlement: Settlement) -> Optional[LedgerEntry]:
    done = reversed_ids(db)
    entries = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.reference_type == "settlement", LedgerEntry.reference_id == settlement.id,
                LedgerEntry.entry_type == "claim_payout")
        .order_by(LedgerEntry.sequence.desc()).all()
    )
    return next((e for e in entries if e.id not in done), None)


def get_settlement(db: Session, settlement_id: str) -> Settlement:
    s = db.get(Settlement, settlement_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Settlement not found")
    return s


def mark_settlement_failed(db: Session, settlement: Settlement, reason: str, actor: User) -> Settlement:
    if settlement.status != "paid":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Only paid settlements can be marked failed (status: {settlement.status})")
    entry = _active_payout_entry(db, settlement)
    if entry is not None:
        post_reversal(db, entry, f"payout failed – {reason}", actor)
    settlement.status = "failed"
    settlement.failure_reason = reason
    settlement.reconciled = False
    settlement.reconciled_at = None
    _history(settlement, "failed", actor, reason=reason)
    settlement.claim.status = "payout_failed"
    db.commit()
    db.refresh(settlement)
    return settlement


def retry_settlement(db: Session, settlement: Settlement, payout_reference: str, actor: User) -> Settlement:
    if settlement.status != "failed":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only failed settlements can be retried")
    payout_reference = claim_payout_reference(db, payout_reference, "settlement", settlement.claim_id)
    if settlement.net_amount > 0:
        post_entry(
            db, entry_type="claim_payout", amount=settlement.net_amount, reference_type="settlement",
            reference_id=settlement.id, external_reference=payout_reference,
            description=f"Claim {settlement.claim.claim_number} settlement payout (retry)", actor=actor,
        )
    settlement.status = "paid"
    settlement.payout_reference = payout_reference
    settlement.paid_at = _utc_now_seconds()
    settlement.failure_reason = None
    _history(settlement, "retried", actor, payout_reference=payout_reference)
    claim = settlement.claim
    claim.status = "settled"
    claim.settlement_reference = payout_reference
    claim.settled_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(settlement)
    return settlement


# ── Reconciliation ─────────────────────────────────────────────

RECON_SOURCES = {
    "payment_gateway": ("premium_received",),
    "bank_payouts": ("claim_payout", "commission_payout"),
}


def next_run_number(db: Session) -> str:
    return f"REC-{datetime.now(timezone.utc):%Y}-{db.query(ReconciliationRun).count() + 1:06d}"


def reconcile(
    db: Session,
    *,
    source: str,
    period_start: date,
    period_end: date,
    lines: Iterable[dict],
    actor: User,
    notes: Optional[str] = None,
) -> ReconciliationRun:
    if source not in RECON_SOURCES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown reconciliation source")
    if period_end < period_start:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "period_end must be on or after period_start")
    start, end = _day_range(period_start, period_end)

    done = reversed_ids(db)
    internal_rows = [
        e for e in db.query(LedgerEntry).filter(
            LedgerEntry.entry_type.in_(RECON_SOURCES[source]),
            LedgerEntry.posted_at >= start, LedgerEntry.posted_at < end,
        ).all() if e.id not in done
    ]
    grouped: dict[str, list[LedgerEntry]] = {}
    unreferenced = []
    for e in internal_rows:
        if e.external_reference:
            grouped.setdefault(e.external_reference, []).append(e)
        else:
            unreferenced.append(e)
    # A reference posted more than once can never be "matched" by one statement line.
    dup_ledger = {ref: rows for ref, rows in grouped.items() if len(rows) > 1}
    internal: dict[str, LedgerEntry] = {ref: rows[0] for ref, rows in grouped.items() if len(rows) == 1}

    lines = [{"reference": str(l["reference"]).strip(), "amount": _money(l["amount"])} for l in lines]
    dup_refs = [ref for ref, n in Counter(l["reference"] for l in lines).items() if n > 1]
    statement = {l["reference"]: l["amount"] for l in lines}

    matched, mismatched, missing_internal, missing_statement = [], [], [], []
    for ref, amount in statement.items():
        if ref in dup_ledger:
            continue
        entry = internal.get(ref)
        if entry is None:
            missing_internal.append({"reference": ref, "statement_amount": str(amount)})
        elif _money(entry.amount) != amount:
            mismatched.append({"reference": ref, "statement_amount": str(amount),
                               "ledger_amount": str(_money(entry.amount)), "ledger_entry": entry.entry_number})
        else:
            matched.append({"reference": ref, "amount": str(amount), "ledger_entry": entry.entry_number})
    for ref, entry in internal.items():
        if ref not in statement:
            missing_statement.append({"reference": ref, "ledger_amount": str(_money(entry.amount)),
                                      "ledger_entry": entry.entry_number})

    statement_total = sum((l["amount"] for l in lines), Decimal("0.00"))
    ledger_total = sum((_money(e.amount) for e in internal_rows), Decimal("0.00"))
    difference = statement_total - ledger_total
    clean = not (mismatched or missing_internal or missing_statement or dup_refs or unreferenced or dup_ledger)         and difference == 0

    if source == "bank_payouts":
        matched_refs = {m["reference"] for m in matched}
        for s in db.query(Settlement).filter(Settlement.payout_reference.in_(matched_refs), Settlement.status == "paid").all():
            s.reconciled = True
            s.reconciled_at = _utc_now_seconds()

    run = ReconciliationRun(
        run_number=next_run_number(db),
        source=source,
        period_start=start,
        period_end=end - timedelta(seconds=1),
        statement_total=statement_total,
        ledger_total=ledger_total,
        difference=difference,
        matched_count=len(matched),
        status="matched" if clean else "mismatched",
        results={
            "matched": matched,
            "amount_mismatches": mismatched,
            "missing_in_ledger": missing_internal,
            "missing_in_statement": missing_statement,
            "duplicate_statement_references": dup_refs,
            "duplicate_ledger_references": [
                {"reference": ref, "ledger_entries": [e.entry_number for e in rows],
                 "statement_amount": str(statement[ref]) if ref in statement else None}
                for ref, rows in dup_ledger.items()
            ],
            "ledger_entries_without_reference": [e.entry_number for e in unreferenced],
        },
        notes=notes,
        created_by_id=actor.id,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run
