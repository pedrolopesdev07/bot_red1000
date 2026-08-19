from app.services.usage.limiter import UsageLimit


def test_user_below_limit() -> None:
    status = UsageLimit("FREE", 1, 0)
    assert status.remaining == 1


def test_user_at_limit() -> None:
    assert UsageLimit("FREE", 1, 1).remaining == 0


def test_user_above_limit_is_clamped() -> None:
    assert UsageLimit("FREE", 1, 2).remaining == 0


def test_credit_is_only_reserved_on_confirmation_contract() -> None:
    # Receiving text never consumes credit; confirmation is the only call site.
    from pathlib import Path
    root = Path(__file__).parents[1] / "app" / "bot" / "handlers"
    assert "consume(user)" not in (root / "analysis.py").read_text(encoding="utf-8")
    assert "consume(user)" in (root / "confirmation.py").read_text(encoding="utf-8")


def test_free_limit_uses_a_rolling_24_hour_window() -> None:
    from pathlib import Path

    limiter = (
        Path(__file__).parents[1] / "app" / "services" / "usage" / "limiter.py"
    ).read_text(encoding="utf-8")
    assert "interval '24 hours'" in limiter
    assert "pg_advisory_xact_lock" in limiter


def test_limit_message_offers_premium_upgrade() -> None:
    from pathlib import Path

    confirmation = (
        Path(__file__).parents[1] / "app" / "bot" / "handlers" / "confirmation.py"
    ).read_text(encoding="utf-8")
    assert "upgrade_markup = premium_upgrade_keyboard(analysis_id)" in confirmation
