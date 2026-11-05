"""shipment and logistics tables

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-11-05 19:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shipments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("shipment_number", sa.String(30), nullable=False),
        sa.Column("customer_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("shipping_company_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("transport_mode", sa.String(20), nullable=False),
        sa.Column("origin_country", sa.String(80), nullable=False),
        sa.Column("origin_location", sa.String(150), nullable=False),
        sa.Column("destination_country", sa.String(80), nullable=False),
        sa.Column("destination_location", sa.String(150), nullable=False),
        sa.Column("departure_date", sa.Date, nullable=True),
        sa.Column("expected_arrival_date", sa.Date, nullable=True),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("declared_value", sa.Numeric(15, 2), nullable=False),
        sa.Column("packaging_details", sa.Text, nullable=True),
        sa.Column("special_handling", sa.Text, nullable=True),
        sa.Column("is_deleted", sa.Integer, nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_shipments_number", "shipments", ["shipment_number"], unique=True)
    op.create_index("ix_shipments_customer", "shipments", ["customer_id"])
    op.create_index("ix_shipments_company", "shipments", ["shipping_company_id"])
    op.create_index("ix_shipments_status", "shipments", ["status"])

    op.create_table(
        "cargo_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("shipment_id", sa.String(36), sa.ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cargo_name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(80), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("value", sa.Numeric(15, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_cargo_items_shipment", "cargo_items", ["shipment_id"])

    op.create_table(
        "shipment_containers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("shipment_id", sa.String(36), sa.ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("container_number", sa.String(30), nullable=False),
        sa.Column("container_type", sa.String(40), nullable=False),
        sa.Column("seal_number", sa.String(40), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("shipment_id", "container_number", name="uq_shipment_container"),
    )

    op.create_table(
        "shipment_routes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("shipment_id", sa.String(36), sa.ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("origin", sa.String(200), nullable=False),
        sa.Column("destination", sa.String(200), nullable=False),
        sa.Column("route_details", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "shipment_documents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("shipment_id", sa.String(36), sa.ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_type", sa.String(40), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("storage_key", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.Integer, nullable=False),
        sa.Column("uploaded_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_shipment_documents_key", "shipment_documents", ["storage_key"], unique=True)

    op.create_table(
        "shipment_milestones",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("shipment_id", sa.String(36), sa.ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("location", sa.String(150), nullable=True),
        sa.Column("remarks", sa.Text, nullable=True),
        sa.Column("event_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorded_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_milestones_shipment", "shipment_milestones", ["shipment_id"])


def downgrade() -> None:
    for table in (
        "shipment_milestones",
        "shipment_documents",
        "shipment_routes",
        "shipment_containers",
        "cargo_items",
        "shipments",
    ):
        op.drop_table(table)
