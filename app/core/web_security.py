import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.redis import get_redis
from app.database.database import get_session
from app.database.models import Plan, User, UserRole


def get_client_ip(request: Request) -> str:
    """Use Render's first forwarded hop in production; fall back locally."""
    settings = get_settings()
    forwarded = request.headers.get("x-forwarded-for", "")
    if settings.is_production and forwarded:
        candidate = forwarded.split(",", 1)[0].strip()
        if candidate:
            return candidate
    return request.client.host if request.client else "unknown"


@dataclass(frozen=True)
class WebSession:
    id: str
    user_id: int
    csrf_token: str


async def create_web_session(user_id: int) -> WebSession:
    settings = get_settings()
    session = WebSession(secrets.token_urlsafe(32), user_id, secrets.token_urlsafe(32))
    await get_redis().setex(
        f"session:{session.id}",
        settings.session_ttl_seconds,
        json.dumps({"user_id": user_id, "csrf_token": session.csrf_token}),
    )
    await get_redis().sadd(f"user_sessions:{user_id}", session.id)
    await get_redis().expire(f"user_sessions:{user_id}", settings.session_ttl_seconds)
    return session


async def delete_web_session(session_id: str) -> None:
    redis = get_redis()
    raw = await redis.get(f"session:{session_id}")
    if raw:
        user_id = json.loads(raw).get("user_id")
        await redis.srem(f"user_sessions:{user_id}", session_id)
    await redis.delete(f"session:{session_id}")


async def delete_all_user_sessions(user_id: int) -> None:
    redis = get_redis()
    key = f"user_sessions:{user_id}"
    session_ids = await redis.smembers(key)
    if session_ids:
        await redis.delete(*(f"session:{session_id}" for session_id in session_ids))
    await redis.delete(key)


async def get_web_session(request: Request) -> WebSession:
    if get_settings().auth_disabled:
        return WebSession("demo", 0, "demo")
    cookie_name = get_settings().session_cookie_name
    session_id = request.cookies.get(cookie_name)
    if not session_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Autenticação necessária")
    raw = await get_redis().get(f"session:{session_id}")
    if not raw:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessão expirada")
    data = json.loads(raw)
    request.state.user_id = int(data["user_id"])
    return WebSession(session_id, int(data["user_id"]), data["csrf_token"])


async def require_csrf(
    request: Request, session: WebSession = Depends(get_web_session)
) -> WebSession:
    if get_settings().auth_disabled:
        return session
    supplied = request.headers.get("X-CSRF-Token", "")
    if not supplied or not hmac.compare_digest(supplied, session.csrf_token):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Token CSRF inválido")
    return session


async def get_current_user(
    web_session: WebSession = Depends(get_web_session),
    db: AsyncSession = Depends(get_session),
) -> User:
    settings = get_settings()
    if settings.auth_disabled:
        # The dashboard loads several endpoints in parallel. Serialize the first
        # demo-user creation so a fresh database cannot insert it more than once.
        await db.execute(select(func.pg_advisory_xact_lock(8_341_000)))
        user = await db.scalar(select(User).where(User.email == settings.demo_user_email))
        if not user:
            premium = await db.scalar(select(Plan).where(Plan.name == "PREMIUM"))
            if not premium:
                raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Plano de demonstração indisponível")
            user = User(
                email=settings.demo_user_email,
                plan_id=premium.id,
                plan=premium,
                role=UserRole.ADMIN,
                mfa_enabled=True,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        elif user.role is not UserRole.ADMIN or not user.mfa_enabled or not user.is_active:
            user.role = UserRole.ADMIN
            user.mfa_enabled = True
            user.is_active = True
            await db.commit()
        return user
    user = await db.get(User, web_session.user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Conta indisponível")
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role is not UserRole.ADMIN or not user.mfa_enabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Acesso administrativo negado")
    return user


async def require_admin_ip(request: Request) -> None:
    client_ip = get_client_ip(request)
    if client_ip not in get_settings().admin_ip_allowlist:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Acesso administrativo indisponível neste endereço")


def rate_limit(scope: str, limit: int, window_seconds: int):
    async def dependency(request: Request) -> None:
        client_ip = get_client_ip(request)
        session_id = request.cookies.get(get_settings().session_cookie_name, "anonymous")
        actor = hashlib.sha256(f"{client_ip}:{session_id}".encode()).hexdigest()[:24]
        bucket = int(time.time()) // window_seconds
        key = f"rate:{scope}:{actor}:{bucket}"
        redis = get_redis()
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, window_seconds + 1)
        if count > limit:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Muitas tentativas; aguarde um pouco")

    return dependency
