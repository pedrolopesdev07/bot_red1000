"""Add analysis topics, credit ledger and subscription state."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0007_product_integrity"
down_revision = "0006_essay_topics"


def upgrade() -> None:
    op.add_column("analyses", sa.Column("topic_id", sa.Integer(), sa.ForeignKey("essay_topics.id")))
    op.add_column("analyses", sa.Column("custom_topic", sa.String(500)))
    op.create_index("ix_analyses_topic_id", "analyses", ["topic_id"])
    op.add_column("users", sa.Column("stripe_customer_id", sa.String(255)))
    op.add_column("users", sa.Column("stripe_subscription_id", sa.String(255)))
    op.add_column("users", sa.Column("subscription_status", sa.String(30), nullable=False, server_default="inactive"))
    op.create_index("ix_users_stripe_customer_id", "users", ["stripe_customer_id"], unique=True)
    op.create_index("ix_users_stripe_subscription_id", "users", ["stripe_subscription_id"], unique=True)
    op.create_table(
        "credit_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("balance_after", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(40), nullable=False),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("analysis_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("analyses.id", ondelete="SET NULL")),
        sa.Column("payment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("payments.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_credit_transactions_user_created", "credit_transactions", ["user_id", sa.text("created_at DESC")])
    op.execute("""
        INSERT INTO credit_transactions (id, user_id, amount, balance_after, reason, description)
        SELECT gen_random_uuid(), id, bonus_credits, bonus_credits, 'OPENING_BALANCE', 'Saldo existente na criação do extrato'
        FROM users WHERE bonus_credits <> 0
    """)


def downgrade() -> None:
    op.drop_table("credit_transactions")
    op.drop_index("ix_users_stripe_subscription_id", table_name="users")
    op.drop_index("ix_users_stripe_customer_id", table_name="users")
    op.drop_column("users", "subscription_status")
    op.drop_column("users", "stripe_subscription_id")
    op.drop_column("users", "stripe_customer_id")
    op.drop_index("ix_analyses_topic_id", table_name="analyses")
    op.drop_column("analyses", "custom_topic")
    op.drop_column("analyses", "topic_id")
