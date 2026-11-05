"""user authentication tables

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-11-05 18:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("email_verified", sa.Boolean, nullable=False),
        sa.Column("failed_login_attempts", sa.Integer, nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_status", "users", ["status"])

    op.create_table(
        "roles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("role_name", sa.String(50), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
    )
    op.create_index("ix_roles_role_name", "roles", ["role_name"], unique=True)

    op.create_table(
        "user_roles",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role_id", sa.String(36), sa.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("user_id", "role_id", name="uq_user_role"),
    )

    for table, columns in {
        "customer_profiles": [
            sa.Column("customer_type", sa.String(30), nullable=False),
            sa.Column("company_name", sa.String(200), nullable=True),
            sa.Column("phone", sa.String(30), nullable=True),
            sa.Column("address", sa.Text, nullable=True),
            sa.Column("country", sa.String(80), nullable=True),
        ],
        "shipping_company_profiles": [
            sa.Column("company_name", sa.String(200), nullable=False),
            sa.Column("registration_number", sa.String(80), nullable=True),
            sa.Column("phone", sa.String(30), nullable=True),
            sa.Column("address", sa.Text, nullable=True),
        ],
        "surveyor_profiles": [
            sa.Column("qualification", sa.String(200), nullable=True),
            sa.Column("license_number", sa.String(80), nullable=True),
            sa.Column("verification_status", sa.String(20), nullable=False),
            sa.Column("phone", sa.String(30), nullable=True),
        ],
        "agent_profiles": [
            sa.Column("agency_name", sa.String(200), nullable=False),
            sa.Column("license_number", sa.String(80), nullable=True),
            sa.Column("phone", sa.String(30), nullable=True),
        ],
    }.items():
        op.create_table(
            table,
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column(
                "user_id",
                sa.String(36),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
                unique=True,
            ),
            *columns,
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )

    op.create_table(
        "officer_profiles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("employee_code", sa.String(40), nullable=False),
        sa.Column("department", sa.String(80), nullable=True),
        sa.Column("designation", sa.String(80), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_officer_profiles_employee_code", "officer_profiles", ["employee_code"], unique=True)

    for table in ("email_verifications", "password_reset_tokens"):
        op.create_table(
            table,
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("token_hash", sa.String(128), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index(f"ix_{table}_token_hash", table, ["token_hash"], unique=True)

    op.create_table(
        "user_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("refresh_token_hash", sa.String(128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    op.create_index("ix_user_sessions_refresh", "user_sessions", ["refresh_token_hash"], unique=True)

    op.create_table(
        "login_history",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("detail", sa.String(255), nullable=True),
        sa.Column("login_time", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_login_history_user_id", "login_history", ["user_id"])


def downgrade() -> None:
    for table in (
        "login_history",
        "user_sessions",
        "password_reset_tokens",
        "email_verifications",
        "officer_profiles",
        "agent_profiles",
        "surveyor_profiles",
        "shipping_company_profiles",
        "customer_profiles",
        "user_roles",
        "roles",
        "users",
    ):
        op.drop_table(table)
