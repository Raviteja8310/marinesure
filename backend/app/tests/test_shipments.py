"""Phase 3: shipment registration, ownership, documents, and milestones."""

import io

from app.tests.conftest import register_and_verify

CARGO = {
    "cargo_name": "Basmati rice",
    "category": "foodstuff",
    "quantity": 200,
    "unit": "bags",
    "value": "1500000.00",
}


def _shipment(**overrides):
    payload = {
        "transport_mode": "sea",
        "origin_country": "India",
        "origin_location": "Chennai",
        "destination_country": "UAE",
        "destination_location": "Dubai",
        "currency": "INR",
        "cargo_items": [CARGO],
        "containers": [{"container_number": "MSCU1234567", "container_type": "20ft"}],
    }
    payload.update(overrides)
    return payload


def _token(client, email, role="customer", **extra):
    register_and_verify(client, email, role=role, **extra)
    return client.post(
        "/api/v1/auth/login", json={"email": email, "password": "CorrectHorse9"}
    ).json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_customer_registers_shipment_with_reference(client):
    token = _token(client, "owner@example.com")
    response = client.post("/api/v1/shipments", json=_shipment(), headers=_auth(token))
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["shipment_number"].startswith("MS-")
    assert body["declared_value"] == "1500000.00"
    assert body["status"] == "registered"
    assert len(body["milestones"]) == 1
    assert body["route_details"] is None


def test_shipment_requires_at_least_one_cargo_item(client):
    token = _token(client, "empty@example.com")
    response = client.post(
        "/api/v1/shipments", json=_shipment(cargo_items=[]), headers=_auth(token)
    )
    assert response.status_code == 422


def test_other_customer_cannot_see_shipment(client):
    owner = _token(client, "owner2@example.com")
    created = client.post("/api/v1/shipments", json=_shipment(), headers=_auth(owner))
    shipment_id = created.json()["id"]

    stranger = _token(client, "stranger@example.com")
    hidden = client.get(f"/api/v1/shipments/{shipment_id}", headers=_auth(stranger))
    assert hidden.status_code == 403
    listing = client.get("/api/v1/shipments", headers=_auth(stranger))
    assert listing.json() == []


def test_assigned_shipping_company_records_forward_milestone_only(client):
    company = _token(client, "carrier@example.com", role="shipping_company", company_name="BlueWave Lines")
    company_id = client.get("/api/v1/users/me", headers=_auth(company)).json()["id"]

    owner = _token(client, "owner3@example.com")
    created = client.post(
        "/api/v1/shipments",
        json=_shipment(shipping_company_id=company_id),
        headers=_auth(owner),
    )
    shipment_id = created.json()["id"]

    denied = client.post(
        f"/api/v1/shipments/{shipment_id}/milestones",
        json={"status": "dispatched", "location": "Chennai"},
        headers=_auth(owner),
    )
    assert denied.status_code == 403

    moved = client.post(
        f"/api/v1/shipments/{shipment_id}/milestones",
        json={"status": "dispatched", "location": "Chennai port", "remarks": "Loaded"},
        headers=_auth(company),
    )
    assert moved.status_code == 201
    assert moved.json()["status"] == "dispatched"

    backward = client.post(
        f"/api/v1/shipments/{shipment_id}/milestones",
        json={"status": "registered"},
        headers=_auth(company),
    )
    assert backward.status_code == 409


def test_dispatched_shipment_cannot_be_edited(client):
    company = _token(client, "carrier2@example.com", role="shipping_company", company_name="NorthStar")
    company_id = client.get("/api/v1/users/me", headers=_auth(company)).json()["id"]
    owner = _token(client, "owner4@example.com")
    created = client.post(
        "/api/v1/shipments",
        json=_shipment(shipping_company_id=company_id),
        headers=_auth(owner),
    )
    shipment_id = created.json()["id"]
    client.post(
        f"/api/v1/shipments/{shipment_id}/milestones",
        json={"status": "in_transit"},
        headers=_auth(company),
    )
    edited = client.patch(
        f"/api/v1/shipments/{shipment_id}",
        json={"destination_location": "Sharjah"},
        headers=_auth(owner),
    )
    assert edited.status_code == 409


def test_unsupported_document_is_rejected(client):
    token = _token(client, "owner5@example.com")
    created = client.post("/api/v1/shipments", json=_shipment(), headers=_auth(token))
    shipment_id = created.json()["id"]
    response = client.post(
        f"/api/v1/shipments/{shipment_id}/documents",
        data={"document_type": "commercial_invoice"},
        files={"file": ("invoice.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
        headers=_auth(token),
    )
    assert response.status_code == 415


def test_pdf_upload_advances_status(client):
    token = _token(client, "owner6@example.com")
    created = client.post("/api/v1/shipments", json=_shipment(), headers=_auth(token))
    shipment_id = created.json()["id"]
    response = client.post(
        f"/api/v1/shipments/{shipment_id}/documents",
        data={"document_type": "packing_list"},
        files={"file": ("packing.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")},
        headers=_auth(token),
    )
    assert response.status_code == 201, response.text
    detail = client.get(f"/api/v1/shipments/{shipment_id}", headers=_auth(token))
    assert detail.json()["status"] == "documents_submitted"
    assert detail.json()["documents"][0]["original_filename"] == "packing.pdf"
