"""Add credentials for username and password authentication."""

import sqlalchemy as sa
from alembic import op

revision = "0008_password_auth"
down_revision = "0007_product_integrity"


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(255)))
    op.create_index(
        "ix_users_login_username", "users", ["username"], unique=True,
        postgresql_where=sa.text("password_hash IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_users_login_username", table_name="users")
    op.drop_column("users", "password_hash")
