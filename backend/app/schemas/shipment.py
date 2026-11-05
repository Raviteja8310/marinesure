"""Request and response schemas for shipments."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.models.shipment import DOCUMENT_TYPES, SHIPMENT_STATUSES, TRANSPORT_MODES

TransportMode = Literal["sea", "air", "road", "rail", "multimodal"]
ShipmentStatus = Literal[
    "registered",
    "documents_submitted",
    "ready_for_dispatch",
    "dispatched",
    "in_transit",
    "transshipment",
    "arrived",
    "customs_clearance",
    "out_for_delivery",
    "delivered",
    "archived",
]
DocumentType = Literal["commercial_invoice", "packing_list", "shipping_document", "other"]


class CargoItemIn(BaseModel):
    cargo_name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    category: str = Field(min_length=1, max_length=80)
    quantity: int = Field(gt=0)
    unit: str = Field(default="units", max_length=20)
    value: Decimal = Field(ge=0, max_digits=15, decimal_places=2)


class ContainerIn(BaseModel):
    container_number: str = Field(min_length=1, max_length=30)
    container_type: str = Field(min_length=1, max_length=40)
    seal_number: Optional[str] = Field(default=None, max_length=40)


class ShipmentCreate(BaseModel):
    transport_mode: TransportMode
    origin_country: str = Field(min_length=2, max_length=80)
    origin_location: str = Field(min_length=2, max_length=150)
    destination_country: str = Field(min_length=2, max_length=80)
    destination_location: str = Field(min_length=2, max_length=150)
    departure_date: Optional[date] = None
    expected_arrival_date: Optional[date] = None
    currency: str = Field(default="INR", min_length=3, max_length=3)
    packaging_details: Optional[str] = None
    special_handling: Optional[str] = None
    route_details: Optional[str] = None
    shipping_company_id: Optional[str] = None
    cargo_items: list[CargoItemIn] = Field(min_length=1)
    containers: list[ContainerIn] = []


class ShipmentUpdate(BaseModel):
    transport_mode: Optional[TransportMode] = None
    origin_country: Optional[str] = Field(default=None, max_length=80)
    origin_location: Optional[str] = Field(default=None, max_length=150)
    destination_country: Optional[str] = Field(default=None, max_length=80)
    destination_location: Optional[str] = Field(default=None, max_length=150)
    departure_date: Optional[date] = None
    expected_arrival_date: Optional[date] = None
    packaging_details: Optional[str] = None
    special_handling: Optional[str] = None
    route_details: Optional[str] = None
    shipping_company_id: Optional[str] = None


class MilestoneCreate(BaseModel):
    status: ShipmentStatus
    location: Optional[str] = Field(default=None, max_length=150)
    remarks: Optional[str] = None
    event_time: Optional[datetime] = None


class CargoItemOut(CargoItemIn):
    id: str
    model_config = {"from_attributes": True}


class ContainerOut(ContainerIn):
    id: str
    model_config = {"from_attributes": True}


class MilestoneOut(BaseModel):
    id: str
    status: str
    location: Optional[str]
    remarks: Optional[str]
    event_time: datetime
    recorded_by: str
    model_config = {"from_attributes": True}


class DocumentOut(BaseModel):
    id: str
    document_type: str
    original_filename: str
    content_type: str
    size_bytes: int
    uploaded_at: datetime
    model_config = {"from_attributes": True}


class ShipmentOut(BaseModel):
    id: str
    shipment_number: str
    customer_id: str
    shipping_company_id: Optional[str]
    status: str
    transport_mode: str
    origin_country: str
    origin_location: str
    destination_country: str
    destination_location: str
    departure_date: Optional[date]
    expected_arrival_date: Optional[date]
    currency: str
    declared_value: Decimal
    packaging_details: Optional[str]
    special_handling: Optional[str]
    route_details: Optional[str] = None
    cargo_items: list[CargoItemOut]
    containers: list[ContainerOut]
    milestones: list[MilestoneOut]
    documents: list[DocumentOut]
    created_at: datetime

    model_config = {"from_attributes": True}


assert set(TRANSPORT_MODES) and set(SHIPMENT_STATUSES) and set(DOCUMENT_TYPES)
