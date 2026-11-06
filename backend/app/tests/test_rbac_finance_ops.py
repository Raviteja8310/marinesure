"""
Tests for the permission matrix, immutable ledger, settlements, reconciliation,
payment history, grievances, inspections, product administration, and the
AI assistant.
"""

from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from app.core.security import create_access_token, hash_password
from app.database.connection import SessionLocal
from app.models.finance import ImmutableLedgerError, LedgerEntry
from app.models.user import OfficerProfile, Role, User
from app.tests.test_claims import _setup_active_policy as _legacy_setup_active_policy
from app.tests.test_shipments import _auth, _token

API = "/api/v1"


# ── helpers ─────────────────────────────────────────────────────

def _setup_active_policy(client, email):
    """Legacy helper grants the customer the admin role to approve the application.

    Permissions are read from the database, so strip that role afterwards to get
    a genuine customer account.
    """
    result = _legacy_setup_active_policy(client, email)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).one()
        user.roles = [r for r in user.roles if r.role_name != "admin"]
        db.commit()
    finally:
        db.close()
    return result


def _make_user(email: str, *roles: str) -> tuple[str, str]:
    """Create an active user with the given roles directly; return (user_id, token)."""
    db = SessionLocal()
    try:
        user = User(name=email.split("@")[0], email=email, password_hash=hash_password("CorrectHorse9"),
                    status="active", email_verified=True)
        for r in roles:
            user.roles.append(db.query(Role).filter(Role.role_name == r).one())
        if set(roles) & {"insurance_officer", "senior_officer", "admin"}:
            user.officer_profile = OfficerProfile(employee_code=f"EMP-{abs(hash(email)) % 10**9}")
        db.add(user)
        db.commit()
        token = create_access_token({"sub": user.id, "roles": list(roles)})
        return user.id, token
    finally:
        db.close()


def _settled_claim(client, email="settle.flow@example.com"):
    """Run policy -> incident -> claim -> survey -> approval -> settlement. Returns context dict."""
    cust_token, _, shipment_id, policy_id = _setup_active_policy(client, email)
    _, officer = _make_user(f"officer.{email}", "insurance_officer")
    surveyor_id, surveyor = _make_user(f"surveyor.{email}", "surveyor")

    inc = client.post(f"{API}/incidents", json={
        "shipment_id": shipment_id, "incident_date": "2026-11-06T10:00:00Z", "incident_type": "water_ingress",
        "severity": "severe", "description": "Seawater ingress through damaged container seal, cargo wet.",
        "estimated_loss": "200000.00",
    }, headers=_auth(cust_token))
    assert inc.status_code == 201, inc.text
    claim = client.post(f"{API}/claims", json={
        "policy_id": policy_id, "incident_id": inc.json()["id"], "claim_amount": "200000.00",
        "claim_type": "partial_loss",
    }, headers=_auth(cust_token))
    assert claim.status_code == 201, claim.text
    claim_id = claim.json()["id"]
    r = client.post(f"{API}/claims/{claim_id}/assign-surveyor", json={"surveyor_id": surveyor_id}, headers=_auth(officer))
    assert r.status_code == 200, r.text
    ctx = dict(cust=cust_token, officer=officer, surveyor=surveyor, surveyor_id=surveyor_id,
               claim_id=claim_id, policy_id=policy_id, shipment_id=shipment_id)
    return ctx


def _approve_and_settle(client, ctx, reference=None):
    r = client.post(f"{API}/claims/{ctx['claim_id']}/survey-reports", json={
        "inspection_date": "2026-11-06T15:00:00Z", "inspection_location": "Dock 3",
        "damage_assessment": "Water damage to 40% of cartons confirmed on inspection.",
        "cause_of_loss": "seawater_ingress", "is_covered_peril": True, "estimated_loss_amount": "190000.00",
        "salvage_value": "10000.00", "recommended_settlement": "180000.00",
    }, headers=_auth(ctx["surveyor"]))
    assert r.status_code == 201, r.text
    r = client.post(f"{API}/claims/{ctx['claim_id']}/review", json={
        "status": "approved", "approved_amount": "180000.00", "officer_notes": "Verified against survey.",
    }, headers=_auth(ctx["officer"]))
    assert r.status_code == 200, r.text
    body = {"settlement_reference": reference} if reference else {}
    r = client.post(f"{API}/claims/{ctx['claim_id']}/settle", json=body, headers=_auth(ctx["officer"]))
    assert r.status_code == 200, r.text
    return r.json()


# ── Roles & permissions ─────────────────────────────────────────

def test_permission_matrix_is_admin_only_and_seeded(client):
    _, admin = _make_user("rbac.admin@example.com", "admin")
    _, officer = _make_user("rbac.officer@example.com", "insurance_officer")

    assert client.get(f"{API}/admin/roles", headers=_auth(officer)).status_code == 403
    assert client.get(f"{API}/admin/roles").status_code == 401

    roles = client.get(f"{API}/admin/roles", headers=_auth(admin))
    assert roles.status_code == 200, roles.text
    by_name = {r["role_name"]: r for r in roles.json()}
    assert by_name["admin"]["is_system"] is True
    assert "finance.view" in by_name["admin"]["permissions"]
    assert "claims.settle" in by_name["insurance_officer"]["permissions"]
    assert "finance.view" not in by_name["insurance_officer"]["permissions"]
    assert "grievances.create" in by_name["customer"]["permissions"]

    matrix = client.get(f"{API}/admin/permission-matrix", headers=_auth(admin)).json()
    assert len(matrix["permissions"]) >= 19 and matrix["roles"]

    mine = client.get(f"{API}/users/me/permissions", headers=_auth(officer)).json()
    assert "claims.review" in mine and "roles.manage" not in mine


