"""Inspection scheduling for assigned surveyors, and surveyor report history."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user_payload
from app.database.connection import get_db
from app.models.claim_incident import Claim, SurveyReport
from app.models.service_ops import InspectionAppointment
from app.models.user import User
from app.services.agent_service import AuditService, NotificationService
from app.services.rbac_service import has_permission, load_active_user

router = APIRouter(tags=["Inspections & Surveyor Reports"])

SCHEDULABLE_CLAIM_STATUSES = {"surveyor_assigned", "inspection_completed", "under_review"}
MAX_DURATION = timedelta(hours=12)


def _naive_utc(value: datetime) -> datetime:
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value.replace(microsecond=0)


class Window(BaseModel):
    scheduled_start: datetime
    scheduled_end: datetime

    @model_validator(mode="after")
    def _check(self):
        start, end = _naive_utc(self.scheduled_start), _naive_utc(self.scheduled_end)
        if end <= start:
            raise ValueError("scheduled_end must be after scheduled_start")
        if end - start > MAX_DURATION:
            raise ValueError("An inspection slot cannot exceed 12 hours")
        self.scheduled_start, self.scheduled_end = start, end
        return self


class InspectionCreate(Window):
    claim_id: str
    location: str = Field(min_length=3, max_length=255)
    notes: Optional[str] = Field(default=None, max_length=2000)


class InspectionReschedule(Window):
    reason: str = Field(min_length=5, max_length=500)
    location: Optional[str] = Field(default=None, min_length=3, max_length=255)


class InspectionCancel(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


class InspectionOut(BaseModel):
    id: str
    appointment_number: str
    claim_id: str
    claim_number: Optional[str]
    surveyor_id: str
    surveyor_name: Optional[str]
    scheduled_start: datetime
    scheduled_end: datetime
    location: str
    status: str
    notes: Optional[str]
    cancellation_reason: Optional[str]
    reschedule_count: int
    created_at: datetime


class SurveyorReportOut(BaseModel):
    id: str
    report_number: str
    claim_id: str
    claim_number: Optional[str]
    claim_status: Optional[str]
    shipment_id: Optional[str]
    inspection_date: datetime
    inspection_location: str
    cause_of_loss: str
    is_covered_peril: bool
    estimated_loss_amount: Decimal
    salvage_value: Decimal
    recommended_settlement: Decimal
    status: str
    officer_comments: Optional[str]
    created_at: datetime


def _out(a: InspectionAppointment) -> InspectionOut:
    return InspectionOut(
        id=a.id, appointment_number=a.appointment_number, claim_id=a.claim_id,
        claim_number=a.claim.claim_number if a.claim else None, surveyor_id=a.surveyor_id,
        surveyor_name=a.surveyor.name if a.surveyor else None, scheduled_start=a.scheduled_start,
        scheduled_end=a.scheduled_end, location=a.location, status=a.status, notes=a.notes,
        cancellation_reason=a.cancellation_reason, reschedule_count=a.reschedule_count, created_at=a.created_at,
    )


def _can_manage(db: Session, user: User, appt_or_claim_surveyor: Optional[str]) -> bool:
    return has_permission(db, user, "inspections.manage") or (
        "surveyor" in user.role_names and appt_or_claim_surveyor == user.id
    )


def _ensure_free(db: Session, surveyor_id: str, start: datetime, end: datetime, exclude_id: Optional[str] = None) -> None:
    q = db.query(InspectionAppointment).filter(
        InspectionAppointment.surveyor_id == surveyor_id,
        InspectionAppointment.status == "scheduled",
        InspectionAppointment.scheduled_start < end,
        InspectionAppointment.scheduled_end > start,
    )
    if exclude_id:
        q = q.filter(InspectionAppointment.id != exclude_id)
    clash = q.first()
    if clash:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Surveyor already has inspection {clash.appointment_number} in that slot")


def _get(db: Session, appointment_id: str) -> InspectionAppointment:
    a = db.get(InspectionAppointment, appointment_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Inspection appointment not found")
    return a


def _notify(db: Session, a: InspectionAppointment, title: str, message: str) -> None:
    NotificationService.send(db, a.surveyor_id, title, message, "info", "/surveyor/schedule")
    if a.claim and a.claim.claimant_id:
        NotificationService.send(db, a.claim.claimant_id, title, message, "info", "/customer/claims")


@router.post("/inspections", response_model=InspectionOut, status_code=201)
def schedule_inspection(data: InspectionCreate, payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)):
    user = load_active_user(db, payload)
    claim = db.get(Claim, data.claim_id)
    if claim is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Claim not found")
    if not claim.assigned_surveyor_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "Assign a surveyor to the claim before scheduling an inspection")
    if not _can_manage(db, user, claim.assigned_surveyor_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the assigned surveyor or claims staff can schedule this inspection")
    if claim.status not in SCHEDULABLE_CLAIM_STATUSES:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Inspections cannot be scheduled for a claim in status '{claim.status}'")
    _ensure_free(db, claim.assigned_surveyor_id, data.scheduled_start, data.scheduled_end)
    a = InspectionAppointment(
        appointment_number=f"INS-{datetime.now(timezone.utc):%Y}-{db.query(InspectionAppointment).count() + 1:06d}",
        claim_id=claim.id, surveyor_id=claim.assigned_surveyor_id, scheduled_start=data.scheduled_start,
        scheduled_end=data.scheduled_end, location=data.location, notes=data.notes, status="scheduled",
        created_by_id=user.id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    _notify(db, a, "Inspection scheduled",
            f"Inspection {a.appointment_number} for claim {claim.claim_number} at {a.location} on {a.scheduled_start:%d %b %Y %H:%M} UTC.")
    AuditService.record(db, "INSPECTION_SCHEDULED", "inspection", a.id, user.id, {"claim_id": claim.id})
    return _out(a)


@router.get("/inspections", response_model=list[InspectionOut])
def list_inspections(
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """Calendar feed: surveyors see their own, staff see all, customers see their claims'."""
    user = load_active_user(db, payload)
    q = db.query(InspectionAppointment)
    if not has_permission(db, user, "inspections.view_all"):
        if "surveyor" in user.role_names:
            q = q.filter(InspectionAppointment.surveyor_id == user.id)
        else:
            q = q.join(Claim, Claim.id == InspectionAppointment.claim_id).filter(Claim.claimant_id == user.id)
    if date_from:
        q = q.filter(InspectionAppointment.scheduled_end >= _naive_utc(date_from))
    if date_to:
        q = q.filter(InspectionAppointment.scheduled_start <= _naive_utc(date_to))
    if status_filter:
        q = q.filter(InspectionAppointment.status == status_filter)
    return [_out(a) for a in q.order_by(InspectionAppointment.scheduled_start.asc()).all()]


