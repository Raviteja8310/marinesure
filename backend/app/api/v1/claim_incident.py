"""
REST API endpoints for Incident Reporting, Claims Management, and Surveyor Inspections.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user_payload
from app.database.connection import get_db
from app.models.claim_incident import Incident, SurveyReport
from app.models.user import Role, User
from app.schemas.claim_incident import (
    ClaimAssignSurveyor,
    ClaimCreate,
    ClaimOut,
    ClaimReview,
    ClaimSettle,
    IncidentCreate,
    IncidentOut,
    SurveyReportCreate,
    SurveyReportOut,
)
from app.services.claim_service import IncidentClaimService

router = APIRouter(tags=["Incidents, Claims & Surveyor Inspections"])


def _user(db: Session, payload: dict) -> User:
    user = db.get(User, payload["sub"])
    if user is None or user.status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is not active")
    return user


# ── Incidents ───────────────────────────────────────────────────

@router.post("/incidents", response_model=IncidentOut, status_code=201)
def report_incident(
    payload: IncidentCreate,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Report an incident or casualty affecting cargo in transit."""
    user = _user(db, user_payload)
    return IncidentClaimService.report_incident(db, payload, user)


@router.get("/incidents", response_model=List[IncidentOut])
def list_incidents(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """List incidents visible to the requesting user."""
    user = _user(db, user_payload)
    return IncidentClaimService.list_incidents(db, user)


@router.get("/incidents/{incident_id}", response_model=IncidentOut)
def get_incident(
    incident_id: str,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Get single incident details."""
    _user(db, user_payload)
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    return incident


# ── Claims ──────────────────────────────────────────────────────

@router.post("/claims", response_model=ClaimOut, status_code=201)
def submit_claim(
    payload: ClaimCreate,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Submit an insurance claim against an active policy."""
    user = _user(db, user_payload)
    return IncidentClaimService.submit_claim(db, payload, user)


@router.get("/claims", response_model=List[ClaimOut])
def list_claims(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """List claims based on role (claimant, assigned surveyor, or insurance officer)."""
    user = _user(db, user_payload)
    return IncidentClaimService.list_claims(db, user)


@router.get("/claims/{claim_id}", response_model=ClaimOut)
def get_claim(
    claim_id: str,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Retrieve full details of an insurance claim including surveyor inspection reports."""
    user = _user(db, user_payload)
    return IncidentClaimService.get_claim(db, claim_id, user)


@router.post("/claims/{claim_id}/assign-surveyor", response_model=ClaimOut)
def assign_surveyor(
    claim_id: str,
    payload: ClaimAssignSurveyor,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Insurance officer assigns a certified marine surveyor to inspect damage."""
    user = _user(db, user_payload)
    return IncidentClaimService.assign_surveyor(db, claim_id, payload.surveyor_id, user)


@router.post("/claims/{claim_id}/survey-reports", response_model=SurveyReportOut, status_code=201)
def submit_survey_report(
    claim_id: str,
    payload: SurveyReportCreate,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Marine surveyor submits physical inspection findings and settlement recommendation."""
    user = _user(db, user_payload)
    return IncidentClaimService.submit_survey_report(db, claim_id, payload, user)


@router.get("/claims/{claim_id}/survey-reports", response_model=List[SurveyReportOut])
def get_claim_survey_reports(
    claim_id: str,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """List all survey reports filed for a claim."""
    user = _user(db, user_payload)
    # verify access via get_claim
    IncidentClaimService.get_claim(db, claim_id, user)
    return (
        db.query(SurveyReport)
        .filter(SurveyReport.claim_id == claim_id)
        .order_by(SurveyReport.created_at.desc())
        .all()
    )


@router.post("/claims/{claim_id}/review", response_model=ClaimOut)
def review_claim(
    claim_id: str,
    payload: ClaimReview,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Insurance officer reviews claim, sets approved amount, and calculates deductible/net payable."""
    user = _user(db, user_payload)
    return IncidentClaimService.review_claim(db, claim_id, payload, user)


@router.post("/claims/{claim_id}/settle", response_model=ClaimOut)
def settle_claim(
    claim_id: str,
    payload: ClaimSettle,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Execute settlement payout for an approved claim."""
    user = _user(db, user_payload)
    return IncidentClaimService.settle_claim(
        db, claim_id, user, settlement_reference=payload.settlement_reference
    )


# ── Surveyor Helper Endpoints ───────────────────────────────────

@router.get("/surveyors")
def list_surveyors(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """List certified marine surveyors for claim assignment."""
    user = _user(db, user_payload)
    surveyors = (
        db.query(User)
        .join(User.roles)
        .filter(Role.role_name == "surveyor", User.status == "active")
        .all()
    )
    return [
        {
            "id": s.id,
            "full_name": s.name,
            "email": s.email,
            "qualification": s.surveyor_profile.qualification if s.surveyor_profile else None,
            "license_number": s.surveyor_profile.license_number if s.surveyor_profile else None,
        }
        for s in surveyors
    ]


@router.get("/surveyor/assignments", response_model=List[ClaimOut])
def list_surveyor_assignments(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """List inspection assignments designated for the logged-in marine surveyor."""
    user = _user(db, user_payload)
    return IncidentClaimService.list_claims(db, user)
