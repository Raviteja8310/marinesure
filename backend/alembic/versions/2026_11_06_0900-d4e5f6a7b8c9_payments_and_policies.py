"""payments and policies tables

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-11-06 09:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payment_orders",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("order_reference", sa.String(50), nullable=False),
        sa.Column("customer_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("application_id", sa.String(36), sa.ForeignKey("insurance_applications.id"), nullable=False),
        sa.Column("gateway_order_id", sa.String(100), nullable=True),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_payment_orders_ref", "payment_orders", ["order_reference"], unique=True)
    op.create_index("ix_payment_orders_customer", "payment_orders", ["customer_id"])
    op.create_index("ix_payment_orders_app", "payment_orders", ["application_id"])

    op.create_table(
        "payment_transactions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("payment_order_id", sa.String(36), sa.ForeignKey("payment_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("gateway_payment_id", sa.String(100), nullable=False),
        sa.Column("gateway_signature", sa.String(255), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_payment_transactions_gateway_pay", "payment_transactions", ["gateway_payment_id"], unique=True)
    op.create_index("ix_payment_transactions_order", "payment_transactions", ["payment_order_id"])

    op.create_table(
        "policies",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("policy_number", sa.String(30), nullable=False),
        sa.Column("application_id", sa.String(36), sa.ForeignKey("insurance_applications.id"), nullable=False, unique=True),
        sa.Column("customer_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("shipment_id", sa.String(36), sa.ForeignKey("shipments.id"), nullable=False),
        sa.Column("product_id", sa.String(36), sa.ForeignKey("insurance_products.id"), nullable=False),
        sa.Column("insured_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("premium_paid", sa.Numeric(15, 2), nullable=False),
        sa.Column("deductible_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("effective_date", sa.Date, nullable=False),
        sa.Column("expiry_date", sa.Date, nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("pdf_storage_key", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_policies_number", "policies", ["policy_number"], unique=True)
    op.create_index("ix_policies_customer", "policies", ["customer_id"])
    op.create_index("ix_policies_status", "policies", ["status"])

    op.create_table(
        "policy_endorsements",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("policy_id", sa.String(36), sa.ForeignKey("policies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requested_changes", sa.Text, nullable=False),
        sa.Column("reason", sa.Text, nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("officer_remarks", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_policy_endorsements_policy", "policy_endorsements", ["policy_id"])

    op.create_table(
        "policy_renewals",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("policy_id", sa.String(36), sa.ForeignKey("policies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("renewal_date", sa.Date, nullable=False),
        sa.Column("new_expiry_date", sa.Date, nullable=False),
        sa.Column("premium_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_policy_renewals_policy", "policy_renewals", ["policy_id"])

    op.create_table(
        "policy_cancellations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("policy_id", sa.String(36), sa.ForeignKey("policies.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("reason", sa.Text, nullable=False),
        sa.Column("refund_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    for table in (
        "policy_cancellations",
        "policy_renewals",
        "policy_endorsements",
        "policies",
        "payment_transactions",
        "payment_orders",
    ):
        op.drop_table(table)