def test_custom_role_grant_and_revoke_take_effect_immediately(client):
    _, admin = _make_user("rbac2.admin@example.com", "admin")
    analyst_id, analyst = _make_user("analyst@example.com", "customer")

    assert client.get(f"{API}/finance/summary", headers=_auth(analyst)).status_code == 403

    created = client.post(f"{API}/admin/roles", json={
        "role_name": "finance_analyst", "description": "Read-only finance",
        "permission_codes": ["finance.view"],
    }, headers=_auth(admin))
    assert created.status_code == 201, created.text
    role = created.json()
    assert role["is_system"] is False and role["permissions"] == ["finance.view"]

    assert client.post(f"{API}/admin/roles", json={"role_name": "finance_analyst"}, headers=_auth(admin)).status_code == 409
    bad = client.post(f"{API}/admin/roles", json={"role_name": "x_role", "permission_codes": ["nope.nope"]}, headers=_auth(admin))
    assert bad.status_code == 422

    assign = client.post(f"{API}/users/{analyst_id}/roles", json={"role": "finance_analyst"}, headers=_auth(admin))
    assert assign.status_code == 200, assign.text
    assert "finance_analyst" in assign.json()["roles"]
    assert client.get(f"{API}/finance/summary", headers=_auth(analyst)).status_code == 200
    assert client.post(f"{API}/finance/ledger/adjustments", json={
        "debit_account": "cash", "credit_account": "adjustments", "amount": "10.00", "description": "test adj"},
        headers=_auth(analyst)).status_code == 403

    revoke = client.put(f"{API}/admin/roles/{role['id']}/permissions", json={"permission_codes": []}, headers=_auth(admin))
    assert revoke.status_code == 200 and revoke.json()["permissions"] == []
    assert client.get(f"{API}/finance/summary", headers=_auth(analyst)).status_code == 403

    # Role in use cannot be deleted; renaming works for custom roles.
    assert client.delete(f"{API}/admin/roles/{role['id']}", headers=_auth(admin)).status_code == 409
    renamed = client.patch(f"{API}/admin/roles/{role['id']}", json={"role_name": "finance_reader"}, headers=_auth(admin))
    assert renamed.status_code == 200 and renamed.json()["role_name"] == "finance_reader"

    unknown = client.post(f"{API}/users/{analyst_id}/roles", json={"role": "does_not_exist"}, headers=_auth(admin))
    assert unknown.status_code == 404


def test_builtin_roles_and_permissions_are_protected(client):
    _, admin = _make_user("rbac3.admin@example.com", "admin")
    roles = {r["role_name"]: r for r in client.get(f"{API}/admin/roles", headers=_auth(admin)).json()}
    assert client.delete(f"{API}/admin/roles/{roles['customer']['id']}", headers=_auth(admin)).status_code == 409
    assert client.patch(f"{API}/admin/roles/{roles['customer']['id']}", json={"role_name": "client"}, headers=_auth(admin)).status_code == 409
    assert client.put(f"{API}/admin/roles/{roles['admin']['id']}/permissions", json={"permission_codes": []}, headers=_auth(admin)).status_code == 409

    perms = {p["code"]: p for p in client.get(f"{API}/admin/permissions", headers=_auth(admin)).json()}
    assert client.delete(f"{API}/admin/permissions/{perms['finance.view']['id']}", headers=_auth(admin)).status_code == 409

    custom = client.post(f"{API}/admin/permissions", json={"code": "reports.export", "name": "Export reports", "category": "finance"}, headers=_auth(admin))
    assert custom.status_code == 201 and custom.json()["is_builtin"] is False
    assert client.post(f"{API}/admin/permissions", json={"code": "reports.export", "name": "dup"}, headers=_auth(admin)).status_code == 409
    assert client.post(f"{API}/admin/permissions", json={"code": "BAD CODE", "name": "bad"}, headers=_auth(admin)).status_code == 422
    patched = client.patch(f"{API}/admin/permissions/{custom.json()['id']}", json={"name": "Export finance reports"}, headers=_auth(admin))
    assert patched.status_code == 200 and patched.json()["name"] == "Export finance reports"
    assert client.delete(f"{API}/admin/permissions/{custom.json()['id']}", headers=_auth(admin)).status_code == 204

    # Every change is audited.
    logs = client.get(f"{API}/audit-logs", headers=_auth(admin)).json()
    assert {"PERMISSION_CREATED", "PERMISSION_DELETED"} <= {l["action"] for l in logs}


def test_revoking_officer_claims_permission_blocks_review(client):
    ctx = _settled_claim(client, "revoke.flow@example.com")
    _, admin = _make_user("rbac4.admin@example.com", "admin")
    roles = {r["role_name"]: r for r in client.get(f"{API}/admin/roles", headers=_auth(admin)).json()}
    officer_perms = [p for p in roles["insurance_officer"]["permissions"] if p != "claims.review"]
    client.put(f"{API}/admin/roles/{roles['insurance_officer']['id']}/permissions",
               json={"permission_codes": officer_perms}, headers=_auth(admin))
    r = client.post(f"{API}/claims/{ctx['claim_id']}/review", json={
        "status": "rejected", "rejection_reason": "x" * 10, "officer_notes": "n"}, headers=_auth(ctx["officer"]))
    assert r.status_code == 403
    assert "claims.review" in r.json()["detail"]


# ── Ledger, settlements, payments ───────────────────────────────

def test_premium_and_settlement_post_to_ledger_and_summary(client):
    ctx = _settled_claim(client, "ledger.flow@example.com")
    claim = _approve_and_settle(client, ctx)
    _, admin = _make_user("ledger.admin@example.com", "admin")

    entries = client.get(f"{API}/finance/ledger", headers=_auth(admin)).json()
    types = [e["entry_type"] for e in entries]
    assert types.count("premium_received") == 1
    assert types.count("claim_payout") == 1
    payout = next(e for e in entries if e["entry_type"] == "claim_payout")
    assert payout["amount"] == "171000.00"
    assert payout["external_reference"] == claim["settlement_reference"]
    assert payout["debit_account"] == "claims_paid" and payout["credit_account"] == "cash"

    premium = next(e for e in entries if e["entry_type"] == "premium_received")
    s = client.get(f"{API}/finance/summary", headers=_auth(admin)).json()
    assert s["source"] == "ledger"
    assert s["gross_premium"] == premium["amount"]
    assert s["claims_paid"] == "171000.00"
    assert float(s["net_cash_movement"]) == pytest.approx(float(premium["amount"]) - 171000.0)

    v = client.get(f"{API}/finance/ledger/verify", headers=_auth(admin)).json()
    assert v["valid"] is True and v["entries_checked"] == 2

    # Officers lack finance.view by default.
    assert client.get(f"{API}/finance/ledger", headers=_auth(ctx["officer"])).status_code == 403
    # Filters
    only = client.get(f"{API}/finance/ledger?entry_type=claim_payout", headers=_auth(admin)).json()
    assert len(only) == 1
    assert client.get(f"{API}/finance/ledger?account=bogus", headers=_auth(admin)).status_code == 422


