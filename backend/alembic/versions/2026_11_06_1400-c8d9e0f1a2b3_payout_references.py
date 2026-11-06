"""payout reference registry (unique across all payouts)

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
Create Date: 2026-11-06 14:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "c8d9e0f1a2b3"
down_revision = "b7c8d9e0f1a2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Development databases may already have this table from create_all.
    if "payout_references" not in sa.inspect(op.get_bind()).get_table_names():
        _create()
    # Register references already used by existing payouts.
    op.execute(
        "INSERT INTO payout_references (reference, source_type, source_id, created_at) "
        "SELECT UPPER(TRIM(s.payout_reference)), 'settlement', s.claim_id, s.created_at FROM settlements s "
        "WHERE s.payout_reference IS NOT NULL AND NOT EXISTS "
        "(SELECT 1 FROM payout_references p WHERE p.reference = UPPER(TRIM(s.payout_reference)))"
    )


def _create() -> None:
    op.create_table(
        "payout_references",
        sa.Column("reference", sa.String(100), primary_key=True),
        sa.Column("source_type", sa.String(30), nullable=False),
        sa.Column("source_id", sa.String(36), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_payout_references_source_id", "payout_references", ["source_id"])


def downgrade() -> None:
    op.drop_table("payout_references")
