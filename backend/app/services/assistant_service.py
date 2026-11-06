"""
Permission-aware policy & product assistant.

Answers are grounded in records the caller is allowed to see: the active
product catalogue for everyone, plus the caller's own policies and claims.
Every answer lists the sources it used. The assistant is read-only: it never
creates, approves, rejects, or changes policies, claims, or payments.

If ``AI_PROVIDER=gemini`` and ``AI_API_KEY`` are configured, the retrieved
sources are passed to Gemini to phrase the reply; otherwise (and on any LLM
error) a deterministic extractive answer is returned.
"""

import re
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.claim_incident import Claim
from app.models.insurance import InsuranceProduct
from app.models.payment_policy import Policy
from app.models.user import User
from app.services import insurance_service, shipment_service

logger = get_logger(__name__)

DISCLAIMER = (
    "This assistant provides guidance only. It cannot issue, approve, reject, or change "
    "policies, claims, or payments; those decisions are made by authorised MarineSure staff."
)
ACTION_WORDS = re.compile(r"\b(approve|reject|cancel|settle|pay out|payout|issue|refund|increase|change|modify)\b", re.I)
STOPWORDS = set(
    "a an and are as at be by can do does for from has have how i if in is it its me my of on or our "
    "the this to was what when where which who why will with you your about there their should would".split()
)


def _tokens(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in STOPWORDS and len(t) > 1]


def _product_doc(p: InsuranceProduct) -> dict:
    cov = "; ".join(c.coverage_name + (f" – {c.description}" if c.description else "") for c in p.coverages)
    exc = "; ".join(e.exclusion_name + (f" – {e.description}" if e.description else "") for e in p.exclusions)
    text = (
        f"{p.product_name} ({p.product_code}). {p.description} Covers: {cov or 'n/a'}. "
        f"Excludes: {exc or 'n/a'}. Transport modes: {p.applicable_modes}. "
        f"Insured value {p.min_insured_value:,.0f}–{p.max_insured_value:,.0f} INR. Base rate {Decimal(p.base_rate) * 100:.2f}%. "
        f"Deductible {p.deductible_percentage}% (minimum {p.min_deductible:,.0f} INR). "
        f"Cover period {p.coverage_duration_days} days. Terms: {p.terms_and_conditions}"
    )
    return {"type": "product", "id": p.id, "title": f"Product {p.product_code}: {p.product_name}", "text": text}


def _policy_doc(pol: Policy) -> dict:
    text = (
        f"Policy {pol.policy_number} status {pol.status}, product {pol.product.product_name if pol.product else ''}, "
        f"insured amount {pol.insured_amount:,.2f} INR, premium paid {pol.premium_paid:,.2f} INR, "
        f"deductible {pol.deductible_amount:,.2f} INR, valid {pol.effective_date} to {pol.expiry_date}."
    )
    return {"type": "policy", "id": pol.id, "title": f"Your policy {pol.policy_number}", "text": text}


def _claim_doc(c: Claim) -> dict:
    text = (
        f"Claim {c.claim_number} status {c.status.replace('_', ' ')}, type {c.claim_type.replace('_', ' ')}, "
        f"claimed {c.claim_amount:,.2f} INR"
        + (f", approved {c.approved_amount:,.2f} INR, net payable {c.net_payable:,.2f} INR" if c.approved_amount else "")
        + (f", rejection reason: {c.rejection_reason}" if c.rejection_reason else "")
        + (f", settlement reference {c.settlement_reference}" if c.settlement_reference else "")
        + "."
    )
    return {"type": "claim", "id": c.id, "title": f"Your claim {c.claim_number}", "text": text}


def _corpus(db: Session, user: User) -> list[dict]:
    docs = [_product_doc(p) for p in insurance_service.list_products(db)]
    docs += [_policy_doc(p) for p in db.query(Policy).filter(Policy.customer_id == user.id).all()]
    docs += [_claim_doc(c) for c in db.query(Claim).filter(Claim.claimant_id == user.id).all()]
    return docs


