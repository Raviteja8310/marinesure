"""
Phase 4 tests: Insurance products, premium calculation, quotations, and underwriting workflow.
"""

from decimal import Decimal
from app.tests.conftest import register_and_verify
from app.tests.test_shipments import _shipment, _token, _auth


def test_list_products_returns_all_seven_canonical_products(client):
    response = client.get("/api/v1/insurance-products")
    assert response.status_code == 200
    products = response.json()
    assert len(products) == 7
    codes = {p["product_code"] for p in products}
    assert codes == {"MCI", "ICI", "ECI", "ITI", "VBI", "AOP", "SCC"}
    # Verify coverages and exclusions are populated
    mci = next(p for p in products if p["product_code"] == "MCI")
    assert len(mci["coverages"]) >= 4
    assert len(mci["exclusions"]) >= 3


def test_generate_quotation_with_correct_formula_and_gst(client):
    owner = _token(client, "quoter@example.com")
    # Declared value: 10,00,000 INR
    shipment_res = client.post(
        "/api/v1/shipments",
        json=_shipment(cargo_items=[{"cargo_name": "Machinery", "category": "general", "quantity": 10, "value": "1000000.00"}]),
        headers=_auth(owner),
    )
    shipment_id = shipment_res.json()["id"]

    products = client.get("/api/v1/insurance-products").json()
    mci = next(p for p in products if p["product_code"] == "MCI")

    quote_res = client.post(
        "/api/v1/quotations",
        json={"shipment_id": shipment_id, "product_id": mci["id"]},
        headers=_auth(owner),
    )
    assert quote_res.status_code == 201, quote_res.text
    q = quote_res.json()
    assert q["quotation_number"].startswith("QT-")
    # Base rate = 0.5% = 0.0050. Value = 10,00,000.
    # Base premium = 10,00,000 * 0.0050 = 5,000.
    assert Decimal(str(q["base_premium"])) == Decimal("5000.00")
    # Additional charges = 500.00
    assert Decimal(str(q["additional_charges"])) == Decimal("500.00")
    # Subtotal = 5,500. Tax = 18% of 5,500 = 990.00
    assert Decimal(str(q["tax_amount"])) == Decimal("990.00")
    # Total = 6,490.00
    assert Decimal(str(q["total_premium"])) == Decimal("6490.00")
    # 5% deductible = 50,000 (>= min_deductible 5,000)
    assert Decimal(str(q["deductible_amount"])) == Decimal("50000.00")


def test_compare_products_for_shipment(client):
    owner = _token(client, "comparer@example.com")
    shipment_res = client.post(
        "/api/v1/shipments",
        json=_shipment(transport_mode="road"),
        headers=_auth(owner),
    )
    shipment_id = shipment_res.json()["id"]

    comparison_res = client.get(
        f"/api/v1/shipments/{shipment_id}/compare-products",
        headers=_auth(owner),
    )
    assert comparison_res.status_code == 200
    items = comparison_res.json()
    assert len(items) == 7

    # Inland Transit Insurance (ITI) must be eligible for road transport
    iti_item = next(i for i in items if i["product"]["product_code"] == "ITI")
    assert iti_item["is_eligible"] is True

    # Marine Cargo Insurance (MCI) allows sea/multimodal, so road transport should flag eligibility note
    mci_item = next(i for i in items if i["product"]["product_code"] == "MCI")
    assert mci_item["is_eligible"] is False
    assert any("road" in note for note in mci_item["eligibility_notes"])


