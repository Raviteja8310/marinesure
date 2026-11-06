"""
Phase 7 tests: Marine Underwriting Risk Assessment Engine, Portfolio Analytics,
Loss Ratio calculations, and Exposure Analysis.
"""

from decimal import Decimal
from app.tests.conftest import register_and_verify
from app.tests.test_shipments import _shipment, _token, _auth
from app.database.connection import SessionLocal
from app.models.user import User, Role
from app.core.security import create_access_token
from app.services.risk_service import RiskAssessmentEngine


def _setup_officer_and_policy(client):
    """Create customer with active policy and an insurance officer user."""
    cust_token = _token(client, "analytics_cust@example.com")
    officer_token = _token(client, "officer_risk@example.com")

    # Grant officer role
    db = SessionLocal()
    off_user = db.query(User).filter(User.email == "officer_risk@example.com").one()
    off_role = db.query(Role).filter(Role.role_name == "insurance_officer").one()
    if off_role not in off_user.roles:
        off_user.roles.append(off_role)
    db.commit()
    officer_token = create_access_token(
        {"sub": off_user.id, "roles": ["customer", "insurance_officer"]}
    )

    # Also grant admin role to approve application
    admin_role = db.query(Role).filter(Role.role_name == "admin").one()
    if admin_role not in off_user.roles:
        off_user.roles.append(admin_role)
    db.commit()
    officer_token = create_access_token(
        {"sub": off_user.id, "roles": ["customer", "insurance_officer", "admin"]}
    )
    db.close()

    # Create shipment
    ship_res = client.post(
        "/api/v1/shipments",
        json=_shipment(
            origin_country="India",
            origin_location="Nhava Sheva Port",
            destination_country="Egypt",
            destination_location="Port Said (via Red Sea)",
            cargo_items=[
                {
                    "cargo_name": "Lithium Batteries",
                    "category": "hazardous",
                    "quantity": 20,
                    "value": "2000000.00",
                }
            ],
        ),
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
            "requested_insured_amount": "2000000.00",
        },
        headers=_auth(cust_token),
    )
    app_id = app_res.json()["id"]

    # Approve application
    client.post(
        f"/api/v1/applications/{app_id}/review",
        json={"decision": "approved", "risk_score": "medium", "officer_remarks": "Approved with survey warranty"},
        headers=_auth(officer_token),
    )

    # Issue policy via payment
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

    return cust_token, officer_token, app_id, policy_id


def test_risk_assessment_engine_route_and_composite():
    # 1. Standard low-risk route
    low_risk = RiskAssessmentEngine.calculate_composite_risk(
        insured_amount=Decimal("500000.00"),
        cargo_category="general",
        transport_mode="air",
        origin_country="France",
        origin_location="Paris Airport",
        dest_country="Germany",
        dest_location="Frankfurt Airport",
    )
    assert low_risk["risk_tier"] == "LOW"
    assert low_risk["composite_score"] <= 35
    assert "Fast-track" in low_risk["recommendation"]

    # 2. High-risk hazardous cargo via Red Sea
    high_risk = RiskAssessmentEngine.calculate_composite_risk(
        insured_amount=Decimal("60000000.00"),
        cargo_category="hazardous",
        transport_mode="sea",
        origin_country="India",
        origin_location="Mumbai",
        dest_country="Yemen",
        dest_location="Aden (Red Sea transit)",
    )
    assert high_risk["risk_tier"] in ("HIGH", "CRITICAL")
    assert high_risk["composite_score"] > 65
    assert len(high_risk["suggested_warranties"]) >= 2
    assert high_risk["components"]["route_risk"]["is_war_risk_zone"] is True


def test_evaluate_application_endpoint(client):
    cust_token, officer_token, app_id, policy_id = _setup_officer_and_policy(client)

    # Customer forbidden
    cust_res = client.get(
        f"/api/v1/risk/evaluate-application/{app_id}",
        headers=_auth(cust_token),
    )
    assert cust_res.status_code == 403

    # Officer can evaluate
    off_res = client.get(
        f"/api/v1/risk/evaluate-application/{app_id}",
        headers=_auth(officer_token),
    )
    assert off_res.status_code == 200, off_res.text
    data = off_res.json()
    assert "composite_score" in data
    assert "risk_tier" in data
    assert data["components"]["cargo_risk"]["cargo_category"] == "hazardous"


def test_dashboard_kpis_and_loss_ratio(client):
    cust_token, officer_token, app_id, policy_id = _setup_officer_and_policy(client)

    # 1. Customer cannot access financial analytics
    cust_res = client.get("/api/v1/analytics/dashboard-kpis", headers=_auth(cust_token))
    assert cust_res.status_code == 403

    # 2. Officer accesses analytics
    kpi_res = client.get("/api/v1/analytics/dashboard-kpis", headers=_auth(officer_token))
    assert kpi_res.status_code == 200, kpi_res.text
    kpi = kpi_res.json()
    assert "financials" in kpi
    assert "operations" in kpi
    assert kpi["financials"]["gross_written_premium"] > 0
    assert kpi["operations"]["active_policies_count"] >= 1
    assert "portfolio_loss_ratio_pct" in kpi["financials"]

    # 3. Portfolio Exposure
    exp_res = client.get("/api/v1/analytics/portfolio-exposure", headers=_auth(officer_token))
    assert exp_res.status_code == 200, exp_res.text
    exp = exp_res.json()
    assert "transport_modes" in exp
    assert "cargo_categories" in exp
    assert "product_performance" in exp
    assert len(exp["product_performance"]) > 0

    # 4. Monthly trends
    trend_res = client.get("/api/v1/analytics/monthly-trends", headers=_auth(officer_token))
    assert trend_res.status_code == 200, trend_res.text
    trend = trend_res.json()
    assert len(trend["monthly_financial_history"]) >= 6
