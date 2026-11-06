"""container telemetry and document extractions tables

Revision ID: a1b2c3d4e5f7
Revises: f6a7b8c9d0e1
Create Date: 2026-11-06 12:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f7"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Container Telemetry
    op.create_table(
        "container_telemetry",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("shipment_id", sa.String(36), sa.ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("container_id", sa.String(36), sa.ForeignKey("shipment_containers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("temperature_celsius", sa.Numeric(5, 2), nullable=False),
        sa.Column("humidity_pct", sa.Numeric(5, 2), nullable=False),
        sa.Column("shock_g_force", sa.Numeric(5, 2), nullable=False, server_default="0.0"),
        sa.Column("door_status", sa.String(20), nullable=False, server_default="sealed"),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("location_name", sa.String(150), nullable=True),
        sa.Column("is_anomaly", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("anomaly_details", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_container_telemetry_shipment_id", "container_telemetry", ["shipment_id"])
    op.create_index("ix_container_telemetry_container_id", "container_telemetry", ["container_id"])
    op.create_index("ix_container_telemetry_recorded_at", "container_telemetry", ["recorded_at"])
    op.create_index("ix_container_telemetry_is_anomaly", "container_telemetry", ["is_anomaly"])

    # 2. Document Extractions
    op.create_table(
        "document_extractions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("uploaded_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_name", sa.String(255), nullable=False),
        sa.Column("document_type", sa.String(50), nullable=False, server_default="bill_of_lading"),
        sa.Column("extracted_data", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="processed"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_document_extractions_uploaded_by_id", "document_extractions", ["uploaded_by_id"])


def downgrade() -> None:
    op.drop_table("document_extractions")
    op.drop_table("container_telemetry")
