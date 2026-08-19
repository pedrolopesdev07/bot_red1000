from fastapi import APIRouter, Depends, Response
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import AccountUpdate, MessageResponse, UserResponse
from app.core.config import get_settings
from app.core.web_security import WebSession, delete_all_user_sessions, get_current_user, get_web_session, require_csrf
from app.database.database import get_session
from app.database.models import Analysis, Payment, UsageDaily, User

router = APIRouter(tags=["users"])


@router.get("/me", response_model=UserResponse)
async def me(
    user: User = Depends(get_current_user), session: WebSession = Depends(get_web_session)
) -> UserResponse:
    return UserResponse(
        id=user.id, email=user.email, role=user.role.value, plan=user.plan.name,
        bonus_credits=user.bonus_credits, reminders_enabled=user.reminders_enabled,
        csrf_token=session.csrf_token, subscription_status=user.subscription_status,
    )


@router.patch("/me", response_model=MessageResponse, dependencies=[Depends(require_csrf)])
async def update_me(
    payload: AccountUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> MessageResponse:
    stored = await db.get(User, user.id)
    if payload.reminders_enabled is not None:
        stored.reminders_enabled = payload.reminders_enabled
    await db.commit()
    return MessageResponse(message="Preferências atualizadas")


@router.post("/me/logout-all", response_model=MessageResponse, dependencies=[Depends(require_csrf)])
async def logout_all(response: Response, user: User = Depends(get_current_user)) -> MessageResponse:
    await delete_all_user_sessions(user.id)
    settings = get_settings()
    response.delete_cookie(settings.session_cookie_name, path="/")
    response.delete_cookie("reda1000_csrf", path="/")
    return MessageResponse(message="Todas as sessões foram encerradas")


@router.delete("/me", response_model=MessageResponse, dependencies=[Depends(require_csrf)])
async def delete_account(
    response: Response,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> MessageResponse:
    await db.execute(delete(Analysis).where(Analysis.user_id == user.id))
    await db.execute(delete(UsageDaily).where(UsageDaily.user_id == user.id))
    await db.execute(delete(Payment).where(Payment.user_id == user.id))
    stored = await db.get(User, user.id)
    await db.delete(stored)
    await db.commit()
    await delete_all_user_sessions(user.id)
    settings = get_settings()
    response.delete_cookie(settings.session_cookie_name, path="/")
    response.delete_cookie("reda1000_csrf", path="/")
    return MessageResponse(message="Conta e dados pessoais excluídos")
