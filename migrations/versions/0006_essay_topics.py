"""Create the essay topic catalog."""

import sqlalchemy as sa
from alembic import op

revision = "0006_essay_topics"
down_revision = "0005_three_tier_credit_system"


def upgrade() -> None:
    op.create_table(
        "essay_topics",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False, unique=True),
        sa.Column("category", sa.String(200), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_essay_topics_active", "essay_topics", ["active"])


def downgrade() -> None:
    op.drop_table("essay_topics")
