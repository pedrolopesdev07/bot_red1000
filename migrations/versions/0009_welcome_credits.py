"""Set the welcome-credit default for newly created users."""

import sqlalchemy as sa
from alembic import op

revision = "0009_welcome_credits"
down_revision = "0008_password_auth"


def upgrade() -> None:
    op.alter_column(
        "users", "bonus_credits", existing_type=sa.Integer(),
        server_default=sa.text("150"), existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "users", "bonus_credits", existing_type=sa.Integer(),
        server_default=sa.text("0"), existing_nullable=False,
    )
