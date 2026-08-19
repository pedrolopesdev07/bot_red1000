"""Initial schema and plans."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None

status = sa.Enum(
    "WAITING_TRANSCRIPTION", "WAITING_CONFIRMATION", "EDITING_TEXT", "PROCESSING_ANALYSIS",
    "COMPLETED", "FAILED", "CANCELLED", name="analysisstatus"
)


def upgrade() -> None:
    op.create_table("plans", sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(20), nullable=False), sa.Column("daily_limit", sa.Integer(), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False), sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("name"))
    op.create_index("ix_plans_name", "plans", ["name"])
    op.bulk_insert(sa.table("plans", sa.column("name", sa.String(20)),
                            sa.column("daily_limit", sa.Integer()),
                            sa.column("price", sa.Numeric(10, 2)),
                            sa.column("active", sa.Boolean())), [
        {"name": "BASIC", "daily_limit": 3, "price": 0, "active": True},
        {"name": "PRO", "daily_limit": 5, "price": 0, "active": True},
        {"name": "VIP", "daily_limit": 10, "price": 0, "active": True}])
    op.create_table("users", sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False), sa.Column("username", sa.String(255)),
        sa.Column("first_name", sa.String(255)), sa.Column("plan_id", sa.Integer(), sa.ForeignKey("plans.id"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("telegram_id"))
    op.create_index("ix_users_telegram_id", "users", ["telegram_id"])
    op.create_index("ix_users_plan_id", "users", ["plan_id"])
    op.create_table("analyses", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", status, nullable=False), sa.Column("original_text", sa.Text()),
        sa.Column("confirmed_text", sa.Text()),
        *[sa.Column(f"competency_{i}_score", sa.Integer()) for i in range(1, 6)],
        sa.Column("total_score", sa.Integer()), sa.Column("confidence", sa.String(20)),
        sa.Column("summary", sa.Text()), sa.Column("strengths", sa.JSON()), sa.Column("weaknesses", sa.JSON()),
        sa.Column("improvements", sa.JSON()), sa.Column("warnings", sa.JSON()), sa.Column("raw_ai_response", sa.JSON()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)))
    op.create_index("ix_analyses_user_id", "analyses", ["user_id"])
    op.create_index("ix_analyses_status", "analyses", ["status"])
    op.create_table("usage_daily", sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False), sa.Column("date", sa.Date(), nullable=False),
        sa.Column("analyses_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "date", name="uq_usage_user_date"))
    op.create_index("ix_usage_daily_user_id", "usage_daily", ["user_id"])


def downgrade() -> None:
    op.drop_table("usage_daily")
    op.drop_table("analyses")
    op.drop_table("users")
    op.drop_table("plans")
    status.drop(op.get_bind(), checkfirst=True)
