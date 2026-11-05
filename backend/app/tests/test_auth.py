"""Phase 2: registration, verification, login, lockout, and role boundaries."""

from app.tests.conftest import register_and_verify


def _login(client, email, password="CorrectHorse9"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_duplicate_email_is_rejected(client):
    register_and_verify(client, "ada@example.com")
    again = client.post(
        "/api/v1/auth/register",
        json={"name": "Ada Two", "email": "ada@example.com", "password": "CorrectHorse9", "role": "customer"},
    )
    assert again.status_code == 409


def test_unverified_user_cannot_log_in(client):
    client.post(
        "/api/v1/auth/register",
        json={"name": "Bea", "email": "bea@example.com", "password": "CorrectHorse9", "role": "customer"},
    )
    response = _login(client, "bea@example.com")
    assert response.status_code == 403


def test_login_issues_token_and_me_returns_role(client):
    register_and_verify(client, "cy@example.com", role="surveyor", qualification="IILA")
    response = _login(client, "cy@example.com")
    assert response.status_code == 200
    token = response.json()["access_token"]
    me = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    body = me.json()
    assert body["roles"] == ["surveyor"]
    assert body["profile"]["qualification"] == "IILA"


def test_wrong_password_is_rejected(client):
    register_and_verify(client, "dee@example.com")
    response = _login(client, "dee@example.com", password="not-the-password")
    assert response.status_code == 401


def test_account_locks_after_repeated_failures(client):
    register_and_verify(client, "locked@example.com")
    for _ in range(5):
        assert _login(client, "locked@example.com", password="wrong").status_code == 401
    response = _login(client, "locked@example.com")
    assert response.status_code == 423


def test_customer_cannot_list_users(client):
    register_and_verify(client, "eve@example.com")
    token = _login(client, "eve@example.com").json()["access_token"]
    response = client.get("/api/v1/users", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403


def test_user_cannot_self_assign_admin(client):
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Mallory", "email": "mallory@example.com", "password": "CorrectHorse9", "role": "admin"},
    )
    assert response.status_code == 422


def test_password_reset_then_old_password_fails(client):
    register_and_verify(client, "fay@example.com")
    requested = client.post("/api/v1/auth/forgot-password", json={"email": "fay@example.com"})
    token = requested.json()["dev_token"]
    reset = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "BrandNewHorse9"},
    )
    assert reset.status_code == 200
    assert _login(client, "fay@example.com").status_code == 401
    assert _login(client, "fay@example.com", "BrandNewHorse9").status_code == 200


def test_refresh_token_rotates_and_cannot_be_reused(client):
    register_and_verify(client, "gio@example.com")
    first = _login(client, "gio@example.com").json()
    rotated = client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert rotated.status_code == 200
    reused = client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert reused.status_code == 401


def test_password_change_requires_current_password(client):
    register_and_verify(client, "hal@example.com")
    token = _login(client, "hal@example.com").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    wrong = client.post(
        "/api/v1/users/me/password",
        json={"current_password": "nope", "new_password": "AnotherHorse9"},
        headers=headers,
    )
    assert wrong.status_code == 400
    changed = client.post(
        "/api/v1/users/me/password",
        json={"current_password": "CorrectHorse9", "new_password": "AnotherHorse9"},
        headers=headers,
    )
    assert changed.status_code == 200
