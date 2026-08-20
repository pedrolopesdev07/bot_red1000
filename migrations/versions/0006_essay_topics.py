"""Create the essay topic catalog."""

import sqlalchemy as sa
from alembic import op

revision = "0006_essay_topics"
down_revision = "0005_three_tier_credit_system"


def upgrade() -> None:
    # The production Supabase catalog can be seeded before Alembic reaches this
    # revision. Preserve that populated table instead of attempting to recreate it.
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("essay_topics"):
        op.create_table(
            "essay_topics",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("title", sa.String(500), nullable=False, unique=True),
            sa.Column("category", sa.String(200), nullable=False),
            sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
    op.execute("CREATE INDEX IF NOT EXISTS ix_essay_topics_active ON essay_topics (active)")


def downgrade() -> None:
    op.drop_table("essay_topics")
