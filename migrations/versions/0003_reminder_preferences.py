"""Add opt-in reminder preferences."""

import sqlalchemy as sa
from alembic import op

revision = "0003_reminder_preferences"
down_revision = "0002_free_premium_plans"


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("reminders_enabled", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.add_column("users", sa.Column("last_reminder_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("users", "last_reminder_at")
    op.drop_column("users", "reminders_enabled")
