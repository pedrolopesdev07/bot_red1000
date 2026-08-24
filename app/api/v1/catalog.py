from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import PlanResponse, RandomThemeResponse, SimulationAction, SimulationProfileResponse, ThemeResponse, UsageResponse
from app.core.web_security import get_current_user, require_csrf
from app.database.database import get_session
from app.database.models import CompetitionSimulationProfile, EssayTopic, Plan, SimulationEvent, User
from app.services.plans import get_plan_policy
from app.services.usage import UsageLimiter
from app.services.retention import weekly_theme

router = APIRouter(tags=["catalog"])
SIMULATION_NOTICE = "SIMULAÇÃO MANIPULADA PARA TESTES — sem pagamentos, competição ou prêmios reais."


async def _simulation_profile(db: AsyncSession, user: User) -> CompetitionSimulationProfile:
    profile = await db.get(CompetitionSimulationProfile, user.id)
    if profile is None:
        profile = CompetitionSimulationProfile(user_id=user.id, simulated_position=15_000 + (user.id * 137) % 5_001)
        db.add(profile)
        await db.flush()
    return profile


def _simulation_response(user: User, profile: CompetitionSimulationProfile) -> SimulationProfileResponse:
    return SimulationProfileResponse(
        notice=SIMULATION_NOTICE, plan=user.plan.name,
        simulated_position=profile.simulated_position, simulated_points=profile.simulated_points,
        position_boost=profile.position_boost, top3_until=profile.top3_until,
        cycle_started_at=profile.cycle_started_at,
        disclaimer_acknowledged=profile.disclaimer_acknowledged,
    )


@router.get("/theme", response_model=ThemeResponse)
async def theme() -> ThemeResponse:
    return ThemeResponse(theme=weekly_theme())


@router.get("/themes/random", response_model=RandomThemeResponse)
async def random_theme(db: AsyncSession = Depends(get_session)) -> RandomThemeResponse:
    item = await db.scalar(select(EssayTopic).where(EssayTopic.active.is_(True)).order_by(func.random()).limit(1))
    if not item:
        return RandomThemeResponse(id=None, theme=weekly_theme(), category="Tema da semana")
    return RandomThemeResponse(id=item.id, theme=item.title, category=item.category)


@router.get("/usage", response_model=UsageResponse)
async def usage(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)
) -> UsageResponse:
    current = await UsageLimiter(db).status(user)
    return UsageResponse(
        plan=current.plan, limit=current.daily_limit_label, used=current.used,
        remaining=current.remaining_label, next_reset_at=current.next_reset_at,
    )


@router.get("/plans", response_model=list[PlanResponse])
async def plans(db: AsyncSession = Depends(get_session)) -> list[PlanResponse]:
    rows = await db.scalars(select(Plan).where(Plan.active.is_(True)).order_by(Plan.price))
    return [
        PlanResponse(
            name=item.name, daily_limit=item.daily_limit, price_cents=int(item.price * 100),
            detailed_feedback=get_plan_policy(item.name).detailed_feedback,
            unlimited=get_plan_policy(item.name).unlimited,
            gemini_daily_limit=get_plan_policy(item.name).gemini_daily_limit,
            points_multiplier={"FREE": 1, "PREMIUM": 2, "ULTRA_PREMIUM": 10}[item.name],
            position_bonus={"FREE": 0, "PREMIUM": 10, "ULTRA_PREMIUM": 25}[item.name],
        ) for item in rows
    ]


@router.get("/simulation/profile", response_model=SimulationProfileResponse)
async def simulation_profile(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session),
) -> SimulationProfileResponse:
    profile = await _simulation_profile(db, user)
    if profile.top3_until and profile.top3_until <= datetime.now(timezone.utc):
        profile.top3_until = None
        profile.simulated_position = max(4, profile.simulated_position)
    await db.commit()
    return _simulation_response(user, profile)


@router.post("/simulation/action", response_model=SimulationProfileResponse, dependencies=[Depends(require_csrf)])
async def simulation_action(
    payload: SimulationAction, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session),
) -> SimulationProfileResponse:
    profile = await _simulation_profile(db, user)
    prices_and_positions = {
        "boost_100": (599, 100), "boost_250": (799, 250), "boost_500": (1599, 500),
        "boost_700": (2099, 700), "top3_24h": (2599, 0),
    }
    if payload.action == "acknowledge":
        profile.disclaimer_acknowledged = True
    elif payload.action in {"premium", "ultra_premium"}:
        plan_name = "PREMIUM" if payload.action == "premium" else "ULTRA_PREMIUM"
        plan = await db.scalar(select(Plan).where(Plan.name == plan_name, Plan.active.is_(True)))
        if not plan:
            raise HTTPException(status_code=404, detail="Vantagem de teste indisponível")
        user.plan_id, user.plan = plan.id, plan
        db.add(SimulationEvent(user_id=user.id, event_type=f"PLAN_{plan_name}", simulated_price_cents=2999 if plan_name == "PREMIUM" else 3999))
    else:
        price, positions = prices_and_positions[payload.action]
        if payload.action == "top3_24h":
            profile.simulated_position = 3
            profile.top3_until = datetime.now(timezone.utc) + timedelta(hours=24)
        else:
            profile.position_boost += positions
            profile.simulated_position = max(4, profile.simulated_position - positions)
        db.add(SimulationEvent(user_id=user.id, event_type=payload.action.upper(), simulated_price_cents=price, positions_delta=positions))
    await db.commit()
    await db.refresh(profile)
    return _simulation_response(user, profile)
