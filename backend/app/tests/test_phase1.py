"""Phase 1: health endpoints, Argon2 hashing, and JWT handling."""

from app.core.security import create_access_token, decode_token, hash_password, verify_password


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app"] == "MarineSure"
    assert data["version"] == "2.0.0"


def test_api_info_endpoint(client):
    response = client.get("/api/v1")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "active"
    assert data["documentation"] == "/docs"


def test_password_hashing_argon2():
    password = "SuperSecurePassword123!"
    hashed = hash_password(password)
    assert hashed != password
    assert hashed.startswith("$argon2")
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_jwt_token_generation_and_decoding():
    payload = {"sub": "123", "email": "test@marinesure.local", "roles": ["customer"]}
    token = create_access_token(payload)
    decoded = decode_token(token)
    assert decoded is not None
    assert decoded["sub"] == "123"
    assert decoded["roles"] == ["customer"]
    assert decoded["type"] == "access"