def test_ledger_is_immutable_and_tampering_is_detected(client):
    _setup_active_policy(client, "tamper.flow@example.com")
    _, admin = _make_user("tamper.admin@example.com", "admin")

    db = SessionLocal()
    try:
        entry = db.query(LedgerEntry).first()
        entry.amount = 1
        with pytest.raises(ImmutableLedgerError):
            db.commit()
        db.rollback()
        entry = db.query(LedgerEntry).first()
        db.delete(entry)
        with pytest.raises(ImmutableLedgerError):
            db.commit()
        db.rollback()
        # Bypass the ORM to simulate direct database tampering.
        db.execute(text("UPDATE ledger_entries SET amount = 1"))
        db.commit()
    finally:
        db.close()
    v = client.get(f"{API}/finance/ledger/verify", headers=_auth(admin)).json()
    assert v["valid"] is False and v["first_invalid_sequence"] == 1


def test_adjustments_and_reversals(client):
    _, admin = _make_user("adj.admin@example.com", "admin")
    adj = client.post(f"{API}/finance/ledger/adjustments", json={
        "debit_account": "cash", "credit_account": "adjustments", "amount": "2500.00",
        "description": "Bank interest credit", "external_reference": "BANK-INT-1"}, headers=_auth(admin))
    assert adj.status_code == 201, adj.text
    assert adj.json()["sequence"] == 1
    same = client.post(f"{API}/finance/ledger/adjustments", json={
        "debit_account": "cash", "credit_account": "cash", "amount": "1.00", "description": "invalid same account"},
        headers=_auth(admin))
    assert same.status_code == 422
    rev = client.post(f"{API}/finance/ledger/{adj.json()['id']}/reverse", json={"reason": "posted in error"}, headers=_auth(admin))
    assert rev.status_code == 201, rev.text
    assert rev.json()["debit_account"] == "adjustments" and rev.json()["reverses_entry_id"] == adj.json()["id"]
    again = client.post(f"{API}/finance/ledger/{adj.json()['id']}/reverse", json={"reason": "posted in error"}, headers=_auth(admin))
    assert again.status_code == 409
    rr = client.post(f"{API}/finance/ledger/{rev.json()['id']}/reverse", json={"reason": "reverse the reversal"}, headers=_auth(admin))
    assert rr.status_code == 409
    s = client.get(f"{API}/finance/summary", headers=_auth(admin)).json()
    assert s["net_cash_movement"] == "0.00"
    assert client.get(f"{API}/finance/ledger/verify", headers=_auth(admin)).json()["valid"] is True


def test_settlement_failure_and_retry(client):
    ctx = _settled_claim(client, "retry.flow@example.com")
    _approve_and_settle(client, ctx, reference="UTR-0001")
    _, admin = _make_user("retry.admin@example.com", "admin")

    mine = client.get(f"{API}/settlements/me", headers=_auth(ctx["cust"])).json()
    assert len(mine) == 1 and mine[0]["status"] == "paid" and mine[0]["net_amount"] == "171000.00"
    sid = mine[0]["id"]
    assert client.get(f"{API}/settlements", headers=_auth(ctx["cust"])).status_code == 403
    assert len(client.get(f"{API}/settlements", headers=_auth(ctx["officer"])).json()) == 1

    other = _token(client, "nosy@example.com")
    assert client.get(f"{API}/settlements/{sid}", headers=_auth(other)).status_code == 403

    failed = client.post(f"{API}/settlements/{sid}/mark-failed", json={"reason": "Beneficiary account closed"}, headers=_auth(ctx["officer"]))
    assert failed.status_code == 200, failed.text
    assert failed.json()["status"] == "failed"
    claim = client.get(f"{API}/claims/{ctx['claim_id']}", headers=_auth(ctx["cust"])).json()
    assert claim["status"] == "payout_failed"
    s = client.get(f"{API}/finance/summary", headers=_auth(admin)).json()
    assert s["claims_paid"] == "0.00"
    assert client.post(f"{API}/settlements/{sid}/mark-failed", json={"reason": "again failing"}, headers=_auth(ctx["officer"])).status_code == 409

    retry = client.post(f"{API}/settlements/{sid}/retry", json={"payout_reference": "UTR-0002"}, headers=_auth(ctx["officer"]))
    assert retry.status_code == 200, retry.text
    assert retry.json()["status"] == "paid" and retry.json()["payout_reference"] == "UTR-0002"
    assert [h["event"] for h in retry.json()["history"]] == ["paid", "failed", "retried"]
    s = client.get(f"{API}/finance/summary", headers=_auth(admin)).json()
    assert s["claims_paid"] == "171000.00"
    # Settlement reversals are only done via the settlement workflow.
    payout = client.get(f"{API}/finance/ledger?entry_type=claim_payout", headers=_auth(admin)).json()[0]
    assert client.post(f"{API}/finance/ledger/{payout['id']}/reverse", json={"reason": "manual reverse"}, headers=_auth(admin)).status_code == 409
    assert client.get(f"{API}/finance/ledger/verify", headers=_auth(admin)).json()["valid"] is True


def test_payment_history_is_customer_scoped(client):
    cust, _, _, _ = _setup_active_policy(client, "payer@example.com")
    other = _token(client, "other.payer@example.com")
    _, officer = _make_user("pay.officer@example.com", "insurance_officer")

    mine = client.get(f"{API}/payments", headers=_auth(cust))
    assert mine.status_code == 200
    rows = mine.json()
    assert len(rows) == 1
    assert rows[0]["status"] == "paid" and rows[0]["policy_number"].startswith("POL-")
    assert rows[0]["receipt_reference"].startswith("pay_test_") and len(rows[0]["transactions"]) == 1
    assert client.get(f"{API}/payments", headers=_auth(other)).json() == []
    assert client.get(f"{API}/payments/{rows[0]['id']}", headers=_auth(other)).status_code == 403
    assert len(client.get(f"{API}/payments", headers=_auth(officer)).json()) == 1


