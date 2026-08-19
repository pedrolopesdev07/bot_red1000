"""Add web identity, queue idempotency and billing tables."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004_web_platform"
down_revision = "0003_reminder_preferences"


def upgrade() -> None:
    op.execute("ALTER TYPE analysisstatus ADD VALUE IF NOT EXISTS 'QUEUED' BEFORE 'WAITING_TRANSCRIPTION'")
    op.alter_column("users", "telegram_id", existing_type=sa.BigInteger(), nullable=True)
    role = postgresql.ENUM("USER", "SUPPORT", "ADMIN", name="userrole")
    role.create(op.get_bind(), checkfirst=True)
    op.add_column("users", sa.Column("email", sa.String(320)))
    op.add_column("users", sa.Column("role", role, server_default="USER", nullable=False))
    op.add_column("users", sa.Column("mfa_enabled", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("users", sa.Column("bonus_credits", sa.Integer(), server_default="0", nullable=False))
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.add_column("analyses", sa.Column("idempotency_key", sa.String(64)))
    op.create_unique_constraint("uq_analysis_user_idempotency", "analyses", ["user_id", "idempotency_key"])
    op.create_index(
        "ix_analyses_user_completed", "analyses", ["user_id", sa.text("completed_at DESC")],
        postgresql_where=sa.text("status = 'COMPLETED'")
    )
    op.create_index("ix_usage_daily_user_updated", "usage_daily", ["user_id", sa.text("updated_at DESC")])

    payment_status = postgresql.ENUM(
        "PENDING", "PAID", "FAILED", "REFUNDED", name="paymentstatus", create_type=False
    )
    payment_status.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("provider_session_id", sa.String(255), nullable=False, unique=True),
        sa.Column("provider_payment_intent", sa.String(255)),
        sa.Column("product", sa.String(30), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("status", payment_status, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_payments_user_id", "payments", ["user_id"])
    op.create_index("ix_payments_provider_payment_intent", "payments", ["provider_payment_intent"])
    op.create_table(
        "billing_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("event_id", sa.String(255), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("provider", "event_id", name="uq_billing_provider_event"),
    )


def downgrade() -> None:
    op.drop_table("billing_events")
    op.drop_index("ix_payments_provider_payment_intent", table_name="payments")
    op.drop_index("ix_payments_user_id", table_name="payments")
    op.drop_table("payments")
    op.drop_index("ix_usage_daily_user_updated", table_name="usage_daily")
    op.drop_index("ix_analyses_user_completed", table_name="analyses")
    op.drop_constraint("uq_analysis_user_idempotency", "analyses", type_="unique")
    op.drop_column("analyses", "idempotency_key")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_column("users", "bonus_credits")
    op.drop_column("users", "mfa_enabled")
    op.drop_column("users", "role")
    op.drop_column("users", "email")
    op.alter_column("users", "telegram_id", existing_type=sa.BigInteger(), nullable=False)
