"""
Shipment, cargo, container, route, document, and milestone tables.

A shipment belongs to one customer. A shipping company sees it only after the
customer assigns that company. Editing is blocked once the shipment is in transit.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database.base import SoftDeleteMixin, TimestampMixin
from app.database.connection import Base

TRANSPORT_MODES = ("sea", "air", "road", "rail", "multimodal")

# Order matters: a milestone may only move forward.
SHIPMENT_STATUSES = (
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
)

# Statuses a customer may still edit. After dispatch the record is locked.
EDITABLE_STATUSES = ("registered", "documents_submitted", "ready_for_dispatch")

DOCUMENT_TYPES = ("commercial_invoice", "packing_list", "shipping_document", "other")


def _uuid() -> str:
    return str(uuid.uuid4())


class Shipment(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "shipments"

    id = Column(String(36), primary_key=True, default=_uuid)
    shipment_number = Column(String(30), nullable=False, unique=True, index=True)
    customer_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    shipping_company_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    status = Column(String(30), nullable=False, default="registered", index=True)
    transport_mode = Column(String(20), nullable=False)
    origin_country = Column(String(80), nullable=False)
    origin_location = Column(String(150), nullable=False)
    destination_country = Column(String(80), nullable=False)
    destination_location = Column(String(150), nullable=False)
    departure_date = Column(Date, nullable=True)
    expected_arrival_date = Column(Date, nullable=True)
    currency = Column(String(3), nullable=False, default="INR")
    declared_value = Column(Numeric(15, 2), nullable=False, default=0)
    packaging_details = Column(Text, nullable=True)
    special_handling = Column(Text, nullable=True)

    cargo_items = relationship(
        "CargoItem", back_populates="shipment", cascade="all, delete-orphan"
    )
    containers = relationship(
        "ShipmentContainer", back_populates="shipment", cascade="all, delete-orphan"
    )
    milestones = relationship(
        "ShipmentMilestone", back_populates="shipment", cascade="all, delete-orphan"
    )
    documents = relationship(
        "ShipmentDocument", back_populates="shipment", cascade="all, delete-orphan"
    )
    route = relationship(
        "ShipmentRoute", back_populates="shipment", uselist=False, cascade="all, delete-orphan"
    )


class CargoItem(Base, TimestampMixin):
    __tablename__ = "cargo_items"

    id = Column(String(36), primary_key=True, default=_uuid)
    shipment_id = Column(
        String(36), ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cargo_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(80), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit = Column(String(20), nullable=False, default="units")
    value = Column(Numeric(15, 2), nullable=False)

    shipment = relationship("Shipment", back_populates="cargo_items")


class ShipmentContainer(Base, TimestampMixin):
    __tablename__ = "shipment_containers"
    __table_args__ = (
        UniqueConstraint("shipment_id", "container_number", name="uq_shipment_container"),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    shipment_id = Column(
        String(36), ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    container_number = Column(String(30), nullable=False)
    container_type = Column(String(40), nullable=False)
    seal_number = Column(String(40), nullable=True)

    shipment = relationship("Shipment", back_populates="containers")


class ShipmentRoute(Base, TimestampMixin):
    __tablename__ = "shipment_routes"

    id = Column(String(36), primary_key=True, default=_uuid)
    shipment_id = Column(
        String(36),
        ForeignKey("shipments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    origin = Column(String(200), nullable=False)
    destination = Column(String(200), nullable=False)
    route_details = Column(Text, nullable=True)

    shipment = relationship("Shipment", back_populates="route")


class ShipmentDocument(Base):
    __tablename__ = "shipment_documents"

    id = Column(String(36), primary_key=True, default=_uuid)
    shipment_id = Column(
        String(36), ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_type = Column(String(40), nullable=False)
    original_filename = Column(String(255), nullable=False)
    storage_key = Column(String(255), nullable=False, unique=True)
    content_type = Column(String(100), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    uploaded_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    shipment = relationship("Shipment", back_populates="documents")


class ShipmentMilestone(Base):
    __tablename__ = "shipment_milestones"

    id = Column(String(36), primary_key=True, default=_uuid)
    shipment_id = Column(
        String(36), ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status = Column(String(30), nullable=False)
    location = Column(String(150), nullable=True)
    remarks = Column(Text, nullable=True)
    event_time = Column(DateTime(timezone=True), nullable=False)
    recorded_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    shipment = relationship("Shipment", back_populates="milestones")
