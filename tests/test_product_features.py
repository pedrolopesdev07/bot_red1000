from datetime import date
from app.services.retention import WEEKLY_THEMES, weekly_theme


def test_weekly_theme_is_deterministic() -> None:
    selected = weekly_theme(date(2026, 1, 5))
    assert selected == WEEKLY_THEMES[1]
