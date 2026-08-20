"""Add credentials for username and password authentication."""

import sqlalchemy as sa
from alembic import op

revision = "0008_password_auth"
down_revision = "0007_product_integrity"


def upgrade() -> None:
    # Some existing Supabase databases received this column before Alembic was
    # brought up to date. Keep the existing data and add only missing objects.
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "password_hash" not in columns:
        op.add_column("users", sa.Column("password_hash", sa.String(255)))
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_login_username "
        "ON users (username) WHERE password_hash IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_index("ix_users_login_username", table_name="users")
    op.drop_column("users", "password_hash")
