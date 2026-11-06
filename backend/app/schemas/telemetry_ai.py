"""
Pydantic schemas for IoT container telemetry and Document/Vision AI extraction.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ── Container Telemetry ─────────────────────────────────────────

class ContainerTelemetryCreate(BaseModel):
    shipment_id: str
    container_id: Optional[str] = None
    temperature_celsius: Decimal = Field(..., ge=-50, le=80)
    humidity_pct: Decimal = Field(..., ge=0, le=100)
    shock_g_force: Optional[Decimal] = Field(default=Decimal("0.0"), ge=0, le=20)
    door_status: Optional[str] = Field(default="sealed", pattern="^(sealed|opened|tampered)$")
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    location_name: Optional[str] = None
    recorded_at: Optional[datetime] = None


class ContainerTelemetryOut(BaseModel):
    id: str
    shipment_id: str
    container_id: Optional[str]
    recorded_at: datetime
    temperature_celsius: Decimal
    humidity_pct: Decimal
    shock_g_force: Decimal
    door_status: str
    latitude: Optional[Decimal]
    longitude: Optional[Decimal]
    location_name: Optional[str]
    is_anomaly: bool
    anomaly_details: Optional[str]

    model_config = {"from_attributes": True}


class TelemetrySummaryOut(BaseModel):
    shipment_id: str
    current_temp: Optional[Decimal]
    avg_temp: Optional[Decimal]
    max_shock: Optional[Decimal]
    current_door_status: str
    total_data_points: int
    anomalies_detected: int
    status: str  # normal, warning, critical


# ── Document & Bill of Lading Extraction ───────────────────────

class DocumentParseRequest(BaseModel):
    document_text: str = Field(..., min_length=20)
    document_name: Optional[str] = "Bill_of_Lading.pdf"
    document_type: Optional[str] = "bill_of_lading"


class ExtractedBillOfLading(BaseModel):
    bl_number: str
    carrier_name: str
    vessel_name: str
    voyage_number: str
    port_of_loading: str
    port_of_discharge: str
    place_of_delivery: Optional[str]
    shipper_name: str
    consignee_name: str
    container_numbers: List[str]
    cargo_description: str
    cargo_category: str
    gross_weight_kg: float
    declared_value: Optional[Decimal]
    confidence_score: float


# ── Computer Vision Damage Analysis ─────────────────────────────

class VisionDamageAnalysisRequest(BaseModel):
    image_url_or_base64: str
    cargo_category: Optional[str] = "general"
    transport_mode: Optional[str] = "sea"


class VisionDamageAnalysisOut(BaseModel):
    detected_damage_type: str
    confidence_pct: float
    severity_rating: str  # minor, moderate, severe, total_loss
    peril_coverage_status: str  # covered_under_icc_a, excluded, requires_surveyor_verification
    icc_clauses_applied: List[str]
    estimated_depreciation_pct: float
    damage_symptoms: List[str]
    recommended_surveyor_action: str
