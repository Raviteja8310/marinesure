"""
Phase 9 tests: IoT Container Telemetry, Automated Casualty Detection,
Bill of Lading Document AI Parser, and Computer Vision Casualty Classifier.
"""

from decimal import Decimal
from app.tests.conftest import register_and_verify
from app.tests.test_shipments import _shipment, _token, _auth
from app.database.connection import SessionLocal
from app.models.user import User, Role
from app.core.security import create_access_token


def _setup_shipment_and_policy(client, email="iot_cust@example.com"):
    """Helper to create a customer with shipment and active policy."""
    token = _token(client, email)
    ship_res = client.post(
        "/api/v1/shipments",
        json=_shipment(
            cargo_items=[
                {
                    "cargo_name": "Frozen Seafood",
                    "category": "perishable",
                    "quantity": 200,
                    "value": "3000000.00",
                }
            ]
        ),
        headers=_auth(token),
    )
    shipment_id = ship_res.json()["id"]

    # Setup admin to approve
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).one()
    admin_role = db.query(Role).filter(Role.role_name == "admin").one()
    if admin_role not in user.roles:
        user.roles.append(admin_role)
    db.commit()
    admin_token = create_access_token({"sub": user.id, "roles": ["customer", "admin"]})
    db.close()

    products = client.get("/api/v1/insurance-products").json()
    mci = next(p for p in products if p["product_code"] == "MCI")

    app_res = client.post(
        "/api/v1/applications",
        json={
            "shipment_id": shipment_id,
            "product_id": mci["id"],
            "requested_insured_amount": "3000000.00",
        },
        headers=_auth(token),
    )
    app_id = app_res.json()["id"]

    client.post(
        f"/api/v1/applications/{app_id}/review",
        json={"decision": "approved", "risk_score": "low", "officer_remarks": "OK"},
        headers=_auth(admin_token),
    )

    order_res = client.post(
        "/api/v1/payments/create-order",
        json={"application_id": app_id},
        headers=_auth(token),
    )
    order_id = order_res.json()["id"]
    client.post(
        f"/api/v1/payments/{order_id}/verify",
        json={"gateway_payment_id": f"pay_iot_{order_id[:8]}"},
        headers=_auth(token),
    )

    return token, admin_token, shipment_id


def test_iot_telemetry_normal_ingestion(client):
    token, admin_token, shipment_id = _setup_shipment_and_policy(client, "iot_n@example.com")

    res = client.post(
        "/api/v1/telemetry/ingest",
        json={
            "shipment_id": shipment_id,
            "temperature_celsius": "-18.5",
            "humidity_pct": "65",
            "shock_g_force": "0.3",
            "door_status": "sealed",
            "location_name": "Indian Ocean, GPS Track",
        },
        headers=_auth(token),
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["is_anomaly"] is False
    assert data["door_status"] == "sealed"
    assert float(data["temperature_celsius"]) == -18.5

    # Check summary
    summary_res = client.get(
        f"/api/v1/telemetry/shipment/{shipment_id}/summary",
        headers=_auth(token),
    )
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["total_data_points"] == 1
    assert summary["anomalies_detected"] == 0
    assert summary["status"] == "normal"


def test_iot_telemetry_reefer_breach_triggers_incident(client):
    token, admin_token, shipment_id = _setup_shipment_and_policy(
        client, "iot_breach@example.com"
    )

    # Ingest breach: reefer perishable at > -5.0 C
    res = client.post(
        "/api/v1/telemetry/ingest",
        json={
            "shipment_id": shipment_id,
            "temperature_celsius": "12.5",
            "humidity_pct": "95",
            "shock_g_force": "0.1",
            "door_status": "sealed",
            "location_name": "Suez Canal",
        },
        headers=_auth(token),
    )
    assert res.status_code == 201
    data = res.json()
    assert data["is_anomaly"] is True
    assert "Reefer temperature breach" in data["anomaly_details"]

    # Check that incident was auto-created
    incidents_res = client.get("/api/v1/incidents", headers=_auth(token))
    assert incidents_res.status_code == 200
    incidents = incidents_res.json()
    iot_incidents = [i for i in incidents if i["incident_type"] == "iot_sensor_breach"]
    assert len(iot_incidents) >= 1
    assert "IoT sensor trigger" in iot_incidents[0]["description"]


def test_bill_of_lading_document_ai_extraction(client):
    token = _token(client, "docai_user@example.com")

    bl_text = """
    MAERSK LINE OCEAN BILL OF LADING
    B/L NO: BL-MAEU3948102
    VESSEL: SOVEREIGN MAERSK  VOYAGE: 2411E
    PORT OF LOADING (POL): Shanghai, China
    PORT OF DISCHARGE (POD): Hamburg, Germany
    SHIPPER: Shenzhen Electronics Manufacturing Co., Ltd
    CONSIGNEE: Berlin Distribution GmbH
    CONTAINER NO: MSKU2819374
    CARGO: 500 Cartons of Consumer Electronics
    DECLARED VALUE: USD 1,200,000.00
    GROSS WEIGHT: 32,000 KGS
    """

    res = client.post(
        "/api/v1/ai/parse-bill-of-lading",
        json={"document_text": bl_text, "document_name": "Maersk_BL.pdf"},
        headers=_auth(token),
    )
    assert res.status_code == 200, res.text
    ext = res.json()
    assert ext["bl_number"] == "BL-MAEU3948102"
    assert "SOVEREIGN MAERSK" in ext["vessel_name"]
    assert ext["cargo_category"] == "electronics"
    assert ext["confidence_score"] > 90.0
    assert "MSKU2819374" in ext["container_numbers"]


def test_computer_vision_damage_classifier(client):
    token = _token(client, "vision_test@example.com")

    # 1. Water damage classification
    res = client.post(
        "/api/v1/ai/analyze-damage",
        json={
            "image_url_or_base64": "cargo_photo_water_ingress_corrosion.jpg",
            "cargo_category": "machinery",
        },
        headers=_auth(token),
    )
    assert res.status_code == 200, res.text
    v = res.json()
    assert v["detected_damage_type"] == "seawater_ingress_corrosion"
    assert v["confidence_pct"] > 90.0
    assert v["peril_coverage_status"] == "covered_under_icc_a"
    assert len(v["icc_clauses_applied"]) >= 1
    assert len(v["damage_symptoms"]) >= 2

    # 2. Crush impact classification
    res2 = client.post(
        "/api/v1/ai/analyze-damage",
        json={
            "image_url_or_base64": "cargo_drop_impact_crush.jpg",
            "cargo_category": "electronics",
        },
        headers=_auth(token),
    )
    v2 = res2.json()
    assert v2["detected_damage_type"] == "rough_handling_crush"
    assert v2["severity_rating"] == "moderate"