def test_cancellation_refund_posts_to_ledger(client):
    cust, _, _, policy_id = _setup_active_policy(client, "refund@example.com")
    _, admin = _make_user("refund.admin@example.com", "admin")
    r = client.post(f"{API}/policies/{policy_id}/cancellations", json={"reason": "Shipment cancelled by buyer"}, headers=_auth(cust))
    assert r.status_code == 201, r.text
    refund = client.get(f"{API}/finance/ledger?entry_type=premium_refund", headers=_auth(admin)).json()
    assert len(refund) == 1 and float(refund[0]["amount"]) == pytest.approx(float(r.json()["refund_amount"]))
    s = client.get(f"{API}/finance/summary", headers=_auth(admin)).json()
    assert float(s["net_premium"]) == pytest.approx(float(s["gross_premium"]) * 0.10, abs=0.02)


def test_payment_signature_is_mandatory_outside_development(client, monkeypatch):
    from app.services import policy_service
    from app.tests.test_shipments import _shipment

    cust, _, _, _ = _setup_active_policy(client, "sig@example.com")
    _, reviewer = _make_user("sig.reviewer@example.com", "insurance_officer")
    products = client.get(f"{API}/insurance-products").json()
    ship = client.post(f"{API}/shipments", json=_shipment(), headers=_auth(cust)).json()
    app_res = client.post(f"{API}/applications", json={"shipment_id": ship["id"], "product_id": products[0]["id"],
                                                      "requested_insured_amount": "1000000.00"}, headers=_auth(cust))
    assert app_res.status_code == 201, app_res.text
    rv = client.post(f"{API}/applications/{app_res.json()['id']}/review",
                     json={"decision": "approved", "risk_score": "low", "officer_remarks": "ok"}, headers=_auth(reviewer))
    assert rv.status_code == 200, rv.text
    order = client.post(f"{API}/payments/create-order", json={"application_id": app_res.json()["id"]}, headers=_auth(cust))
    assert order.status_code == 201, order.text
    oid = order.json()["id"]

    monkeypatch.setattr(policy_service.settings, "APP_ENV", "production")
    monkeypatch.setattr(policy_service.settings, "RAZORPAY_KEY_SECRET", None)
    r = client.post(f"{API}/payments/{oid}/verify", json={"gateway_payment_id": "pay_prod_000001"}, headers=_auth(cust))
    assert r.status_code == 503

    monkeypatch.setattr(policy_service.settings, "RAZORPAY_KEY_SECRET", "real_secret")
    r = client.post(f"{API}/payments/{oid}/verify", json={"gateway_payment_id": "pay_prod_000001"}, headers=_auth(cust))
    assert r.status_code == 400
    r = client.post(f"{API}/payments/{oid}/verify", json={"gateway_payment_id": "pay_prod_000001", "gateway_signature": "forged"}, headers=_auth(cust))
    assert r.status_code == 400

    import hashlib, hmac
    good = hmac.new(b"real_secret", f"{order.json()['gateway_order_id']}|pay_prod_000001".encode(), hashlib.sha256).hexdigest()
    r = client.post(f"{API}/payments/{oid}/verify", json={"gateway_payment_id": "pay_prod_000001", "gateway_signature": good}, headers=_auth(cust))
    assert r.status_code == 200, r.text


# ── Reconciliation ─────────────────────────────────────────────

def test_gateway_reconciliation_matches_and_flags_discrepancies(client):
    _setup_active_policy(client, "recon@example.com")
    _, admin = _make_user("recon.admin@example.com", "admin")
    premium = client.get(f"{API}/finance/ledger?entry_type=premium_received", headers=_auth(admin)).json()[0]
    today = date.today().isoformat()

    ok = client.post(f"{API}/finance/reconciliations", json={
        "source": "payment_gateway", "period_start": today, "period_end": today,
        "lines": [{"reference": premium["external_reference"], "amount": premium["amount"]}]}, headers=_auth(admin))
    assert ok.status_code == 201, ok.text
    assert ok.json()["status"] == "matched" and ok.json()["matched_count"] == 1
    assert ok.json()["difference"] == "0.00"

    bad = client.post(f"{API}/finance/reconciliations", json={
        "source": "payment_gateway", "period_start": today, "period_end": today,
        "lines": [{"reference": premium["external_reference"], "amount": "1.00"},
                  {"reference": "pay_unknown_1", "amount": "50.00"}]}, headers=_auth(admin)).json()
    assert bad["status"] == "mismatched"
    assert bad["results"]["amount_mismatches"][0]["reference"] == premium["external_reference"]
    assert bad["results"]["missing_in_ledger"][0]["reference"] == "pay_unknown_1"

    empty = client.post(f"{API}/finance/reconciliations", json={
        "source": "payment_gateway", "period_start": today, "period_end": today, "lines": []}, headers=_auth(admin)).json()
    assert empty["status"] == "mismatched" and len(empty["results"]["missing_in_statement"]) == 1

    assert len(client.get(f"{API}/finance/reconciliations", headers=_auth(admin)).json()) == 3
    assert client.get(f"{API}/finance/reconciliations/{ok.json()['id']}", headers=_auth(admin)).status_code == 200
    reversed_period = client.post(f"{API}/finance/reconciliations", json={
        "source": "payment_gateway", "period_start": today, "period_end": "2020-01-01", "lines": []}, headers=_auth(admin))
    assert reversed_period.status_code == 422


