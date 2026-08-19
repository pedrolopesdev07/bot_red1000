from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import CreditLedgerResponse, CreditTransactionResponse, PlanResponse, RandomThemeResponse, ThemeResponse, UsageResponse
from app.core.web_security import get_current_user
from app.database.database import get_session
from app.database.models import CreditTransaction, EssayTopic, Plan, User
from fastapi import Query
from app.services.plans import get_plan_policy
from app.services.usage import UsageLimiter
from app.services.retention import weekly_theme

router = APIRouter(tags=["catalog"])


@router.get("/theme", response_model=ThemeResponse)
async def theme() -> ThemeResponse:
    return ThemeResponse(theme=weekly_theme())


@router.get("/themes/random", response_model=RandomThemeResponse)
async def random_theme(db: AsyncSession = Depends(get_session)) -> RandomThemeResponse:
    item = await db.scalar(select(EssayTopic).where(EssayTopic.active.is_(True)).order_by(func.random()).limit(1))
    if not item:
        return RandomThemeResponse(id=None, theme=weekly_theme(), category="Tema da semana")
    return RandomThemeResponse(id=item.id, theme=item.title, category=item.category)


@router.get("/credits/transactions", response_model=CreditLedgerResponse)
async def credit_transactions(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session),
) -> CreditLedgerResponse:
    where = CreditTransaction.user_id == user.id
    total = int(await db.scalar(select(func.count()).select_from(CreditTransaction).where(where)) or 0)
    rows = await db.scalars(select(CreditTransaction).where(where).order_by(CreditTransaction.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    return CreditLedgerResponse(
        items=[CreditTransactionResponse.model_validate(row, from_attributes=True) for row in rows],
        page=page, page_size=page_size, total=total,
    )


@router.get("/usage", response_model=UsageResponse)
async def usage(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)
) -> UsageResponse:
    current = await UsageLimiter(db).status(user)
    return UsageResponse(
        plan=current.plan, limit=current.daily_limit_label, used=current.used,
        remaining=current.remaining_label, next_credit_at=current.next_credit_at,
        bonus_credits=user.bonus_credits,
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
        ) for item in rows
    ]
