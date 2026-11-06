"""
Phase 6 tests: Incident reporting, insurance claims processing, surveyor assignments,
inspection reports, deductible calculations, and claim settlement payouts.
"""

from decimal import Decimal
from app.tests.conftest import register_and_verify
from app.tests.test_shipments import _shipment, _token, _auth
from app.database.connection import SessionLocal
from app.models.user import User, Role
from app.core.security import create_access_token


def _setup_active_policy(client, customer_email="claimant@example.com"):
    """Helper to create and return token, shipment_id, and active policy_id."""
    token = _token(client, customer_email)
    shipment_res = client.post(
        "/api/v1/shipments",
        json=_shipment(
            cargo_items=[
                {
                    "cargo_name": "Precision Machinery",
                    "category": "machinery",
                    "quantity": 10,
                    "value": "1000000.00",
                }
            ]
        ),
        headers=_auth(token),
    )
    shipment_id = shipment_res.json()["id"]

    products = client.get("/api/v1/insurance-products").json()
    mci = next(p for p in products if p["product_code"] == "MCI")

    app_res = client.post(
        "/api/v1/applications",
        json={
            "shipment_id": shipment_id,
            "product_id": mci["id"],
            "requested_insured_amount": "1000000.00",
        },
        headers=_auth(token),
    )
    app_id = app_res.json()["id"]

    # Approve application as admin/officer
    db = SessionLocal()
    user = db.query(User).filter(User.email == customer_email).one()
    admin_role = db.query(Role).filter(Role.role_name == "admin").one()
    if admin_role not in user.roles:
        user.roles.append(admin_role)
    db.commit()
    admin_token = create_access_token({"sub": user.id, "roles": ["customer", "admin"]})
    db.close()

    client.post(
        f"/api/v1/applications/{app_id}/review",
        json={"decision": "approved", "risk_score": "low", "officer_remarks": "Approved"},
        headers=_auth(admin_token),
    )

    # Create order & pay
    order_res = client.post(
        "/api/v1/payments/create-order",
        json={"application_id": app_id},
        headers=_auth(token),
    )
    order_id = order_res.json()["id"]

    verify_res = client.post(
        f"/api/v1/payments/{order_id}/verify",
        json={"gateway_payment_id": f"pay_test_{order_id[:8]}"},
        headers=_auth(token),
    )
    policy_id = verify_res.json()["id"]
    return token, admin_token, shipment_id, policy_id


def test_report_incident_for_shipment(client):
    token = _token(client, "shipper_inc@example.com")
    shipment_res = client.post(
        "/api/v1/shipments",
        json=_shipment(),
        headers=_auth(token),
    )
    shipment_id = shipment_res.json()["id"]

    res = client.post(
        "/api/v1/incidents",
        json={
            "shipment_id": shipment_id,
            "incident_date": "2026-11-06T12:00:00Z",
            "incident_type": "cargo_damage",
            "severity": "moderate",
            "location_name": "Port of Hamburg Container Terminal",
            "description": "Container stack collapsed during rough handling and shifting at dock.",
            "estimated_loss": "120000.00",
        },
        headers=_auth(token),
    )
    assert res.status_code == 201, res.text
    inc = res.json()
    assert inc["incident_number"].startswith("INC-")
    assert inc["status"] == "reported"
    assert inc["severity"] == "moderate"
    assert float(inc["estimated_loss"]) == 120000.0


def test_file_claim_and_validation(client):
    cust_token, admin_token, shipment_id, policy_id = _setup_active_policy(
        client, "claimant_val@example.com"
    )

    # 1. Report incident
    inc_res = client.post(
        "/api/v1/incidents",
        json={
            "shipment_id": shipment_id,
            "policy_id": policy_id,
            "incident_date": "2026-11-06T14:30:00Z",
            "incident_type": "water_ingress",
            "severity": "severe",
            "description": "Seawater entered hold during heavy weather; crates submerged.",
            "estimated_loss": "300000.00",
        },
        headers=_auth(cust_token),
    )
    inc_id = inc_res.json()["id"]

    # 2. Cannot exceed policy insured limit (1,000,000)
    over_res = client.post(
        "/api/v1/claims",
        json={
            "policy_id": policy_id,
            "incident_id": inc_id,
            "claim_amount": "2500000.00",
            "claim_type": "partial_loss",
        },
        headers=_auth(cust_token),
    )
    assert over_res.status_code == 400
    assert "cannot exceed" in over_res.json()["detail"].lower()

    # 3. Valid claim submission
    claim_res = client.post(
        "/api/v1/claims",
        json={
            "policy_id": policy_id,
            "incident_id": inc_id,
            "claim_amount": "250000.00",
            "claim_type": "partial_loss",
            "claimant_notes": "Urgent review required due to corrosion risks.",
        },
        headers=_auth(cust_token),
    )
    assert claim_res.status_code == 201, claim_res.text
    claim = claim_res.json()
    assert claim["claim_number"].startswith("CLM-")
    assert claim["status"] == "submitted"
    assert float(claim["claim_amount"]) == 250000.0


