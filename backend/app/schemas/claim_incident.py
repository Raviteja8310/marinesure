"""
Schemas for incident reporting, insurance claims processing, and surveyor inspection reports.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------
# Incidents
# ---------------------------------------------------------

class IncidentCreate(BaseModel):
    shipment_id: str
    policy_id: Optional[str] = None
    incident_date: datetime
    incident_type: str = Field(..., min_length=2, max_length=60)
    severity: str = Field(default="moderate", pattern="^(minor|moderate|severe|total_loss)$")
    location_name: Optional[str] = Field(None, max_length=255)
    location_coordinates: Optional[str] = Field(None, max_length=100)
    description: str = Field(..., min_length=10)
    estimated_loss: Optional[Decimal] = Field(default=Decimal("0"), ge=0)
    photos_documents: Optional[List[Dict[str, Any]]] = None


class IncidentOut(BaseModel):
    id: str
    incident_number: str
    shipment_id: str
    policy_id: Optional[str]
    reported_by_id: str
    incident_date: datetime
    incident_type: str
    severity: str
    location_name: Optional[str]
    location_coordinates: Optional[str]
    description: str
    estimated_loss: Optional[Decimal]
    status: str
    photos_documents: Optional[List[Dict[str, Any]]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------
# Survey Reports
# ---------------------------------------------------------

class SurveyReportCreate(BaseModel):
    inspection_date: datetime
    inspection_location: str = Field(..., min_length=3, max_length=255)
    damage_assessment: str = Field(..., min_length=10)
    cause_of_loss: str = Field(..., min_length=3, max_length=100)
    is_covered_peril: bool = True
    estimated_loss_amount: Decimal = Field(..., gt=0)
    salvage_value: Optional[Decimal] = Field(default=Decimal("0"), ge=0)
    recommended_settlement: Decimal = Field(..., ge=0)
    evidence_photos: Optional[List[Dict[str, Any]]] = None


class SurveyReportOut(BaseModel):
    id: str
    report_number: str
    claim_id: str
    surveyor_id: str
    inspection_date: datetime
    inspection_location: str
    damage_assessment: str
    cause_of_loss: str
    is_covered_peril: bool
    estimated_loss_amount: Decimal
    salvage_value: Decimal
    recommended_settlement: Decimal
    evidence_photos: Optional[List[Dict[str, Any]]] = None
    status: str
    officer_comments: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------
# Claims
# ---------------------------------------------------------

class ClaimCreate(BaseModel):
    policy_id: str
    incident_id: str
    claim_amount: Decimal = Field(..., gt=0)
    claim_type: str = Field(default="partial_loss", pattern="^(partial_loss|total_loss|general_average|salvage)$")
    claimant_notes: Optional[str] = None
    supporting_documents: Optional[List[Dict[str, Any]]] = None


class ClaimAssignSurveyor(BaseModel):
    surveyor_id: str


class ClaimReview(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    approved_amount: Optional[Decimal] = Field(None, ge=0)
    officer_notes: Optional[str] = None
    rejection_reason: Optional[str] = None


class ClaimSettle(BaseModel):
    settlement_reference: Optional[str] = None


class ClaimOut(BaseModel):
    id: str
    claim_number: str
    policy_id: str
    incident_id: str
    claimant_id: str
    assigned_surveyor_id: Optional[str]
    reviewed_by_id: Optional[str]
    claim_amount: Decimal
    approved_amount: Optional[Decimal]
    deductible_applied: Optional[Decimal]
    net_payable: Optional[Decimal]
    status: str
    claim_type: str
    claimant_notes: Optional[str]
    officer_notes: Optional[str]
    rejection_reason: Optional[str]
    settlement_reference: Optional[str]
    settled_at: Optional[datetime]
    supporting_documents: Optional[List[Dict[str, Any]]] = None
    created_at: datetime
    updated_at: datetime
    survey_reports: Optional[List[SurveyReportOut]] = None

    model_config = {"from_attributes": True}