def test_bank_payout_reconciliation_marks_settlement_reconciled(client):
    ctx = _settled_claim(client, "bankrecon.flow@example.com")
    _approve_and_settle(client, ctx, reference="UTR-BANK-77")
    _, senior = _make_user("bankrecon.senior@example.com", "senior_officer")
    today = date.today().isoformat()
    run = client.post(f"{API}/finance/reconciliations", json={
        "source": "bank_payouts", "period_start": today, "period_end": today,
        "lines": [{"reference": "UTR-BANK-77", "amount": "171000.00"}]}, headers=_auth(senior))
    assert run.status_code == 201, run.text
    assert run.json()["status"] == "matched"
    s = client.get(f"{API}/settlements/me", headers=_auth(ctx["cust"])).json()[0]
    assert s["reconciled"] is True
    assert client.post(f"{API}/finance/reconciliations", json={
        "source": "bank_payouts", "period_start": today, "period_end": today, "lines": []},
        headers=_auth(ctx["officer"])).status_code == 403


# ── Grievances ─────────────────────────────────────────────────

def test_grievance_lifecycle(client):
    cust = _token(client, "grieve@example.com")
    other = _token(client, "grieve.other@example.com")
    officer_id, officer = _make_user("grieve.officer@example.com", "insurance_officer")

    g = client.post(f"{API}/grievances", json={
        "category": "settlement_delay", "priority": "high", "subject": "Settlement is late",
        "description": "My approved claim has not been paid after three weeks of waiting."}, headers=_auth(cust))
    assert g.status_code == 201, g.text
    gid = g.json()["id"]
    assert g.json()["grievance_number"].startswith("GRV-") and g.json()["status"] == "open"

    assert client.get(f"{API}/grievances/{gid}", headers=_auth(other)).status_code == 403
    assert client.get(f"{API}/grievances", headers=_auth(other)).json() == []
    assert len(client.get(f"{API}/grievances", headers=_auth(officer)).json()) == 1
    assert client.patch(f"{API}/grievances/{gid}", json={"status": "in_progress"}, headers=_auth(cust)).status_code == 403
    # Officers cannot raise grievances by default.
    assert client.post(f"{API}/grievances", json={"category": "other", "subject": "Officer test",
                       "description": "x" * 25}, headers=_auth(officer)).status_code == 403

    assigned = client.patch(f"{API}/grievances/{gid}", json={"assigned_to_id": officer_id}, headers=_auth(officer))
    assert assigned.status_code == 200 and assigned.json()["status"] == "in_progress"
    bad_assignee = client.patch(f"{API}/grievances/{gid}", json={"assigned_to_id": g.json()["customer_id"]}, headers=_auth(officer))
    assert bad_assignee.status_code == 422

    client.post(f"{API}/grievances/{gid}/comments", json={"message": "Escalate to finance", "is_internal": True}, headers=_auth(officer))
    client.post(f"{API}/grievances/{gid}/comments", json={"message": "We are checking with the bank."}, headers=_auth(officer))
    assert client.post(f"{API}/grievances/{gid}/comments", json={"message": "x", "is_internal": True}, headers=_auth(cust)).status_code == 403
    cust_view = client.get(f"{API}/grievances/{gid}", headers=_auth(cust)).json()
    assert [c["message"] for c in cust_view["comments"]] == ["We are checking with the bank."]
    assert len(client.get(f"{API}/grievances/{gid}", headers=_auth(officer)).json()["comments"]) == 2

    att = client.post(f"{API}/grievances/{gid}/attachments", files={"file": ("proof.txt", b"bank letter", "text/plain")}, headers=_auth(cust))
    assert att.status_code == 201, att.text
    dl = client.get(f"{API}/grievances/{gid}/attachments/{att.json()['id']}", headers=_auth(officer))
    assert dl.status_code == 200 and dl.content == b"bank letter"
    assert client.post(f"{API}/grievances/{gid}/attachments", files={"file": ("x.exe", b"MZ", "application/x-msdownload")},
                       headers=_auth(cust)).status_code == 415

    assert client.patch(f"{API}/grievances/{gid}", json={"status": "resolved"}, headers=_auth(officer)).status_code == 422
    resolved = client.patch(f"{API}/grievances/{gid}", json={"status": "resolved", "resolution": "Payout re-sent; UTR shared."}, headers=_auth(officer))
    assert resolved.status_code == 200 and resolved.json()["resolved_at"]
    assert client.patch(f"{API}/grievances/{gid}", json={"status": "open"}, headers=_auth(officer)).status_code == 409

    # Customer reply reopens; then close.
    client.post(f"{API}/grievances/{gid}/comments", json={"message": "Still not received."}, headers=_auth(cust))
    assert client.get(f"{API}/grievances/{gid}", headers=_auth(cust)).json()["status"] == "in_progress"
    client.patch(f"{API}/grievances/{gid}", json={"status": "resolved"}, headers=_auth(officer))
    closed = client.patch(f"{API}/grievances/{gid}", json={"status": "closed"}, headers=_auth(officer))
    assert closed.status_code == 200 and closed.json()["status"] == "closed"
    assert client.post(f"{API}/grievances/{gid}/comments", json={"message": "late"}, headers=_auth(cust)).status_code == 409
    notes = client.get(f"{API}/notifications", headers=_auth(cust)).json()
    assert any("GRV-" in n["title"] for n in notes)


def test_grievance_related_records_must_belong_to_customer(client):
    _, _, _, policy_id = _setup_active_policy(client, "owner.grv@example.com")
    stranger = _token(client, "stranger.grv@example.com")
    r = client.post(f"{API}/grievances", json={"category": "policy_service", "subject": "Not my policy",
                    "description": "Trying to attach someone else's policy here.", "related_policy_id": policy_id},
                    headers=_auth(stranger))
    assert r.status_code == 422


# ── Inspections & surveyor reports ─────────────────────────────

