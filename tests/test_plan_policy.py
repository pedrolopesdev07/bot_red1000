import pytest

from app.services.plans import PlanName, get_plan_policy


def test_basic_policy_has_ten_analyses_and_full_details() -> None:
    policy = get_plan_policy("FREE")
    assert policy.name is PlanName.FREE
    assert policy.daily_analyses == 10
    assert policy.detailed_feedback is True
    assert policy.gemini_daily_limit == 2


def test_premium_policy_has_twenty_five_daily_analyses_and_full_details() -> None:
    policy = get_plan_policy("PREMIUM")
    assert policy.name is PlanName.PREMIUM
    assert policy.daily_analyses == 25
    assert policy.detailed_feedback is True


def test_ultra_is_unlimited_and_switches_engine_after_two() -> None:
    policy = get_plan_policy("ULTRA_PREMIUM")
    assert policy.name is PlanName.ULTRA_PREMIUM
    assert policy.unlimited is True
    assert policy.gemini_daily_limit == 2


def test_unknown_plan_is_rejected() -> None:
    with pytest.raises(ValueError, match="Unsupported plan"):
        get_plan_policy("VIP")
