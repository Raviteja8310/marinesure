"""
REST API endpoints for Portfolio Analytics, Financial KPIs, and Risk Assessment Engine.
"""

from decimal import Decimal
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user_payload
from app.database.connection import get_db
from app.models.user import User
from app.services.analytics_service import AnalyticsService
from app.services.risk_service import RiskAssessmentEngine

router = APIRouter(tags=["Portfolio Analytics & Risk Engine"])


def _user(db: Session, payload: dict) -> User:
    user = db.get(User, payload["sub"])
    if user is None or user.status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is not active")
    return user


def _require_staff(user: User) -> None:
    if not (set(user.role_names) & {"insurance_officer", "senior_officer", "admin"}):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Access restricted to Insurance Underwriters and Administrators",
        )


# -------------------------------------------------------------
# Request Schemas
# -------------------------------------------------------------

class RouteRiskRequest(BaseModel):
    origin_country: str
    origin_location: str
    dest_country: str
    dest_location: str


class CustomRiskRequest(BaseModel):
    insured_amount: Decimal = Field(..., gt=0)
    cargo_category: str = "general"
    transport_mode: str = "sea"
    origin_country: str
    origin_location: str
    dest_country: str
    dest_location: str


# -------------------------------------------------------------
# Analytics Endpoints
# -------------------------------------------------------------

@router.get("/analytics/dashboard-kpis")
def get_dashboard_kpis(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Retrieve operational and financial KPIs including GWP and loss ratio."""
    user = _user(db, user_payload)
    _require_staff(user)
    return AnalyticsService.get_dashboard_kpis(db)


@router.get("/analytics/portfolio-exposure")
def get_portfolio_exposure(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Retrieve portfolio risk exposure breakdowns by mode, cargo type, and country."""
    user = _user(db, user_payload)
    _require_staff(user)
    return AnalyticsService.get_portfolio_exposure(db)


@router.get("/analytics/monthly-trends")
def get_monthly_trends(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Retrieve GWP vs Claims trajectory."""
    user = _user(db, user_payload)
    _require_staff(user)
    return AnalyticsService.get_monthly_trends(db)


# -------------------------------------------------------------
# Risk Engine Endpoints
# -------------------------------------------------------------

@router.post("/risk/evaluate-route")
def evaluate_route(
    payload: RouteRiskRequest,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Evaluate maritime transit corridor and chokepoint hazards."""
    _user(db, user_payload)
    return RiskAssessmentEngine.evaluate_route_risk(
        origin_country=payload.origin_country,
        origin_location=payload.origin_location,
        dest_country=payload.dest_country,
        dest_location=payload.dest_location,
    )


@router.post("/risk/evaluate-custom")
def evaluate_custom_risk(
    payload: CustomRiskRequest,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Run full algorithmic risk score (0-100) on custom shipment parameters."""
    _user(db, user_payload)
    return RiskAssessmentEngine.calculate_composite_risk(
        insured_amount=payload.insured_amount,
        cargo_category=payload.cargo_category,
        transport_mode=payload.transport_mode,
        origin_country=payload.origin_country,
        origin_location=payload.origin_location,
        dest_country=payload.dest_country,
        dest_location=payload.dest_location,
    )


@router.get("/risk/evaluate-application/{application_id}")
def evaluate_application(
    application_id: str,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Evaluate risk score, tier, and recommended warranties for a specific insurance application."""
    user = _user(db, user_payload)
    _require_staff(user)
    res = RiskAssessmentEngine.evaluate_application(db, application_id)
    if "error" in res:
        raise HTTPException(status.HTTP_404_NOT_FOUND, res["error"])
    return res
