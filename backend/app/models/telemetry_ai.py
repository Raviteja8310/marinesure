"""
Database models for Container IoT Telemetry, Sensor Feeds, and Document Extraction.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    JSON,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database.base import TimestampMixin
from app.database.connection import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class ContainerTelemetry(Base, TimestampMixin):
    """Real-time IoT sensor telemetry stream emitted by smart shipping containers and reefers."""

    __tablename__ = "container_telemetry"

    id = Column(String(36), primary_key=True, default=_uuid)
    shipment_id = Column(
        String(36), ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    container_id = Column(
        String(36), ForeignKey("shipment_containers.id", ondelete="SET NULL"), nullable=True, index=True
    )

    recorded_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)

    temperature_celsius = Column(Numeric(5, 2), nullable=False)  # e.g., -18.50 C
    humidity_pct = Column(Numeric(5, 2), nullable=False)         # e.g., 65.00 %
    shock_g_force = Column(Numeric(5, 2), nullable=False, default=0.0)  # e.g., 2.80 G impact
    door_status = Column(String(20), nullable=False, default="sealed")   # sealed, opened, tampered

    latitude = Column(Numeric(9, 6), nullable=True)
    longitude = Column(Numeric(9, 6), nullable=True)
    location_name = Column(String(150), nullable=True)

    is_anomaly = Column(Boolean, nullable=False, default=False, index=True)
    anomaly_details = Column(String(255), nullable=True)

    # Relationships
    shipment = relationship("Shipment", backref="telemetry_logs")
    container = relationship("ShipmentContainer", backref="telemetry_records")


class DocumentExtractionRecord(Base):
    """Archived record of Bill of Lading, shipping manifests, and cargo manifests parsed via Document AI."""

    __tablename__ = "document_extractions"

    id = Column(String(36), primary_key=True, default=_uuid)
    uploaded_by_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    document_name = Column(String(255), nullable=False)
    document_type = Column(String(50), nullable=False, default="bill_of_lading")  # bill_of_lading, commercial_invoice, packing_list
    extracted_data = Column(JSON, nullable=False)
    status = Column(String(30), nullable=False, default="processed")  # processed, failed
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    uploaded_by = relationship("User", backref="document_extractions")
