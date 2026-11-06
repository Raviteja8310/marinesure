"""backfill payout_references from every historical payout source

Revision ID: d9e0f1a2b3c4
Revises: c8d9e0f1a2b3
Create Date: 2026-11-06 15:00:00
"""

from alembic import op

from app.database.payout_backfill import BACKFILL_SQL

revision = "d9e0f1a2b3c4"
down_revision = "c8d9e0f1a2b3"
branch_labels = None
depends_on = None



def upgrade() -> None:
    op.execute(BACKFILL_SQL)


def downgrade() -> None:
    # Backfilled rows are indistinguishable from live ones; nothing to undo safely.
    pass
