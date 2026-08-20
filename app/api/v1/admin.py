import logging
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import AdminAnalysisSummary, AdminUserSummary, DemoControlsResponse, DemoControlsUpdate
from app.core.web_security import require_admin, require_admin_ip, require_csrf
from app.database.database import get_session
from app.database.models import Analysis, Plan, UsageDaily, User
from app.services.usage import UsageLimiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin_ip)])


@router.get("/demo-controls", response_model=DemoControlsResponse)
async def demo_controls(
    admin: User = Depends(require_admin), db: AsyncSession = Depends(get_session),
) -> DemoControlsResponse:
    current = await UsageLimiter(db).status(admin)
    return DemoControlsResponse(
        plan=admin.plan.name, bonus_credits=admin.bonus_credits, used=current.used,
        remaining=current.remaining_label, next_credit_at=current.next_credit_at,
    )


@router.patch("/demo-controls", response_model=DemoControlsResponse, dependencies=[Depends(require_csrf)])
async def update_demo_controls(
    payload: DemoControlsUpdate,
    admin: User = Depends(require_admin), db: AsyncSession = Depends(get_session),
) -> DemoControlsResponse:
    if payload.plan is not None:
        plan = await db.scalar(select(Plan).where(Plan.name == payload.plan, Plan.active.is_(True)))
        if not plan:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Plano indisponível")
        admin.plan_id, admin.plan = plan.id, plan
    if payload.bonus_credits is not None:
        admin.bonus_credits = payload.bonus_credits
    if payload.reset_usage:
        await db.execute(delete(UsageDaily).where(UsageDaily.user_id == admin.id))
    elif payload.used == 0:
        await db.execute(delete(UsageDaily).where(UsageDaily.user_id == admin.id))
    elif payload.used is not None:
        row = await db.scalar(select(UsageDaily).where(UsageDaily.user_id == admin.id, UsageDaily.date == date.today()))
        if row:
            row.analyses_count = payload.used
            row.updated_at = datetime.now(timezone.utc)
        elif payload.used:
            db.add(UsageDaily(user_id=admin.id, date=date.today(), analyses_count=payload.used))
    if payload.renewal_minutes is not None:
        row = await db.scalar(select(UsageDaily).where(UsageDaily.user_id == admin.id).order_by(UsageDaily.updated_at.desc()).limit(1))
        if not row:
            row = UsageDaily(user_id=admin.id, date=date.today(), analyses_count=1)
            db.add(row)
            await db.flush()
        row.updated_at = datetime.now(timezone.utc) - timedelta(hours=24) + timedelta(minutes=payload.renewal_minutes)
    await db.commit()
    await db.refresh(admin)
    current = await UsageLimiter(db).status(admin)
    return DemoControlsResponse(
        plan=admin.plan.name, bonus_credits=admin.bonus_credits, used=current.used,
        remaining=current.remaining_label, next_credit_at=current.next_credit_at,
    )


@router.get("/users", response_model=list[AdminUserSummary])
async def admin_users(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=50),
    admin: User = Depends(require_admin), db: AsyncSession = Depends(get_session),
) -> list[AdminUserSummary]:
    logger.info("admin_users_access", extra={"admin_user_id": admin.id})
    rows = await db.scalars(select(User).order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    return [AdminUserSummary(
        id=user.id, email=user.email, role=user.role.value, plan=user.plan.name,
        is_active=user.is_active, created_at=user.created_at,
    ) for user in rows]


@router.get("/analyses", response_model=list[AdminAnalysisSummary])
async def admin_analyses(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=50),
    admin: User = Depends(require_admin), db: AsyncSession = Depends(get_session),
) -> list[AdminAnalysisSummary]:
    logger.info("admin_analyses_access", extra={"admin_user_id": admin.id})
    rows = await db.scalars(select(Analysis).order_by(Analysis.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    return [AdminAnalysisSummary(
        id=item.id, user_id=item.user_id, status=item.status.value, created_at=item.created_at,
        completed_at=item.completed_at, total_score=item.total_score,
        summary=(item.summary[:240] if item.summary else None),
    ) for item in rows]
