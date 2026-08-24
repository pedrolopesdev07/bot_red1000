"""Replace billing credits with the explicit competition simulation model."""

from alembic import op

revision = "0010_simulation_access_model"
down_revision = "0009_welcome_credits"


def upgrade() -> None:
    op.execute("UPDATE plans SET daily_limit = 10, price = 0, active = true WHERE name = 'FREE'")
    op.execute("UPDATE plans SET daily_limit = 25, price = 29.99, active = true WHERE name = 'PREMIUM'")
    op.execute("UPDATE plans SET daily_limit = 2147483647, price = 39.99, active = true WHERE name = 'ULTRA_PREMIUM'")
    op.execute("DROP TABLE IF EXISTS credit_transactions")
    op.execute("DROP TABLE IF EXISTS billing_events")
    op.execute("DROP TABLE IF EXISTS payments")
    op.execute("DROP INDEX IF EXISTS ix_users_stripe_customer_id")
    op.execute("DROP INDEX IF EXISTS ix_users_stripe_subscription_id")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS bonus_credits")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS stripe_customer_id")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS stripe_subscription_id")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS subscription_status")
    op.execute("DROP TYPE IF EXISTS paymentstatus")
    op.execute("""
        CREATE TABLE competition_simulation_profiles (
            user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            simulated_position integer NOT NULL DEFAULT 17500 CHECK (simulated_position BETWEEN 1 AND 20000),
            simulated_points integer NOT NULL DEFAULT 0 CHECK (simulated_points >= 0),
            position_boost integer NOT NULL DEFAULT 0 CHECK (position_boost >= 0),
            top3_until timestamptz,
            cycle_started_at timestamptz NOT NULL DEFAULT now(),
            disclaimer_acknowledged boolean NOT NULL DEFAULT false,
            updated_at timestamptz NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE TABLE simulation_events (
            id bigserial PRIMARY KEY,
            user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            event_type varchar(40) NOT NULL,
            simulated_price_cents integer NOT NULL DEFAULT 0 CHECK (simulated_price_cents >= 0),
            points_delta integer NOT NULL DEFAULT 0,
            positions_delta integer NOT NULL DEFAULT 0,
            metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
            created_at timestamptz NOT NULL DEFAULT now()
        )
    """)
    op.create_index("ix_simulation_events_user_id", "simulation_events", ["user_id"])


def downgrade() -> None:
    op.drop_table("simulation_events")
    op.drop_table("competition_simulation_profiles")
    op.execute("ALTER TABLE users ADD COLUMN bonus_credits integer NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE users ADD COLUMN stripe_customer_id varchar(255)")
    op.execute("ALTER TABLE users ADD COLUMN stripe_subscription_id varchar(255)")
    op.execute("ALTER TABLE users ADD COLUMN subscription_status varchar(30) NOT NULL DEFAULT 'inactive'")
    op.execute("UPDATE plans SET daily_limit = 1, price = 0 WHERE name = 'FREE'")
    op.execute("UPDATE plans SET daily_limit = 5, price = 39.99 WHERE name = 'PREMIUM'")
    op.execute("UPDATE plans SET daily_limit = 2147483647, price = 99.99 WHERE name = 'ULTRA_PREMIUM'")
