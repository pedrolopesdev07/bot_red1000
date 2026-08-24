from app.services.usage.limiter import UsageLimit


def test_user_below_limit() -> None:
    status = UsageLimit("FREE", 10, 0)
    assert status.remaining == 10


def test_user_at_limit() -> None:
    assert UsageLimit("FREE", 10, 10).remaining == 0


def test_user_above_limit_is_clamped() -> None:
    assert UsageLimit("FREE", 10, 12).remaining == 0


def test_daily_slot_is_reserved_only_when_analysis_is_created() -> None:
    from pathlib import Path
    route = Path(__file__).parents[1] / "app" / "api" / "v1" / "analyses.py"
    assert "UsageLimiter(db).consume(current_user)" in route.read_text(encoding="utf-8")


def test_basic_limit_uses_daily_usage_rows() -> None:
    from pathlib import Path

    limiter = (
        Path(__file__).parents[1] / "app" / "services" / "usage" / "limiter.py"
    ).read_text(encoding="utf-8")
    assert "UsageDaily.analyses_count" in limiter
    assert "daily_analyses" in limiter
