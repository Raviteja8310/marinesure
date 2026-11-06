"""permissions matrix, immutable ledger, settlements, reconciliation, grievances, inspections

Revision ID: b7c8d9e0f1a2
Revises: a1b2c3d4e5f7
Create Date: 2026-11-06 13:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "b7c8d9e0f1a2"
down_revision = "a1b2c3d4e5f7"
branch_labels = None
depends_on = None

SYSTEM_ROLES = ("customer", "shipping_company", "surveyor", "agent", "insurance_officer", "senior_officer", "admin")


def _ts():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade() -> None:
    # ── Roles: built-in flag ──────────────────────────────────
    with op.batch_alter_table("roles") as batch:
        batch.add_column(sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("0")))
    roles = sa.table("roles", sa.column("role_name", sa.String), sa.column("is_system", sa.Boolean))
    op.execute(roles.update().where(roles.c.role_name.in_(SYSTEM_ROLES)).values(is_system=True))

    # ── Permissions ───────────────────────────────────────────
    op.create_table(
        "permissions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("code", sa.String(80), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("category", sa.String(50), nullable=False),
        *_ts(),
    )
    op.create_index("ix_permissions_code", "permissions", ["code"], unique=True)
    op.create_index("ix_permissions_category", "permissions", ["category"])

    op.create_table(
        "role_permissions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("role_id", sa.String(36), sa.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("permission_id", sa.String(36), sa.ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )
    op.create_index("ix_role_permissions_role_id", "role_permissions", ["role_id"])
    op.create_index("ix_role_permissions_permission_id", "role_permissions", ["permission_id"])

    # ── Ledger ────────────────────────────────────────────────
    op.create_table(
        "ledger_entries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("entry_number", sa.String(32), nullable=False),
        sa.Column("entry_type", sa.String(30), nullable=False),
        sa.Column("debit_account", sa.String(40), nullable=False),
        sa.Column("credit_account", sa.String(40), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("reference_type", sa.String(40), nullable=True),
        sa.Column("reference_id", sa.String(64), nullable=True),
        sa.Column("external_reference", sa.String(120), nullable=True),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("reverses_entry_id", sa.String(36), sa.ForeignKey("ledger_entries.id"), nullable=True, unique=True),
        sa.Column("created_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("posted_at", sa.DateTime(), nullable=False),
        sa.Column("prev_hash", sa.String(64), nullable=False),
        sa.Column("entry_hash", sa.String(64), nullable=False, unique=True),
    )
    for col, unique in (("sequence", True), ("entry_number", True), ("entry_type", False), ("debit_account", False),
                        ("credit_account", False), ("reference_type", False), ("reference_id", False),
                        ("external_reference", False), ("posted_at", False)):
        op.create_index(f"ix_ledger_entries_{col}", "ledger_entries", [col], unique=unique)

    # Database-level immutability (the ORM also blocks updates/deletes).
    bind = op.get_bind()
    if bind.dialect.name == "mysql":
        op.execute(
            "CREATE TRIGGER ledger_entries_no_update BEFORE UPDATE ON ledger_entries FOR EACH ROW "
            "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ledger_entries is append-only'"
        )
        op.execute(
            "CREATE TRIGGER ledger_entries_no_delete BEFORE DELETE ON ledger_entries FOR EACH ROW "
            "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ledger_entries is append-only'"
        )
    elif bind.dialect.name == "sqlite":
        op.execute(
            "CREATE TRIGGER ledger_entries_no_update BEFORE UPDATE ON ledger_entries "
            "BEGIN SELECT RAISE(ABORT, 'ledger_entries is append-only'); END"
        )
        op.execute(
            "CREATE TRIGGER ledger_entries_no_delete BEFORE DELETE ON ledger_entries "
            "BEGIN SELECT RAISE(ABORT, 'ledger_entries is append-only'); END"
        )

    # ── Settlements ───────────────────────────────────────────
    op.create_table(
        "settlements",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("settlement_number", sa.String(32), nullable=False),
        sa.Column("claim_id", sa.String(36), sa.ForeignKey("claims.id", ondelete="RESTRICT"), nullable=False, unique=True),
        sa.Column("customer_id", sa.String(36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("approved_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("deductible_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("net_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("payout_method", sa.String(30), nullable=False),
        sa.Column("payout_reference", sa.String(100), nullable=True),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("reconciled", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("reconciled_at", sa.DateTime(), nullable=True),
        sa.Column("processed_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("history", sa.JSON(), nullable=False),
        *_ts(),
    )
    op.create_index("ix_settlements_settlement_number", "settlements", ["settlement_number"], unique=True)
    op.create_index("ix_settlements_customer_id", "settlements", ["customer_id"])
    op.create_index("ix_settlements_status", "settlements", ["status"])
    op.create_index("ix_settlements_payout_reference", "settlements", ["payout_reference"])
    op.create_index("ix_settlements_reconciled", "settlements", ["reconciled"])

    op.create_table(
        "reconciliation_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("run_number", sa.String(32), nullable=False),
        sa.Column("source", sa.String(30), nullable=False),
        sa.Column("period_start", sa.DateTime(), nullable=False),
        sa.Column("period_end", sa.DateTime(), nullable=False),
        sa.Column("statement_total", sa.Numeric(15, 2), nullable=False),
        sa.Column("ledger_total", sa.Numeric(15, 2), nullable=False),
        sa.Column("difference", sa.Numeric(15, 2), nullable=False),
        sa.Column("matched_count", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("results", sa.JSON(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_reconciliation_runs_run_number", "reconciliation_runs", ["run_number"], unique=True)

    # ── Grievances ────────────────────────────────────────────
    op.create_table(
        "grievances",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("grievance_number", sa.String(32), nullable=False),
        sa.Column("customer_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("priority", sa.String(10), nullable=False),
        sa.Column("subject", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("related_claim_id", sa.String(36), sa.ForeignKey("claims.id", ondelete="SET NULL"), nullable=True),
        sa.Column("related_policy_id", sa.String(36), sa.ForeignKey("policies.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("assigned_to_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("resolution", sa.Text(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        *_ts(),
    )
    op.create_index("ix_grievances_grievance_number", "grievances", ["grievance_number"], unique=True)
    op.create_index("ix_grievances_customer_id", "grievances", ["customer_id"])
    op.create_index("ix_grievances_status", "grievances", ["status"])
    op.create_index("ix_grievances_assigned_to_id", "grievances", ["assigned_to_id"])

    op.create_table(
        "grievance_comments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("grievance_id", sa.String(36), sa.ForeignKey("grievances.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("is_internal", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_grievance_comments_grievance_id", "grievance_comments", ["grievance_id"])

    op.create_table(
        "grievance_attachments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("grievance_id", sa.String(36), sa.ForeignKey("grievances.id", ondelete="CASCADE"), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("storage_key", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("uploaded_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_grievance_attachments_grievance_id", "grievance_attachments", ["grievance_id"])

    # ── Inspection appointments ───────────────────────────────
    op.create_table(
        "inspection_appointments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("appointment_number", sa.String(32), nullable=False),
        sa.Column("claim_id", sa.String(36), sa.ForeignKey("claims.id", ondelete="CASCADE"), nullable=False),
        sa.Column("surveyor_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scheduled_start", sa.DateTime(), nullable=False),
        sa.Column("scheduled_end", sa.DateTime(), nullable=False),
        sa.Column("location", sa.String(255), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("cancellation_reason", sa.Text(), nullable=True),
        sa.Column("reschedule_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        *_ts(),
    )
    op.create_index("ix_inspection_appointments_appointment_number", "inspection_appointments", ["appointment_number"], unique=True)
    op.create_index("ix_inspection_appointments_claim_id", "inspection_appointments", ["claim_id"])
    op.create_index("ix_inspection_appointments_surveyor_id", "inspection_appointments", ["surveyor_id"])
    op.create_index("ix_inspection_appointments_scheduled_start", "inspection_appointments", ["scheduled_start"])
    op.create_index("ix_inspection_appointments_status", "inspection_appointments", ["status"])


def downgrade() -> None:
    op.drop_table("inspection_appointments")
    op.drop_table("grievance_attachments")
    op.drop_table("grievance_comments")
    op.drop_table("grievances")
    op.drop_table("reconciliation_runs")
    op.drop_table("settlements")
    bind = op.get_bind()
    if bind.dialect.name in ("mysql", "sqlite"):
        op.execute("DROP TRIGGER IF EXISTS ledger_entries_no_update")
        op.execute("DROP TRIGGER IF EXISTS ledger_entries_no_delete")
    op.drop_table("ledger_entries")
    op.drop_table("role_permissions")
    op.drop_table("permissions")
    with op.batch_alter_table("roles") as batch:
        batch.drop_column("is_system")
