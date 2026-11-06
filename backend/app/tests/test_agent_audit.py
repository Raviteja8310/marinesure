"""
Phase 8 tests: Agent broker commissions, in-app notifications, and compliance audit logs.
"""

from decimal import Decimal
from app.tests.conftest import register_and_verify
from app.tests.test_shipments import _shipment, _token, _auth
from app.database.connection import SessionLocal
from app.models.user import User, Role
from app.core.security import create_access_token


def _setup_agent_and_policy(client):
    """Set up customer with active policy and an agent user."""
    cust_token = _token(client, "broker_cust@example.com")
    agent_token = _token(client, "broker_agent@example.com")
    officer_token = _token(client, "broker_officer@example.com")

    db = SessionLocal()
    # Grant agent role
    agent_user = db.query(User).filter(User.email == "broker_agent@example.com").one()
    agent_role = db.query(Role).filter(Role.role_name == "agent").one()
    if agent_role not in agent_user.roles:
        agent_user.roles.append(agent_role)

    # Grant officer and admin roles
    off_user = db.query(User).filter(User.email == "broker_officer@example.com").one()
    off_role = db.query(Role).filter(Role.role_name == "insurance_officer").one()
    admin_role = db.query(Role).filter(Role.role_name == "admin").one()
    if off_role not in off_user.roles:
        off_user.roles.append(off_role)
    if admin_role not in off_user.roles:
        off_user.roles.append(admin_role)

    db.commit()

    agent_token = create_access_token(
        {"sub": agent_user.id, "roles": ["customer", "agent"]}
    )
    officer_token = create_access_token(
        {"sub": off_user.id, "roles": ["customer", "insurance_officer", "admin"]}
    )
    db.close()

    # Create shipment & application
    ship_res = client.post(
        "/api/v1/shipments",
        json=_shipment(),
        headers=_auth(cust_token),
    )
    shipment_id = ship_res.json()["id"]

    products = client.get("/api/v1/insurance-products").json()
    mci = next(p for p in products if p["product_code"] == "MCI")

    app_res = client.post(
        "/api/v1/applications",
        json={
            "shipment_id": shipment_id,
            "product_id": mci["id"],
            "requested_insured_amount": "1000000.00",
        },
        headers=_auth(cust_token),
    )
    app_id = app_res.json()["id"]

    # Approve application
    client.post(
        f"/api/v1/applications/{app_id}/review",
        json={"decision": "approved", "risk_score": "low", "officer_remarks": "Approved"},
        headers=_auth(officer_token),
    )

    # Pay and issue policy
    order_res = client.post(
        "/api/v1/payments/create-order",
        json={"application_id": app_id},
        headers=_auth(cust_token),
    )
    order_id = order_res.json()["id"]

    verify_res = client.post(
        f"/api/v1/payments/{order_id}/verify",
        json={"gateway_payment_id": f"pay_test_{order_id[:8]}"},
        headers=_auth(cust_token),
    )
    policy_id = verify_res.json()["id"]

    return cust_token, agent_token, officer_token, policy_id


def test_agent_commission_accrual_and_payout(client):
    cust_token, agent_token, officer_token, policy_id = _setup_agent_and_policy(client)

    # 1. Agent records commission
    comm_res = client.post(
        "/api/v1/agent/commissions/record",
        json={"policy_id": policy_id, "commission_rate": "10.00"},
        headers=_auth(agent_token),
    )
    assert comm_res.status_code == 201, comm_res.text
    comm = comm_res.json()
    assert comm["commission_reference"].startswith("COM-")
    assert comm["status"] == "accrued"
    assert float(comm["commission_rate"]) == 10.0
    assert float(comm["commission_amount"]) > 0
    comm_id = comm["id"]

    # 2. Check agent metrics
    metric_res = client.get("/api/v1/agent/metrics", headers=_auth(agent_token))
    assert metric_res.status_code == 200
    metrics = metric_res.json()
    assert metrics["policies_sold"] >= 1
    assert metrics["total_commission_earned"] > 0
    assert metrics["pending_commission"] > 0

    # 3. Customer cannot disburse commission payout
    unauth_payout = client.post(
        f"/api/v1/agent/commissions/{comm_id}/payout",
        json={},
        headers=_auth(cust_token),
    )
    assert unauth_payout.status_code == 403

    # 4. Officer executes payout
    payout_res = client.post(
        f"/api/v1/agent/commissions/{comm_id}/payout",
        json={"payout_reference": "DISBURSE-2026-001"},
        headers=_auth(officer_token),
    )
    assert payout_res.status_code == 200, payout_res.text
    paid_comm = payout_res.json()
    assert paid_comm["status"] == "paid"
    assert paid_comm["payout_reference"] == "DISBURSE-2026-001"
    assert paid_comm["paid_at"] is not None


def test_notifications_and_audit_logs(client):
    cust_token, agent_token, officer_token, policy_id = _setup_agent_and_policy(client)

    # Trigger commission to generate notification and audit log
    client.post(
        "/api/v1/agent/commissions/record",
        json={"policy_id": policy_id, "commission_rate": "12.00"},
        headers=_auth(agent_token),
    )

    # 1. Fetch Agent notifications
    notes_res = client.get("/api/v1/notifications", headers=_auth(agent_token))
    assert notes_res.status_code == 200, notes_res.text
    notes = notes_res.json()
    assert len(notes) >= 1
    unread = next(n for n in notes if not n["is_read"])
    assert "Commission Accrued" in unread["title"]

    # 2. Mark single notification as read
    read_res = client.post(
        f"/api/v1/notifications/{unread['id']}/read",
        headers=_auth(agent_token),
    )
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True

    # 3. Mark all read
    all_read_res = client.post("/api/v1/notifications/read-all", headers=_auth(agent_token))
    assert all_read_res.status_code == 200

    # 4. Customer cannot view audit logs
    unauth_audit = client.get("/api/v1/audit-logs", headers=_auth(cust_token))
    assert unauth_audit.status_code == 403

    # 5. Officer/Admin views audit logs
    audit_res = client.get("/api/v1/audit-logs", headers=_auth(officer_token))
    assert audit_res.status_code == 200, audit_res.text
    logs = audit_res.json()
    assert len(logs) >= 1
    actions = [l["action"] for l in logs]
    assert "COMMISSION_ACCRUED" in actions