def test_inspection_scheduling_rules(client):
    ctx = _settled_claim(client, "inspect.flow@example.com")
    other_surveyor_id, other_surveyor = _make_user("other.surveyor@example.com", "surveyor")
    start = (datetime.now(timezone.utc) + timedelta(days=2)).replace(minute=0, second=0, microsecond=0)
    slot = {"claim_id": ctx["claim_id"], "location": "Nhava Sheva CFS, Bay 4",
            "scheduled_start": start.isoformat(), "scheduled_end": (start + timedelta(hours=2)).isoformat()}

    assert client.post(f"{API}/inspections", json=slot, headers=_auth(other_surveyor)).status_code == 403
    assert client.post(f"{API}/inspections", json=slot, headers=_auth(ctx["cust"])).status_code == 403
    bad = {**slot, "scheduled_end": (start - timedelta(hours=1)).isoformat()}
    assert client.post(f"{API}/inspections", json=bad, headers=_auth(ctx["surveyor"])).status_code == 422

    a = client.post(f"{API}/inspections", json=slot, headers=_auth(ctx["surveyor"]))
    assert a.status_code == 201, a.text
    aid = a.json()["id"]
    assert a.json()["surveyor_id"] == ctx["surveyor_id"] and a.json()["status"] == "scheduled"

    overlap = {**slot, "scheduled_start": (start + timedelta(hours=1)).isoformat(),
               "scheduled_end": (start + timedelta(hours=3)).isoformat()}
    assert client.post(f"{API}/inspections", json=overlap, headers=_auth(ctx["officer"])).status_code == 409
    later = {**slot, "scheduled_start": (start + timedelta(hours=4)).isoformat(),
             "scheduled_end": (start + timedelta(hours=5)).isoformat()}
    b = client.post(f"{API}/inspections", json=later, headers=_auth(ctx["officer"]))
    assert b.status_code == 201

    assert len(client.get(f"{API}/inspections", headers=_auth(ctx["surveyor"])).json()) == 2
    assert client.get(f"{API}/inspections", headers=_auth(other_surveyor)).json() == []
    assert len(client.get(f"{API}/inspections", headers=_auth(ctx["cust"])).json()) == 2
    assert len(client.get(f"{API}/inspections", headers=_auth(ctx["officer"])).json()) == 2
    assert client.get(f"{API}/inspections/{aid}", headers=_auth(other_surveyor)).status_code == 403

    # Rescheduling into the other slot clashes; a free slot works.
    clash = client.post(f"{API}/inspections/{aid}/reschedule", json={"reason": "Port congestion", **{k: later[k] for k in ("scheduled_start", "scheduled_end")}}, headers=_auth(ctx["surveyor"]))
    assert clash.status_code == 409
    free_start = start + timedelta(days=1)
    moved = client.post(f"{API}/inspections/{aid}/reschedule", json={
        "reason": "Port congestion", "scheduled_start": free_start.isoformat(),
        "scheduled_end": (free_start + timedelta(hours=1)).isoformat()}, headers=_auth(ctx["surveyor"]))
    assert moved.status_code == 200 and moved.json()["reschedule_count"] == 1

    cancelled = client.post(f"{API}/inspections/{b.json()['id']}/cancel", json={"reason": "Duplicate booking"}, headers=_auth(ctx["officer"]))
    assert cancelled.status_code == 200 and cancelled.json()["status"] == "cancelled"
    assert client.post(f"{API}/inspections/{b.json()['id']}/reschedule", json={"reason": "try again", **{k: later[k] for k in ("scheduled_start", "scheduled_end")}},
                       headers=_auth(ctx["officer"])).status_code == 409
    done = client.post(f"{API}/inspections/{aid}/complete", headers=_auth(ctx["surveyor"]))
    assert done.status_code == 200 and done.json()["status"] == "completed"
    assert len(client.get(f"{API}/inspections?status=scheduled", headers=_auth(ctx["surveyor"])).json()) == 0


def test_inspection_requires_assigned_surveyor(client):
    cust, _, shipment_id, policy_id = _setup_active_policy(client, "unassigned@example.com")
    _, officer = _make_user("unassigned.officer@example.com", "insurance_officer")
    inc = client.post(f"{API}/incidents", json={
        "shipment_id": shipment_id, "incident_date": "2026-11-06T10:00:00Z", "incident_type": "theft",
        "severity": "moderate", "description": "Two pallets missing on arrival at warehouse.", "estimated_loss": "50000.00",
    }, headers=_auth(cust)).json()
    claim = client.post(f"{API}/claims", json={"policy_id": policy_id, "incident_id": inc["id"],
                        "claim_amount": "50000.00", "claim_type": "partial_loss"}, headers=_auth(cust)).json()
    start = datetime.now(timezone.utc) + timedelta(days=1)
    r = client.post(f"{API}/inspections", json={"claim_id": claim["id"], "location": "Warehouse 9",
                    "scheduled_start": start.isoformat(), "scheduled_end": (start + timedelta(hours=1)).isoformat()},
                    headers=_auth(officer))
    assert r.status_code == 409


def test_surveyor_report_history(client):
    ctx = _settled_claim(client, "reports.flow@example.com")
    _approve_and_settle(client, ctx)
    reports = client.get(f"{API}/surveyor/reports", headers=_auth(ctx["surveyor"]))
    assert reports.status_code == 200, reports.text
    rows = reports.json()
    assert len(rows) == 1 and rows[0]["claim_status"] == "settled" and rows[0]["shipment_id"] == ctx["shipment_id"]
    _, other_surveyor = _make_user("reports.other@example.com", "surveyor")
    assert client.get(f"{API}/surveyor/reports", headers=_auth(other_surveyor)).json() == []
    assert client.get(f"{API}/surveyor/reports", headers=_auth(ctx["cust"])).status_code == 403
    assert len(client.get(f"{API}/surveyor/reports", headers=_auth(ctx["officer"])).json()) == 1


# ── Product administration ─────────────────────────────────────

PRODUCT = {
    "product_code": "RFR", "product_name": "Reefer Cargo Cover",
    "description": "Temperature-controlled cargo protection for perishables.",
    "min_insured_value": "50000.00", "max_insured_value": "50000000.00", "base_rate": "0.0075",
    "deductible_percentage": "7.50", "min_deductible": "10000.00", "applicable_modes": ["sea", "road"],
    "coverage_duration_days": 45, "terms_and_conditions": "Reefer logs must be supplied with any claim.",
    "coverages": [{"name": "Reefer breakdown", "description": "Mechanical failure of refrigeration"}],
    "exclusions": [{"name": "Pre-shipment spoilage"}],
}


