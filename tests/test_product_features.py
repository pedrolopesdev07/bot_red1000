from datetime import date, datetime, timedelta, timezone
from app.services.retention import WEEKLY_THEMES, weekly_theme
from app.services.usage import UsageLimit


def test_free_credit_countdown() -> None:
    now = datetime(2026, 8, 18, 12, tzinfo=timezone.utc)
    usage = UsageLimit("FREE", 1, 1, next_credit_at=now + timedelta(hours=7, minutes=31))
    assert usage.next_credit_label(now) == "em 7h 31min"


def test_available_credit_has_no_countdown() -> None:
    usage = UsageLimit("FREE", 1, 0, next_credit_at=datetime.now(timezone.utc))
    assert usage.next_credit_label() is None


def test_weekly_theme_is_deterministic() -> None:
    selected = weekly_theme(date(2026, 1, 5))
    assert selected == WEEKLY_THEMES[1]
