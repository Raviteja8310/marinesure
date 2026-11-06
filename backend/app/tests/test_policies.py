"""
Phase 5 tests: Payments, backend verification, ReportLab PDF certificate issuance, renewals, endorsements, and cancellations.
"""

import os
from decimal import Decimal
from app.tests.conftest import register_and_verify
from app.tests.test_shipments import _shipment, _token, _auth
from app.database.connection import SessionLocal
from app.models.user import User, Role, OfficerProfile
from app.core.security import create_access_token


def test_payment_verification_issues_policy_and_pdf(client):
    owner = _token(client, "buyer@example.com")
    shipment_res = client.post(
        "/api/v1/shipments",
        json=_shipment(cargo_items=[{"cargo_name": "Electronics", "category": "electronics", "quantity": 100, "value": "1000000.00"}]),
        headers=_auth(owner),
    )
    shipment_id = shipment_res.json()["id"]

    products = client.get("/api/v1/insurance-products").json()
    mci = next(p for p in products if p["product_code"] == "MCI")

    app_res = client.post(
        "/api/v1/applications",
        json={"shipment_id": shipment_id, "product_id": mci["id"], "requested_insured_amount": "1000000.00"},
        headers=_auth(owner),
    )
    app_id = app_res.json()["id"]

    # Approve application as admin/officer
    db = SessionLocal()
    admin_user = db.query(User).filter(User.email == "buyer@example.com").one()
    admin_role = db.query(Role).filter(Role.role_name == "admin").one()
    admin_user.roles.append(admin_role)
    db.commit()
    admin_token = create_access_token({"sub": admin_user.id, "roles": ["customer", "admin"]})
    db.close()

    client.post(
        f"/api/v1/applications/{app_id}/review",
        json={"decision": "approved", "risk_score": "low", "officer_remarks": "Approved by admin"},
        headers=_auth(admin_token),
    )

    # 1. Create payment order
    order_res = client.post(
        "/api/v1/payments/create-order",
        json={"application_id": app_id},
        headers=_auth(owner),
    )
    assert order_res.status_code == 201, order_res.text
    order = order_res.json()
    assert order["status"] == "created"
    assert order["order_reference"].startswith("ORD-")

    # 2. Verify payment & issue policy
    verify_res = client.post(
        f"/api/v1/payments/{order['id']}/verify",
        json={"gateway_payment_id": "pay_test_998877665544"},
        headers=_auth(owner),
    )
    assert verify_res.status_code == 200, verify_res.text
    policy = verify_res.json()
    assert policy["policy_number"].startswith("POL-")
    assert policy["status"] == "active"
    assert policy["pdf_storage_key"] is not None
    assert os.path.exists(policy["pdf_storage_key"])

    # 3. Test PDF download endpoint
    pdf_res = client.get(f"/api/v1/policies/{policy['id']}/certificate", headers=_auth(owner))
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert len(pdf_res.content) > 1000  # ReportLab PDF binary content


def test_policy_endorsement_renewal_and_cancellation(client):
    owner = _token(client, "lifecycle@example.com")
    shipment_res = client.post(
        "/api/v1/shipments",
        json=_shipment(cargo_items=[{"cargo_name": "Steel Pipes", "category": "machinery", "quantity": 50, "value": "2000000.00"}]),
        headers=_auth(owner),
    )
    shipment_id = shipment_res.json()["id"]
    products = client.get("/api/v1/insurance-products").json()
    eci = next(p for p in products if p["product_code"] == "ECI")

    app_res = client.post(
        "/api/v1/applications",
        json={"shipment_id": shipment_id, "product_id": eci["id"], "requested_insured_amount": "2000000.00"},
        headers=_auth(owner),
    )
    app_id = app_res.json()["id"]

    db = SessionLocal()
    admin_user = db.query(User).filter(User.email == "lifecycle@example.com").one()
    admin_role = db.query(Role).filter(Role.role_name == "admin").one()
    if admin_role not in admin_user.roles:
        admin_user.roles.append(admin_role)
    db.commit()
    admin_token = create_access_token({"sub": admin_user.id, "roles": ["customer", "admin"]})
    db.close()

    client.post(
        f"/api/v1/applications/{app_id}/review",
        json={"decision": "approved", "risk_score": "low"},
        headers=_auth(admin_token),
    )

    order_res = client.post("/api/v1/payments/create-order", json={"application_id": app_id}, headers=_auth(owner))
    order_id = order_res.json()["id"]
    policy_res = client.post(
        f"/api/v1/payments/{order_id}/verify",
        json={"gateway_payment_id": "pay_lifecycle_001"},
        headers=_auth(owner),
    )
    policy_id = policy_res.json()["id"]

    # 1. Request Endorsement
    end_res = client.post(
        f"/api/v1/policies/{policy_id}/endorsements",
        json={"requested_changes": "Change vessel name to MV Ocean Star", "reason": "Carrier vessel reassignment"},
        headers=_auth(owner),
    )
    assert end_res.status_code == 201
    assert end_res.json()["status"] == "approved"

    # 2. Request Renewal
    ren_res = client.post(f"/api/v1/policies/{policy_id}/renewals", headers=_auth(owner))
    assert ren_res.status_code == 201
    assert ren_res.json()["status"] == "completed"

    # 3. Request Cancellation
    can_res = client.post(
        f"/api/v1/policies/{policy_id}/cancellations",
        json={"reason": "Shipment cancelled by buyer"},
        headers=_auth(owner),
    )
    assert can_res.status_code == 201
    assert can_res.json()["status"] == "approved"

    # Verify policy status is now cancelled
    pol_get = client.get(f"/api/v1/policies/{policy_id}", headers=_auth(owner))
    assert pol_get.json()["status"] == "cancelled"