def test_admin_product_crud(client):
    _, admin = _make_user("prod.admin@example.com", "admin")
    cust = _token(client, "prod.cust@example.com")

    assert client.post(f"{API}/admin/insurance-products", json=PRODUCT, headers=_auth(cust)).status_code == 403
    bad = client.post(f"{API}/admin/insurance-products", json={**PRODUCT, "min_insured_value": "90000000.00"}, headers=_auth(admin))
    assert bad.status_code == 422
    assert client.post(f"{API}/admin/insurance-products", json={**PRODUCT, "applicable_modes": ["space"]}, headers=_auth(admin)).status_code == 422
    assert client.post(f"{API}/admin/insurance-products", json={**PRODUCT, "base_rate": "0.9"}, headers=_auth(admin)).status_code == 422

    created = client.post(f"{API}/admin/insurance-products", json=PRODUCT, headers=_auth(admin))
    assert created.status_code == 201, created.text
    pid = created.json()["id"]
    assert created.json()["status"] == "inactive" and created.json()["applicable_modes"] == "road,sea"
    assert client.post(f"{API}/admin/insurance-products", json=PRODUCT, headers=_auth(admin)).status_code == 409
    public = [p["product_code"] for p in client.get(f"{API}/insurance-products").json()]
    assert "RFR" not in public
    assert "RFR" in [p["product_code"] for p in client.get(f"{API}/admin/insurance-products", headers=_auth(admin)).json()]

    act = client.post(f"{API}/admin/insurance-products/{pid}/activate", headers=_auth(admin))
    assert act.status_code == 200 and act.json()["status"] == "active"
    assert "RFR" in [p["product_code"] for p in client.get(f"{API}/insurance-products").json()]
    assert client.post(f"{API}/admin/insurance-products/{pid}/activate", headers=_auth(admin)).status_code == 409

    upd = client.patch(f"{API}/admin/insurance-products/{pid}", json={"base_rate": "0.0080", "coverages": [
        {"name": "Reefer breakdown"}, {"name": "Power outage"}]}, headers=_auth(admin))
    assert upd.status_code == 200, upd.text
    assert upd.json()["base_rate"] == "0.0080" and len(upd.json()["coverages"]) == 2
    assert client.patch(f"{API}/admin/insurance-products/{pid}", json={"max_insured_value": "100.00"}, headers=_auth(admin)).status_code == 422

    # Deactivated products cannot be quoted.
    ship = client.post(f"{API}/shipments", json=__import__("app.tests.test_shipments", fromlist=["_shipment"])._shipment(), headers=_auth(cust)).json()
    client.post(f"{API}/admin/insurance-products/{pid}/deactivate", headers=_auth(admin))
    q = client.post(f"{API}/quotations", json={"shipment_id": ship["id"], "product_id": pid}, headers=_auth(cust))
    assert q.status_code == 409

    assert client.delete(f"{API}/admin/insurance-products/{pid}", headers=_auth(admin)).status_code == 204
    assert client.get(f"{API}/insurance-products/{pid}").status_code == 404


# ── AI assistant ───────────────────────────────────────────────

def test_assistant_answers_with_citations_and_scopes_records(client):
    cust, _, shipment_id, policy_id = _setup_active_policy(client, "ai.cust@example.com")
    stranger = _token(client, "ai.stranger@example.com")

    r = client.post(f"{API}/ai/assistant/chat", json={"message": "What does the marine cargo product exclude?"}, headers=_auth(cust))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mode"] == "retrieval" and body["sources"] and body["disclaimer"]
    assert any(s["type"] == "product" for s in body["sources"])

    mine = client.post(f"{API}/ai/assistant/chat", json={"message": "What is my policy expiry date?"}, headers=_auth(cust)).json()
    assert any(s["type"] == "policy" and s["id"] == policy_id for s in mine["sources"])
    theirs = client.post(f"{API}/ai/assistant/chat", json={"message": "What is my policy expiry date?"}, headers=_auth(stranger)).json()
    assert all(s["id"] != policy_id for s in theirs["sources"])

    action = client.post(f"{API}/ai/assistant/chat", json={"message": "Please approve my claim"}, headers=_auth(cust)).json()
    assert "can't take actions" in action["answer"]

    rec = client.get(f"{API}/ai/assistant/recommendations?shipment_id={shipment_id}", headers=_auth(cust))
    assert rec.status_code == 200, rec.text
    recs = rec.json()["recommendations"]
    assert recs and recs[0]["rank"] == 1 and recs[0]["is_eligible"] in (True, False)
    assert client.get(f"{API}/ai/assistant/recommendations?shipment_id={shipment_id}", headers=_auth(stranger)).status_code == 403
    assert client.post(f"{API}/ai/assistant/chat", json={"message": "hi"}).status_code == 401


# ── Security hardening ─────────────────────────────────────────

def _delegated_user_manager(client, admin):
    """A non-admin with users.manage via a custom role."""
    roles = client.post(f"{API}/admin/roles", json={"role_name": "user_manager", "permission_codes": ["users.manage", "users.view"]},
                        headers=_auth(admin))
    assert roles.status_code == 201, roles.text
    mgr_id, _ = _make_user("delegate.mgr@example.com", "customer")
    assert client.post(f"{API}/users/{mgr_id}/roles", json={"role": "user_manager"}, headers=_auth(admin)).status_code == 200
    return create_access_token({"sub": mgr_id, "roles": ["customer", "user_manager"]})


def test_delegated_manager_cannot_escalate(client):
    _, admin = _make_user("esc.admin@example.com", "admin")
    mgr = _delegated_user_manager(client, admin)
    victim_id, _ = _make_user("esc.victim@example.com", "customer")
    admin_id = client.get(f"{API}/users/me", headers=_auth(admin)).json()["id"]

    client.post(f"{API}/admin/roles", json={"role_name": "treasurer", "permission_codes": ["finance.manage"]}, headers=_auth(admin))
    r = client.post(f"{API}/users/{victim_id}/roles", json={"role": "treasurer"}, headers=_auth(mgr))
    assert r.status_code == 403 and "finance.manage" in r.json()["detail"]
    # Granting a role within the manager's own permissions is allowed.
    client.post(f"{API}/admin/roles", json={"role_name": "viewer", "permission_codes": ["users.view"]}, headers=_auth(admin))
    assert client.post(f"{API}/users/{victim_id}/roles", json={"role": "viewer"}, headers=_auth(mgr)).status_code == 200
    # Cannot suspend an admin or anyone holding permissions the manager lacks.
    assert client.post(f"{API}/users/{admin_id}/status", json={"status": "suspended"}, headers=_auth(mgr)).status_code == 403
    officer_id, _ = _make_user("esc.officer@example.com", "insurance_officer")
    assert client.post(f"{API}/users/{officer_id}/status", json={"status": "suspended"}, headers=_auth(mgr)).status_code == 403
    assert client.post(f"{API}/users/{officer_id}/roles", json={"role": "viewer"}, headers=_auth(mgr)).status_code == 403
    # Built-in roles carry name-based authority, so only admins may assign them.
    r = client.post(f"{API}/users/{victim_id}/roles", json={"role": "surveyor"}, headers=_auth(mgr))
    assert r.status_code == 403 and "built-in" in r.json()["detail"]


