"""Add three-tier plans, credit points and analysis delivery metadata."""

import sqlalchemy as sa
from alembic import op

revision = "0005_three_tier_credit_system"
down_revision = "0004_web_platform"


def upgrade() -> None:
    op.execute("UPDATE users SET bonus_credits = bonus_credits * 150")
    op.execute("UPDATE plans SET daily_limit = 1, price = 0, active = true WHERE name = 'FREE'")
    op.execute("UPDATE plans SET daily_limit = 5, price = 39.99, active = true WHERE name = 'PREMIUM'")
    op.execute("""
        INSERT INTO plans (name, daily_limit, price, active)
        VALUES ('ULTRA_PREMIUM', 2147483647, 99.99, true)
        ON CONFLICT (name) DO UPDATE SET daily_limit = 2147483647, price = 99.99, active = true
    """)
    op.add_column("analyses", sa.Column("detailed_feedback", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("analyses", sa.Column("evaluation_engine", sa.String(20), nullable=False, server_default="GEMINI"))
    op.execute("UPDATE analyses SET detailed_feedback = true WHERE status = 'COMPLETED'")


def downgrade() -> None:
    op.drop_column("analyses", "evaluation_engine")
    op.drop_column("analyses", "detailed_feedback")
    op.execute("DELETE FROM plans WHERE name = 'ULTRA_PREMIUM'")
    op.execute("UPDATE plans SET daily_limit = 10, price = 0 WHERE name = 'PREMIUM'")
    op.execute("UPDATE users SET bonus_credits = bonus_credits / 150")
