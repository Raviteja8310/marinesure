"""
REST APIs for IoT Container Telemetry, Document AI Bill of Lading Extraction, and Computer Vision.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user_payload
from app.database.connection import get_db
from app.models.user import User
from app.schemas.telemetry_ai import (
    ContainerTelemetryCreate,
    ContainerTelemetryOut,
    DocumentParseRequest,
    ExtractedBillOfLading,
    TelemetrySummaryOut,
    VisionDamageAnalysisOut,
    VisionDamageAnalysisRequest,
)
from app.services.telemetry_ai_service import (
    DocumentAIService,
    TelemetryEngine,
    VisionCasualtyService,
)

router = APIRouter(tags=["IoT Telemetry, Document AI & Vision Intelligence"])


def _user(db: Session, payload: dict) -> User:
    user = db.get(User, payload["sub"])
    if user is None or user.status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is not active")
    return user


# ── IoT Telemetry Endpoints ─────────────────────────────────────

@router.post("/telemetry/ingest", response_model=ContainerTelemetryOut, status_code=201)
def ingest_telemetry(
    payload: ContainerTelemetryCreate,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """
    Ingest container IoT telemetry (temp, humidity, shock, seal).
    Triggers automated casualty incident if cold-chain or drop impact threshold is breached.
    """
    user = _user(db, user_payload)
    return TelemetryEngine.ingest_telemetry(db, payload, user)


@router.get("/telemetry/shipment/{shipment_id}", response_model=List[ContainerTelemetryOut])
def get_shipment_telemetry(
    shipment_id: str,
    limit: int = 100,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Retrieve telemetry log stream for a specific shipment."""
    _user(db, user_payload)
    return TelemetryEngine.get_shipment_telemetry(db, shipment_id, limit=limit)


@router.get("/telemetry/shipment/{shipment_id}/summary", response_model=TelemetrySummaryOut)
def get_shipment_telemetry_summary(
    shipment_id: str,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Retrieve aggregated IoT sensor health KPIs (current temp, max shock, door status)."""
    _user(db, user_payload)
    return TelemetryEngine.get_telemetry_summary(db, shipment_id)


# ── Document AI Extraction ──────────────────────────────────────

@router.post("/ai/parse-bill-of-lading", response_model=ExtractedBillOfLading)
def parse_bill_of_lading(
    payload: DocumentParseRequest,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """
    Extract maritime Bill of Lading data (Vessel, IMO, B/L #, POL, POD, Containers, Values)
    via Document AI parsing heuristics.
    """
    user = _user(db, user_payload)
    return DocumentAIService.parse_bill_of_lading(db, user, payload)


# ── Computer Vision Casualty Classifier ─────────────────────────

@router.post("/ai/analyze-damage", response_model=VisionDamageAnalysisOut)
def analyze_damage_image(
    payload: VisionDamageAnalysisRequest,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """
    AI Computer Vision classifier for cargo casualty damage photos.
    Classifies damage patterns and matches against Institute Cargo Clauses covered perils.
    """
    _user(db, user_payload)
    return VisionCasualtyService.analyze_damage_image(payload)