def test_submit_insurance_application_and_officer_review(client):
    owner = _token(client, "applicant@example.com")
    shipment_res = client.post(
        "/api/v1/shipments",
        json=_shipment(cargo_items=[{"cargo_name": "Garments", "category": "textiles", "quantity": 500, "value": "2000000.00"}]),
        headers=_auth(owner),
    )
    shipment_id = shipment_res.json()["id"]

    products = client.get("/api/v1/insurance-products").json()
    eci = next(p for p in products if p["product_code"] == "ECI")

    # 1. Customer submits application
    app_res = client.post(
        "/api/v1/applications",
        json={
            "shipment_id": shipment_id,
            "product_id": eci["id"],
            "requested_insured_amount": "2000000.00",
            "special_conditions": "Keep dry warehouse storage at port",
        },
        headers=_auth(owner),
    )
    assert app_res.status_code == 201, app_res.text
    app_id = app_res.json()["id"]
    assert app_res.json()["status"] == "submitted"
    assert app_res.json()["application_number"].startswith("AP-")

    # 2. Customer cannot review/approve their own application
    unauth_review = client.post(
        f"/api/v1/applications/{app_id}/review",
        json={"decision": "approved", "risk_remarks": "Self approval"},
        headers=_auth(owner),
    )
    assert unauth_review.status_code == 403

    # 3. Create an authorized insurance officer
    from app.database.connection import SessionLocal
    from app.models.user import User, Role
    from app.core.security import create_access_token
    db = SessionLocal()
    admin_payload = register_and_verify(client, "admin_user@example.com")
    admin_obj = db.query(User).filter(User.email == "admin_user@example.com").one()
    admin_role = db.query(Role).filter(Role.role_name == "admin").one()
    admin_obj.roles.append(admin_role)
    db.commit()
    admin_token = create_access_token({"sub": admin_obj.id, "roles": ["customer", "admin"]})

    # Admin registers and assigns officer role
    officer_payload = register_and_verify(client, "officer_bob@example.com", role="customer")
    officer_user = db.query(User).filter(User.email == "officer_bob@example.com").one()
    assign_res = client.post(
        f"/api/v1/users/{officer_user.id}/roles",
        json={"role": "insurance_officer", "employee_code": "OFF-001", "department": "Marine Underwriting"},
        headers=_auth(admin_token),
    )
    assert assign_res.status_code == 200, assign_res.text
    db.close()

    officer_token = client.post(
        "/api/v1/auth/login", json={"email": "officer_bob@example.com", "password": "CorrectHorse9"}
    ).json()["access_token"]

    # 4. Officer reviews and approves application
    review_res = client.post(
        f"/api/v1/applications/{app_id}/review",
        json={
            "decision": "approved",
            "risk_score": "low",
            "risk_remarks": "Textiles in standard dry containers; seaworthy route.",
            "officer_remarks": "Application approved for policy issuance.",
        },
        headers=_auth(officer_token),
    )
    assert review_res.status_code == 200, review_res.text
    reviewed_app = review_res.json()
    assert reviewed_app["status"] == "approved"
    assert reviewed_app["reviewed_by"] == officer_user.id
    assert reviewed_app["officer_remarks"] == "Application approved for policy issuance."


def test_high_value_application_requires_senior_officer(client):
    owner = _token(client, "rich_client@example.com")
    # Declared value: 75,00,000 INR (> 50,00,000 referral threshold)
    shipment_res = client.post(
        "/api/v1/shipments",
        json=_shipment(cargo_items=[{"cargo_name": "Luxury Yachts", "category": "machinery", "quantity": 1, "value": "7500000.00"}]),
        headers=_auth(owner),
    )
    shipment_id = shipment_res.json()["id"]

    products = client.get("/api/v1/insurance-products").json()
    scc = next(p for p in products if p["product_code"] == "SCC")

    app_res = client.post(
        "/api/v1/applications",
        json={
            "shipment_id": shipment_id,
            "product_id": scc["id"],
            "requested_insured_amount": "7500000.00",
        },
        headers=_auth(owner),
    )
    app_id = app_res.json()["id"]

    # Regular insurance officer cannot approve high-value (referral threshold rule)
    from app.database.connection import SessionLocal
    from app.models.user import User, Role, OfficerProfile
    db = SessionLocal()
    regular_officer = User(
        name="Junior Officer",
        email="junior@marinesure.local",
        password_hash="test",
        status="active",
        email_verified=True,
    )
    regular_officer.roles.append(db.query(Role).filter(Role.role_name == "insurance_officer").one())
    regular_officer.officer_profile = OfficerProfile(employee_code="OFF-002", department="Underwriting")
    db.add(regular_officer)
    db.commit()
    db.refresh(regular_officer)

    from app.core.security import create_access_token
    jr_token = create_access_token({"sub": regular_officer.id, "roles": ["insurance_officer"]})

    denied = client.post(
        f"/api/v1/applications/{app_id}/review",
        json={"decision": "approved", "risk_score": "high"},
        headers=_auth(jr_token),
    )
    assert denied.status_code == 403
    assert "Senior Insurance Officer" in denied.json()["detail"]

    # Senior officer can approve
    sr_officer = User(
        name="Senior Officer",
        email="senior@marinesure.local",
        password_hash="test",
        status="active",
        email_verified=True,
    )
    sr_officer.roles.append(db.query(Role).filter(Role.role_name == "senior_officer").one())
    sr_officer.officer_profile = OfficerProfile(employee_code="SR-OFF-001", department="Executive Underwriting")
    db.add(sr_officer)
    db.commit()
    db.refresh(sr_officer)

    sr_token = create_access_token({"sub": sr_officer.id, "roles": ["senior_officer"]})
    approved = client.post(
        f"/api/v1/applications/{app_id}/review",
        json={"decision": "approved", "risk_score": "medium", "officer_remarks": "Senior underwriting authorization granted."},
        headers=_auth(sr_token),
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    db.close()
