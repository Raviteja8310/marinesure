"""
Phase 10 tests: System diagnostics, health checks, and master demo data seeding.
"""

from app.database.connection import SessionLocal
from app.models.claim_incident import Claim, Incident
from app.models.payment_policy import Policy
from app.models.shipment import Shipment
from app.models.user import User
from app.services.seed_service import seed_demo_environment


def test_system_status_and_health(client):
    res = client.get("/api/v1/system/status")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["status"] == "healthy"
    assert data["app_version"] == "2.0.0"
    assert data["database"]["status"] == "connected"
    assert data["modules"]["authentication"] == "active"
    assert data["modules"]["underwriting"] == "active"
    assert data["modules"]["iot_telemetry"] == "active"


def test_seed_demo_environment_and_logins(client):
    # 1. Execute demo seed
    seed_res = client.post("/api/v1/system/seed-demo")
    assert seed_res.status_code == 200, seed_res.text
    seed_data = seed_res.json()
    assert seed_data["status"] == "success"
    assert len(seed_data["demo_accounts"]) == 6

    # 2. Verify all 6 demo accounts can authenticate with MarineSure@2026
    for acc in seed_data["demo_accounts"]:
        login_res = client.post(
            "/api/v1/auth/login",
            json={"email": acc["email"], "password": acc["password"]},
        )
        assert login_res.status_code == 200, f"Failed for {acc['email']}: {login_res.text}"
        auth_body = login_res.json()
        assert "access_token" in auth_body
        assert auth_body["user"]["email"] == acc["email"]

    # 3. Check seeded entities in DB
    db = SessionLocal()
    try:
        assert db.query(Shipment).count() >= 1
        assert db.query(Policy).count() >= 1
        assert db.query(Claim).count() >= 1
        assert db.query(Incident).count() >= 1
    finally:
        db.close()
