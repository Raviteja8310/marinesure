"""insurance products, quotations, and applications

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-11-05 20:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "insurance_products",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("product_code", sa.String(20), nullable=False),
        sa.Column("product_name", sa.String(150), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("min_insured_value", sa.Numeric(15, 2), nullable=False),
        sa.Column("max_insured_value", sa.Numeric(15, 2), nullable=False),
        sa.Column("base_rate", sa.Numeric(6, 4), nullable=False),
        sa.Column("deductible_percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column("min_deductible", sa.Numeric(15, 2), nullable=False),
        sa.Column("applicable_modes", sa.String(100), nullable=False),
        sa.Column("coverage_duration_days", sa.Integer, nullable=False),
        sa.Column("terms_and_conditions", sa.Text, nullable=False),
        sa.Column("is_deleted", sa.Integer, nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_insurance_products_code", "insurance_products", ["product_code"], unique=True)
    op.create_index("ix_insurance_products_status", "insurance_products", ["status"])

    op.create_table(
        "product_coverages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("product_id", sa.String(36), sa.ForeignKey("insurance_products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("coverage_name", sa.String(150), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
    )
    op.create_index("ix_product_coverages_product", "product_coverages", ["product_id"])

    op.create_table(
        "product_exclusions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("product_id", sa.String(36), sa.ForeignKey("insurance_products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("exclusion_name", sa.String(150), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
    )
    op.create_index("ix_product_exclusions_product", "product_exclusions", ["product_id"])

    op.create_table(
        "premium_rules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("product_id", sa.String(36), sa.ForeignKey("insurance_products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cargo_category", sa.String(80), nullable=False),
        sa.Column("transport_mode", sa.String(20), nullable=False),
        sa.Column("rate_multiplier", sa.Numeric(6, 4), nullable=False),
        sa.Column("additional_fee", sa.Numeric(10, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_premium_rules_product", "premium_rules", ["product_id"])

    op.create_table(
        "quotations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("quotation_number", sa.String(30), nullable=False),
        sa.Column("customer_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("shipment_id", sa.String(36), sa.ForeignKey("shipments.id"), nullable=False),
        sa.Column("product_id", sa.String(36), sa.ForeignKey("insurance_products.id"), nullable=False),
        sa.Column("insured_value", sa.Numeric(15, 2), nullable=False),
        sa.Column("rate_applied", sa.Numeric(6, 4), nullable=False),
        sa.Column("base_premium", sa.Numeric(15, 2), nullable=False),
        sa.Column("additional_charges", sa.Numeric(10, 2), nullable=False),
        sa.Column("tax_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("total_premium", sa.Numeric(15, 2), nullable=False),
        sa.Column("deductible_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_quotations_number", "quotations", ["quotation_number"], unique=True)
    op.create_index("ix_quotations_customer", "quotations", ["customer_id"])
    op.create_index("ix_quotations_shipment", "quotations", ["shipment_id"])

    op.create_table(
        "insurance_applications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("application_number", sa.String(30), nullable=False),
        sa.Column("customer_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("shipment_id", sa.String(36), sa.ForeignKey("shipments.id"), nullable=False),
        sa.Column("product_id", sa.String(36), sa.ForeignKey("insurance_products.id"), nullable=False),
        sa.Column("quotation_id", sa.String(36), sa.ForeignKey("quotations.id"), nullable=True),
        sa.Column("requested_insured_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("calculated_premium", sa.Numeric(15, 2), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("special_conditions", sa.Text, nullable=True),
        sa.Column("officer_remarks", sa.Text, nullable=True),
        sa.Column("reviewed_by", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_applications_number", "insurance_applications", ["application_number"], unique=True)
    op.create_index("ix_applications_customer", "insurance_applications", ["customer_id"])
    op.create_index("ix_applications_shipment", "insurance_applications", ["shipment_id"])

    op.create_table(
        "underwriting_reviews",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("application_id", sa.String(36), sa.ForeignKey("insurance_applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("officer_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("risk_score", sa.String(20), nullable=False),
        sa.Column("risk_remarks", sa.Text, nullable=True),
        sa.Column("decision", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_underwriting_app", "underwriting_reviews", ["application_id"])


def downgrade() -> None:
    for table in (
        "underwriting_reviews",
        "insurance_applications",
        "quotations",
        "premium_rules",
        "product_exclusions",
        "product_coverages",
        "insurance_products",
    ):
        op.drop_table(table)