def test_surveyor_workflow_deductible_calculation_and_settlement(client):
    cust_token, officer_token, shipment_id, policy_id = _setup_active_policy(
        client, "insured_end2end@example.com"
    )

    # 1. Create a surveyor user
    surveyor_email = "surveyor_marine@example.com"
    surveyor_token = _token(client, surveyor_email)

    db = SessionLocal()
    surveyor_user = db.query(User).filter(User.email == surveyor_email).one()
    surveyor_role = db.query(Role).filter(Role.role_name == "surveyor").one()
    if surveyor_role not in surveyor_user.roles:
        surveyor_user.roles.append(surveyor_role)
    db.commit()
    surveyor_token = create_access_token(
        {"sub": surveyor_user.id, "roles": ["customer", "surveyor"]}
    )
    surveyor_id = surveyor_user.id
    db.close()

    # 2. Report incident & file claim
    inc_res = client.post(
        "/api/v1/incidents",
        json={
            "shipment_id": shipment_id,
            "incident_date": "2026-11-06T10:00:00Z",
            "incident_type": "refrigeration_failure",
            "severity": "severe",
            "description": "Compressor malfunction resulted in spoiled temperature-sensitive cargo.",
            "estimated_loss": "200000.00",
        },
        headers=_auth(cust_token),
    )
    inc_id = inc_res.json()["id"]

    claim_res = client.post(
        "/api/v1/claims",
        json={
            "policy_id": policy_id,
            "incident_id": inc_id,
            "claim_amount": "200000.00",
            "claim_type": "partial_loss",
        },
        headers=_auth(cust_token),
    )
    claim_id = claim_res.json()["id"]

    # 3. Officer assigns surveyor
    assign_res = client.post(
        f"/api/v1/claims/{claim_id}/assign-surveyor",
        json={"surveyor_id": surveyor_id},
        headers=_auth(officer_token),
    )
    assert assign_res.status_code == 200, assign_res.text
    assert assign_res.json()["status"] == "surveyor_assigned"
    assert assign_res.json()["assigned_surveyor_id"] == surveyor_id

    # 4. Surveyor submits inspection report
    survey_res = client.post(
        f"/api/v1/claims/{claim_id}/survey-reports",
        json={
            "inspection_date": "2026-11-06T15:00:00Z",
            "inspection_location": "Cold Storage Facility, Dock 3",
            "damage_assessment": "Reefer datalogger confirms temp rose to +18C for 48 hours; total spoilage.",
            "cause_of_loss": "reefer_temperature_breach",
            "is_covered_peril": True,
            "estimated_loss_amount": "190000.00",
            "salvage_value": "10000.00",
            "recommended_settlement": "180000.00",
        },
        headers=_auth(surveyor_token),
    )
    assert survey_res.status_code == 201, survey_res.text
    rep = survey_res.json()
    assert rep["report_number"].startswith("SRV-")
    assert rep["is_covered_peril"] is True

    # Check claim status is inspection_completed
    get_claim_res = client.get(f"/api/v1/claims/{claim_id}", headers=_auth(cust_token))
    assert get_claim_res.json()["status"] == "inspection_completed"

    # 5. Officer reviews claim, approves with 180,000 recommended settlement
    # Deductible: 5% of 180,000 = 9,000 (> min 5,000). Net payable = 180,000 - 9,000 = 171,000.
    review_res = client.post(
        f"/api/v1/claims/{claim_id}/review",
        json={
            "status": "approved",
            "approved_amount": "180000.00",
            "officer_notes": "Survey report verified. Approved as per ICC terms.",
        },
        headers=_auth(officer_token),
    )
    assert review_res.status_code == 200, review_res.text
    approved_claim = review_res.json()
    assert approved_claim["status"] == "approved"
    assert float(approved_claim["approved_amount"]) == 180000.0
    assert float(approved_claim["deductible_applied"]) == 9000.0
    assert float(approved_claim["net_payable"]) == 171000.0

    # 6. Settle claim payout
    settle_res = client.post(
        f"/api/v1/claims/{claim_id}/settle",
        json={},
        headers=_auth(officer_token),
    )
    assert settle_res.status_code == 200, settle_res.text
    settled = settle_res.json()
    assert settled["status"] == "settled"
    assert settled["settlement_reference"].startswith("SET-")
    assert settled["settled_at"] is not None