def test_reconciliation_flags_duplicate_refs_and_nonzero_difference(client):
    _, admin = _make_user("dup.admin@example.com", "admin")
    for _ in range(2):
        client.post(f"{API}/finance/ledger/adjustments", json={
            "debit_account": "cash", "credit_account": "premium_income", "amount": "100.00",
            "description": "manual premium", "external_reference": "pay_dup_1"}, headers=_auth(admin))
    # adjustments aren't premium_received; post genuine premiums via direct service for this check
    from app.services import finance_service
    db = SessionLocal()
    try:
        for _ in range(2):
            finance_service.post_entry(db, entry_type="premium_received", amount="100.00",
                                       external_reference="pay_dup_2", description="dup premium")
        db.commit()
    finally:
        db.close()
    today = date.today().isoformat()
    run = client.post(f"{API}/finance/reconciliations", json={
        "source": "payment_gateway", "period_start": today, "period_end": today,
        "lines": [{"reference": "pay_dup_2", "amount": "200.00"}]}, headers=_auth(admin)).json()
    assert run["status"] == "mismatched"
    assert run["results"]["duplicate_ledger_references"][0]["reference"] == "pay_dup_2"
    assert run["matched_count"] == 0


def test_payout_reference_must_be_unique(client):
    a = _settled_claim(client, "uniq.a@example.com")
    _approve_and_settle(client, a, reference="UTR-SAME")
    b = _settled_claim(client, "uniq.b@example.com")
    client.post(f"{API}/claims/{b['claim_id']}/survey-reports", json={
        "inspection_date": "2026-11-06T15:00:00Z", "inspection_location": "Dock 3",
        "damage_assessment": "Water damage to 40% of cartons confirmed on inspection.",
        "cause_of_loss": "seawater_ingress", "is_covered_peril": True, "estimated_loss_amount": "190000.00",
        "salvage_value": "10000.00", "recommended_settlement": "180000.00"}, headers=_auth(b["surveyor"]))
    client.post(f"{API}/claims/{b['claim_id']}/review", json={"status": "approved", "approved_amount": "180000.00",
                "officer_notes": "ok"}, headers=_auth(b["officer"]))
    r = client.post(f"{API}/claims/{b['claim_id']}/settle", json={"settlement_reference": "UTR-SAME"}, headers=_auth(b["officer"]))
    assert r.status_code == 409
    assert client.get(f"{API}/claims/{b['claim_id']}", headers=_auth(b["cust"])).json()["status"] == "approved"

    sid = client.get(f"{API}/settlements/me", headers=_auth(a["cust"])).json()[0]["id"]
    client.post(f"{API}/settlements/{sid}/mark-failed", json={"reason": "account closed"}, headers=_auth(a["officer"]))
    assert client.post(f"{API}/settlements/{sid}/retry", json={"payout_reference": "UTR-SAME"}, headers=_auth(a["officer"])).status_code == 409
    # Normalisation: case and whitespace variants are the same reference.
    assert client.post(f"{API}/settlements/{sid}/retry", json={"payout_reference": "  utr-same "}, headers=_auth(a["officer"])).status_code == 409
    ok = client.post(f"{API}/settlements/{sid}/retry", json={"payout_reference": "utr-new-1"}, headers=_auth(a["officer"]))
    assert ok.status_code == 200 and ok.json()["payout_reference"] == "UTR-NEW-1"
    # Database-level guard: a direct duplicate insert is rejected.
    from sqlalchemy.exc import IntegrityError
    from app.models.finance import PayoutReference
    db = SessionLocal()
    try:
        db.add(PayoutReference(reference="UTR-NEW-1", source_type="settlement", source_id="x"))
        with pytest.raises(IntegrityError):
            db.commit()
    finally:
        db.rollback(); db.close()


def test_payout_reference_backfill_covers_ledger_history(client):
    from app.database.payout_backfill import BACKFILL_SQL

    ctx = _settled_claim(client, "backfill.flow@example.com")
    _approve_and_settle(client, ctx, reference="UTR-FIRST")
    sid = client.get(f"{API}/settlements/me", headers=_auth(ctx["cust"])).json()[0]["id"]
    client.post(f"{API}/settlements/{sid}/mark-failed", json={"reason": "bounced"}, headers=_auth(ctx["officer"]))
    client.post(f"{API}/settlements/{sid}/retry", json={"payout_reference": "UTR-SECOND"}, headers=_auth(ctx["officer"]))

    db = SessionLocal()
    try:
        db.execute(text("DELETE FROM payout_references"))
        db.commit()
        db.execute(text(BACKFILL_SQL))
        db.commit()
        refs = sorted(r[0] for r in db.execute(text("SELECT reference FROM payout_references")))
        assert refs == ["UTR-FIRST", "UTR-SECOND"]  # failed attempt survives only in the ledger
        db.execute(text(BACKFILL_SQL))  # idempotent
        db.commit()
        assert db.execute(text("SELECT COUNT(*) FROM payout_references")).scalar() == 2
    finally:
        db.close()
    assert client.post(f"{API}/settlements/{sid}/mark-failed", json={"reason": "bounced again"}, headers=_auth(ctx["officer"])).status_code == 200
    assert client.post(f"{API}/settlements/{sid}/retry", json={"payout_reference": "utr-first"}, headers=_auth(ctx["officer"])).status_code == 409
