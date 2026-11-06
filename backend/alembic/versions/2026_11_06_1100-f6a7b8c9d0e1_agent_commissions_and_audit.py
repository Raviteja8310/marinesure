"""agent commissions, notifications, and audit logs tables

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-11-06 11:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Agent Commissions
    op.create_table(
        "agent_commissions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("commission_reference", sa.String(32), nullable=False),
        sa.Column("agent_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("policy_id", sa.String(36), sa.ForeignKey("policies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("premium_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("commission_rate", sa.Numeric(5, 2), nullable=False, server_default="10.00"),
        sa.Column("commission_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="accrued"),
        sa.Column("payout_reference", sa.String(100), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_agent_commissions_reference", "agent_commissions", ["commission_reference"], unique=True)
    op.create_index("ix_agent_commissions_agent_id", "agent_commissions", ["agent_id"])
    op.create_index("ix_agent_commissions_policy_id", "agent_commissions", ["policy_id"])
    op.create_index("ix_agent_commissions_status", "agent_commissions", ["status"])

    # 2. Notifications
    op.create_table(
        "notifications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("notification_type", sa.String(30), nullable=False, server_default="info"),
        sa.Column("link", sa.String(255), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"])

    # 3. Audit Logs
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=False),
        sa.Column("resource_id", sa.String(100), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_resource_type", "audit_logs", ["resource_type"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("notifications")
    op.drop_table("agent_commissions")
