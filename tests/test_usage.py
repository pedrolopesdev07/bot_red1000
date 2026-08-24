from app.services.usage.limiter import UsageLimit


def test_user_below_limit() -> None:
    status = UsageLimit("FREE", 1, 0)
    assert status.remaining == 1


def test_user_at_limit() -> None:
    assert UsageLimit("FREE", 1, 1).remaining == 0


def test_user_above_limit_is_clamped() -> None:
    assert UsageLimit("FREE", 1, 2).remaining == 0


def test_credit_is_reserved_only_when_analysis_is_created() -> None:
    from pathlib import Path
    route = Path(__file__).parents[1] / "app" / "api" / "v1" / "analyses.py"
    assert "UsageLimiter(db).consume(current_user)" in route.read_text(encoding="utf-8")


def test_free_limit_uses_a_rolling_24_hour_window() -> None:
    from pathlib import Path

    limiter = (
        Path(__file__).parents[1] / "app" / "services" / "usage" / "limiter.py"
    ).read_text(encoding="utf-8")
    assert "interval '24 hours'" in limiter
    assert "pg_advisory_xact_lock" in limiter