def _rank(question: str, docs: list[dict], top: int = 3) -> list[dict]:
    q = set(_tokens(question))
    wants_mine = bool(re.search(r"\b(my|mine)\b", question.lower()))
    scored = []
    for d in docs:
        words = _tokens(d["text"] + " " + d["title"])
        score = sum(1 for w in words if w in q) + 3 * sum(1 for w in set(_tokens(d["title"])) if w in q)
        if wants_mine and d["type"] in ("policy", "claim"):
            score += 2
        if "claim" in q and d["type"] == "claim":
            score += 2
        if "policy" in q and d["type"] == "policy":
            score += 2
        if score:
            scored.append((score, d))
    scored.sort(key=lambda x: -x[0])
    return [d for _, d in scored[:top]]


def _extractive(question: str, sources: list[dict]) -> str:
    if not sources:
        return ("I couldn't find anything in the product catalogue or your records that answers that. "
                "Try asking about a product name, coverage, exclusions, deductibles, or your policy/claim numbers.")
    q = set(_tokens(question))
    lines = []
    for i, s in enumerate(sources, 1):
        sentences = re.split(r"(?<=[.])\s+", s["text"])
        best = sorted(sentences, key=lambda x: -sum(1 for w in _tokens(x) if w in q))[:2]
        lines.append(f"[{i}] {s['title']}: " + " ".join(best))
    return "Here is what I found:\n" + "\n".join(lines)


def _llm(question: str, sources: list[dict]) -> Optional[str]:
    settings = get_settings()
    if settings.AI_PROVIDER.lower() != "gemini" or not settings.AI_API_KEY or not sources:
        return None
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI

        context = "\n".join(f"[{i}] {s['title']}: {s['text']}" for i, s in enumerate(sources, 1))
        prompt = (
            "You are MarineSure's insurance help assistant. Answer ONLY from the numbered sources below, "
            "cite them like [1], and say so if they do not contain the answer. Never promise approval, "
            "payment, or any change to a policy or claim.\n\nSources:\n"
            f"{context}\n\nQuestion: {question}"
        )
        model = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=settings.AI_API_KEY, temperature=0)
        return str(model.invoke(prompt).content).strip() or None
    except Exception as exc:  # pragma: no cover - network dependent
        logger.warning("AI provider call failed, using extractive answer: %s", exc)
        return None


def answer(db: Session, user: User, question: str) -> dict:
    sources = _rank(question, _corpus(db, user))
    generated = _llm(question, sources)
    reply = generated or _extractive(question, sources)
    if ACTION_WORDS.search(question):
        reply += ("\n\nNote: I can't take actions such as approving, settling, or changing records. "
                  "Use the relevant page or contact your insurance officer.")
    return {
        "answer": reply,
        "mode": "llm" if generated else "retrieval",
        "sources": [{"type": s["type"], "id": s["id"], "title": s["title"]} for s in sources],
        "disclaimer": DISCLAIMER,
    }


def recommend(db: Session, user: User, shipment_id: str) -> dict:
    """Rank eligible products for a shipment the user may view, by total premium."""
    shipment = shipment_service.require_view(db, user, shipment_id)
    options = insurance_service.compare_products_for_shipment(db, user, shipment.id)
    ranked = sorted(
        options,
        key=lambda o: (not o["is_eligible"], Decimal(o["quotation"]["total_premium"]), -len(o["product"].coverages)),
    )
    items = []
    for rank, o in enumerate(ranked, 1):
        p = o["product"]
        reasons = []
        if o["is_eligible"]:
            reasons.append(f"Supports {shipment.transport_mode} transport and the declared value")
            reasons.append(f"{len(p.coverages)} coverages, deductible {p.deductible_percentage}%")
        items.append({
            "rank": rank,
            "product_id": p.id,
            "product_code": p.product_code,
            "product_name": p.product_name,
            "is_eligible": o["is_eligible"],
            "estimated_total_premium": o["quotation"]["total_premium"],
            "estimated_deductible": o["quotation"]["deductible_amount"],
            "reasons": reasons or o["eligibility_notes"],
            "source": {"type": "product", "id": p.id, "title": f"Product {p.product_code}: {p.product_name}"},
        })
    return {"shipment_id": shipment.id, "recommendations": items, "disclaimer": DISCLAIMER,
            "note": "Estimates only. A binding premium is set by underwriting on application."}
