"""incidents, claims, and survey reports tables

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-11-06 10:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Incidents
    op.create_table(
        "incidents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("incident_number", sa.String(32), nullable=False),
        sa.Column("shipment_id", sa.String(36), sa.ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("policy_id", sa.String(36), sa.ForeignKey("policies.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reported_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("incident_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("incident_type", sa.String(60), nullable=False),
        sa.Column("severity", sa.String(30), nullable=False, server_default="moderate"),
        sa.Column("location_name", sa.String(255), nullable=True),
        sa.Column("location_coordinates", sa.String(100), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("estimated_loss", sa.Numeric(14, 2), nullable=True, server_default="0"),
        sa.Column("status", sa.String(40), nullable=False, server_default="reported"),
        sa.Column("photos_documents", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_incidents_incident_number", "incidents", ["incident_number"], unique=True)
    op.create_index("ix_incidents_shipment_id", "incidents", ["shipment_id"])
    op.create_index("ix_incidents_policy_id", "incidents", ["policy_id"])
    op.create_index("ix_incidents_reported_by_id", "incidents", ["reported_by_id"])

    # 2. Claims
    op.create_table(
        "claims",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("claim_number", sa.String(32), nullable=False),
        sa.Column("policy_id", sa.String(36), sa.ForeignKey("policies.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("incident_id", sa.String(36), sa.ForeignKey("incidents.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("claimant_id", sa.String(36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("assigned_surveyor_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewed_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("claim_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("approved_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("deductible_applied", sa.Numeric(14, 2), nullable=True, server_default="0"),
        sa.Column("net_payable", sa.Numeric(14, 2), nullable=True, server_default="0"),
        sa.Column("status", sa.String(40), nullable=False, server_default="submitted"),
        sa.Column("claim_type", sa.String(50), nullable=False, server_default="partial_loss"),
        sa.Column("claimant_notes", sa.Text(), nullable=True),
        sa.Column("officer_notes", sa.Text(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("settlement_reference", sa.String(100), nullable=True),
        sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("supporting_documents", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_claims_claim_number", "claims", ["claim_number"], unique=True)
    op.create_index("ix_claims_policy_id", "claims", ["policy_id"])
    op.create_index("ix_claims_incident_id", "claims", ["incident_id"])
    op.create_index("ix_claims_claimant_id", "claims", ["claimant_id"])
    op.create_index("ix_claims_assigned_surveyor_id", "claims", ["assigned_surveyor_id"])

    # 3. Survey Reports
    op.create_table(
        "survey_reports",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("report_number", sa.String(32), nullable=False),
        sa.Column("claim_id", sa.String(36), sa.ForeignKey("claims.id", ondelete="CASCADE"), nullable=False),
        sa.Column("surveyor_id", sa.String(36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("inspection_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("inspection_location", sa.String(255), nullable=False),
        sa.Column("damage_assessment", sa.Text(), nullable=False),
        sa.Column("cause_of_loss", sa.String(100), nullable=False),
        sa.Column("is_covered_peril", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("estimated_loss_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("salvage_value", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("recommended_settlement", sa.Numeric(14, 2), nullable=False),
        sa.Column("evidence_photos", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="submitted"),
        sa.Column("officer_comments", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_survey_reports_report_number", "survey_reports", ["report_number"], unique=True)
    op.create_index("ix_survey_reports_claim_id", "survey_reports", ["claim_id"])
    op.create_index("ix_survey_reports_surveyor_id", "survey_reports", ["surveyor_id"])


def downgrade() -> None:
    op.drop_table("survey_reports")
    op.drop_table("claims")
    op.drop_table("incidents")
