"""Shared fixtures. Auth tests run against a fresh SQLite database."""

import os

os.environ["DATABASE_URL_OVERRIDE"] = "sqlite:///./test_marinesure.db"
os.environ["APP_ENV"] = "development"
os.environ["DEBUG"] = "false"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.config import get_settings

get_settings.cache_clear()
settings = get_settings()

from app.database.connection import Base  # noqa: E402
import app.models  # noqa: E402,F401
from app.services.auth_service import seed_roles  # noqa: E402

_test_engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_test_engine)


def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


from app.database.connection import get_db  # noqa: E402
from app.main import app as application  # noqa: E402

application.dependency_overrides[get_db] = _override_get_db


@pytest.fixture(autouse=True)
def fresh_database():
    Base.metadata.drop_all(bind=_test_engine)
    Base.metadata.create_all(bind=_test_engine)
    db = TestingSessionLocal()
    seed_roles(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=_test_engine)


@pytest.fixture
def client():
    with TestClient(application) as test_client:
        yield test_client


def register_and_verify(client, email, role="customer", **extra):
    payload = {
        "name": "Test User",
        "email": email,
        "password": "CorrectHorse9",
        "role": role,
        **extra,
    }
    created = client.post("/api/v1/auth/register", json=payload)
    assert created.status_code == 201, created.text
    verified = client.post(
        "/api/v1/auth/verify-email", json={"token": created.json()["dev_token"]}
    )
    assert verified.status_code == 200, verified.text
    return payload
