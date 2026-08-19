from app.services.test_access import TestAccessRegistry
from app.services.usage.limiter import UsageLimit


def test_correct_code_unlocks_only_allowed_admin() -> None:
    registry = TestAccessRegistry()

    assert registry.authorize(123, "secret", "secret", allowed_telegram_id=123)
    assert not registry.is_unlimited(123)
    assert registry.select_plan(123, "PREMIUM")
    assert registry.is_unlimited(123)
    assert registry.selected_plan(123).value == "PREMIUM"


def test_wrong_code_or_wrong_admin_does_not_unlock() -> None:
    registry = TestAccessRegistry()

    assert not registry.authorize(123, "wrong", "secret", allowed_telegram_id=123)
    assert not registry.authorize(999, "secret", "secret", allowed_telegram_id=123)
    assert not registry.is_unlimited(123)
    assert not registry.is_unlimited(999)


def test_empty_expected_code_never_unlocks() -> None:
    registry = TestAccessRegistry()
    assert not registry.authorize(123, "", "")


def test_authorized_admin_can_select_free_preview() -> None:
    registry = TestAccessRegistry()
    assert registry.authorize(123, "secret", "secret")
    assert registry.select_plan(123, "FREE")
    assert registry.selected_plan(123).value == "FREE"
    assert registry.is_unlimited(123)


def test_admin_can_revoke_unlimited_access() -> None:
    registry = TestAccessRegistry()
    assert registry.authorize(123, "secret", "secret")
    assert registry.select_plan(123, "PREMIUM")

    assert registry.revoke(123)
    assert not registry.is_unlimited(123)
    assert registry.selected_plan(123) is None
    assert not registry.select_plan(123, "FREE")
    assert not registry.revoke(123)


def test_admin_can_toggle_unlimited_without_losing_access() -> None:
    registry = TestAccessRegistry()
    assert registry.authorize(123, "secret", "secret")
    assert registry.select_plan(123, "FREE")

    assert registry.disable_unlimited(123)
    assert registry.is_authorized(123)
    assert not registry.is_unlimited(123)
    assert registry.enable_unlimited(123)
    assert registry.is_unlimited(123)


def test_non_admin_cannot_toggle_unlimited() -> None:
    registry = TestAccessRegistry()
    assert not registry.enable_unlimited(123)
    assert not registry.disable_unlimited(123)


def test_unlimited_usage_has_infinite_display_labels() -> None:
    usage = UsageLimit("FREE", daily_limit=1, used=1, unlimited=True)
    assert usage.remaining_label == "∞"
    assert usage.daily_limit_label == "∞"
