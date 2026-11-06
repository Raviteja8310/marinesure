"""
REST APIs for System Diagnostics, Health, and Demo Environment Seeding.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import get_settings
from app.database.connection import get_db
from app.services.seed_service import seed_demo_environment
from app.core.permissions import UserRole, require_roles

router = APIRouter(tags=["System Administration & Diagnostics"])
settings = get_settings()


@router.get("/system/status")
def system_diagnostics(db: Session = Depends(get_db)):
    """Comprehensive system diagnostics, database connectivity, and environment status."""
    db_healthy = True
    db_latency_ms = 0.0
    try:
        start = datetime.now()
        db.execute(text("SELECT 1"))
        db_latency_ms = round((datetime.now() - start).total_seconds() * 1000, 2)
    except Exception:
        db_healthy = False

    return {
        "status": "healthy" if db_healthy else "degraded",
        "app_name": settings.APP_NAME,
        "app_version": "2.0.0",
        "environment": settings.APP_ENV,
        "database": {
            "status": "connected" if db_healthy else "unreachable",
            "latency_ms": db_latency_ms,
        },
        "modules": {
            "authentication": "active",
            "shipments": "active",
            "underwriting": "active",
            "payments_policies": "active",
            "claims_surveys": "active",
            "risk_engine": "active",
            "iot_telemetry": "active",
            "document_ai": "active",
            "broker_portal": "active",
        },
    }


from datetime import datetime


@router.post("/system/seed-demo")
def seed_demo_data(
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_roles(UserRole.ADMIN)),
):
    """Seed demo records only in an explicitly enabled development environment."""
    if settings.APP_ENV.lower() != "development" or not settings.DEBUG:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demo seeding is disabled outside development",
        )
    return seed_demo_environment(db)
