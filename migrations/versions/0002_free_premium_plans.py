"""Replace BASIC/PRO/VIP plans with FREE/PREMIUM."""

from alembic import op

revision = "0002_free_premium_plans"
down_revision = "0001_initial"


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO plans (name, daily_limit, price, active)
        VALUES ('FREE', 1, 0, true), ('PREMIUM', 10, 0, true)
        ON CONFLICT (name) DO NOTHING
        """
    )
    op.execute("UPDATE plans SET daily_limit = 1, active = true WHERE name = 'FREE'")
    op.execute("UPDATE plans SET daily_limit = 10, active = true WHERE name = 'PREMIUM'")
    op.execute(
        """
        UPDATE users
        SET plan_id = CASE
            WHEN plan_id = (SELECT id FROM plans WHERE name = 'BASIC')
                THEN (SELECT id FROM plans WHERE name = 'FREE')
            ELSE (SELECT id FROM plans WHERE name = 'PREMIUM')
        END
        WHERE plan_id IN (SELECT id FROM plans WHERE name IN ('BASIC', 'PRO', 'VIP'))
        """
    )
    op.execute("DELETE FROM plans WHERE name IN ('BASIC', 'PRO', 'VIP')")


def downgrade() -> None:
    op.execute(
        """
        INSERT INTO plans (name, daily_limit, price, active)
        VALUES ('BASIC', 3, 0, true), ('PRO', 5, 0, true), ('VIP', 10, 0, true)
        ON CONFLICT (name) DO NOTHING
        """
    )
    op.execute(
        """
        UPDATE users
        SET plan_id = CASE
            WHEN plan_id = (SELECT id FROM plans WHERE name = 'FREE')
                THEN (SELECT id FROM plans WHERE name = 'BASIC')
            ELSE (SELECT id FROM plans WHERE name = 'PRO')
        END
        WHERE plan_id IN (SELECT id FROM plans WHERE name IN ('FREE', 'PREMIUM'))
        """
    )
    op.execute("DELETE FROM plans WHERE name IN ('FREE', 'PREMIUM')")