@router.get("/inspections/{appointment_id}", response_model=InspectionOut)
def get_inspection(appointment_id: str, payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)):
    user = load_active_user(db, payload)
    a = _get(db, appointment_id)
    allowed = (
        has_permission(db, user, "inspections.view_all")
        or a.surveyor_id == user.id
        or (a.claim and a.claim.claimant_id == user.id)
    )
    if not allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    return _out(a)


@router.post("/inspections/{appointment_id}/reschedule", response_model=InspectionOut)
def reschedule_inspection(appointment_id: str, data: InspectionReschedule, payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)):
    user = load_active_user(db, payload)
    a = _get(db, appointment_id)
    if not _can_manage(db, user, a.surveyor_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    if a.status != "scheduled":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Cannot reschedule an inspection that is {a.status}")
    _ensure_free(db, a.surveyor_id, data.scheduled_start, data.scheduled_end, exclude_id=a.id)
    a.scheduled_start, a.scheduled_end = data.scheduled_start, data.scheduled_end
    if data.location:
        a.location = data.location
    a.reschedule_count += 1
    a.notes = ((a.notes + "\n") if a.notes else "") + f"Rescheduled: {data.reason}"
    db.commit()
    db.refresh(a)
    _notify(db, a, "Inspection rescheduled", f"{a.appointment_number} moved to {a.scheduled_start:%d %b %Y %H:%M} UTC. Reason: {data.reason}")
    AuditService.record(db, "INSPECTION_RESCHEDULED", "inspection", a.id, user.id, {"reason": data.reason})
    return _out(a)


@router.post("/inspections/{appointment_id}/cancel", response_model=InspectionOut)
def cancel_inspection(appointment_id: str, data: InspectionCancel, payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)):
    user = load_active_user(db, payload)
    a = _get(db, appointment_id)
    if not _can_manage(db, user, a.surveyor_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    if a.status != "scheduled":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Cannot cancel an inspection that is {a.status}")
    a.status = "cancelled"
    a.cancellation_reason = data.reason
    db.commit()
    db.refresh(a)
    _notify(db, a, "Inspection cancelled", f"{a.appointment_number} was cancelled: {data.reason}")
    AuditService.record(db, "INSPECTION_CANCELLED", "inspection", a.id, user.id, {"reason": data.reason})
    return _out(a)


@router.post("/inspections/{appointment_id}/complete", response_model=InspectionOut)
def complete_inspection(appointment_id: str, payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)):
    user = load_active_user(db, payload)
    a = _get(db, appointment_id)
    if not _can_manage(db, user, a.surveyor_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    if a.status != "scheduled":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Inspection is already {a.status}")
    a.status = "completed"
    db.commit()
    db.refresh(a)
    return _out(a)


@router.get("/surveyor/reports", response_model=list[SurveyorReportOut])
def my_survey_reports(payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)):
    """Consolidated survey report history for the signed-in surveyor (staff see all)."""
    user = load_active_user(db, payload)
    q = db.query(SurveyReport)
    if not has_permission(db, user, "inspections.view_all"):
        if "surveyor" not in user.role_names:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only surveyors and claims staff can view survey reports")
        q = q.filter(SurveyReport.surveyor_id == user.id)
    rows = q.order_by(SurveyReport.created_at.desc()).all()
    return [
        SurveyorReportOut(
            id=r.id, report_number=r.report_number, claim_id=r.claim_id,
            claim_number=r.claim.claim_number if r.claim else None,
            claim_status=r.claim.status if r.claim else None,
            shipment_id=r.claim.incident.shipment_id if r.claim and r.claim.incident else None,
            inspection_date=r.inspection_date, inspection_location=r.inspection_location,
            cause_of_loss=r.cause_of_loss, is_covered_peril=r.is_covered_peril,
            estimated_loss_amount=r.estimated_loss_amount, salvage_value=r.salvage_value,
            recommended_settlement=r.recommended_settlement, status=r.status,
            officer_comments=r.officer_comments, created_at=r.created_at,
        )
        for r in rows
    ]
