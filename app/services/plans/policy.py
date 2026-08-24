from dataclasses import dataclass
from enum import StrEnum

class PlanName(StrEnum):
    FREE = "FREE"
    PREMIUM = "PREMIUM"
    ULTRA_PREMIUM = "ULTRA_PREMIUM"


@dataclass(frozen=True)
class PlanPolicy:
    name: PlanName
    daily_analyses: int
    detailed_feedback: bool
    unlimited: bool = False
    gemini_daily_limit: int | None = None


def get_plan_policy(name: str, premium_daily_limit: int | None = None) -> PlanPolicy:
    try:
        plan = PlanName(name)
    except ValueError as exc:
        raise ValueError(f"Unsupported plan: {name}") from exc

    if plan is PlanName.FREE:
        return PlanPolicy(plan, daily_analyses=10, detailed_feedback=True, gemini_daily_limit=2)

    if plan is PlanName.PREMIUM:
        return PlanPolicy(plan, daily_analyses=25, detailed_feedback=True, gemini_daily_limit=2)
    return PlanPolicy(
        plan,
        daily_analyses=2_147_483_647,
        detailed_feedback=True,
        unlimited=True,
        gemini_daily_limit=2,
    )
