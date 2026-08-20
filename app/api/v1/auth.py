from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.v1.schemas import CredentialsRequest, MessageResponse, RegistrationRequest
from app.core.config import get_settings
from app.core.passwords import hash_password, verify_password
from app.core.totp import verify_totp
from app.core.web_security import WebSession, create_web_session, delete_web_session, get_client_ip, rate_limit, require_csrf
from app.core.redis import get_redis
from app.database.database import SessionFactory
from app.database.models import Plan, User, UserRole

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookies(response: Response, session: WebSession) -> None:
    settings = get_settings()
    same_site = settings.session_same_site
    response.set_cookie(
        settings.session_cookie_name, session.id, httponly=True, secure=settings.cookie_secure,
        samesite=same_site, max_age=settings.session_ttl_seconds, path="/",
    )
    response.set_cookie(
        "reda1000_csrf", session.csrf_token, httponly=False, secure=settings.cookie_secure,
        samesite=same_site, max_age=settings.session_ttl_seconds, path="/",
    )


@router.post("/register", response_model=MessageResponse, dependencies=[Depends(rate_limit("register", 5, 300))])
async def register(payload: RegistrationRequest, response: Response) -> MessageResponse:
    async with SessionFactory.begin() as db:
        existing = await db.scalar(select(User.id).where(
            (User.username == payload.username) | (User.email == str(payload.email)),
            User.password_hash.is_not(None),
        ))
        if existing is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Nome de usuário indisponível")
        free = await db.scalar(select(Plan).where(Plan.name == "FREE", Plan.active.is_(True)))
        if not free:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Plano gratuito indisponível")
        user = User(
            username=payload.username, email=str(payload.email), password_hash=hash_password(payload.password),
            plan_id=free.id, plan=free,
        )
        db.add(user)
        try:
            await db.flush()
        except IntegrityError as exc:
            raise HTTPException(status.HTTP_409_CONFLICT, "Nome de usuário indisponível") from exc
        user_id = user.id
    session = await create_web_session(user_id)
    _set_session_cookies(response, session)
    return MessageResponse(message="Conta criada")


@router.post("/login", response_model=MessageResponse, dependencies=[Depends(rate_limit("login", 8, 300))])
async def login(payload: CredentialsRequest, response: Response, request: Request) -> MessageResponse:
    settings = get_settings()
    client_ip = get_client_ip(request)
    lock_key = f"login_lock:{client_ip}:{payload.username}"
    failures = int(await get_redis().get(lock_key) or 0)
    if failures >= settings.login_lockout_attempts:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Conta temporariamente bloqueada; tente novamente mais tarde")
    async with SessionFactory() as db:
        user = await db.scalar(select(User).where(
            User.username == payload.username, User.password_hash.is_not(None)
        ))
        if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
            failures = await get_redis().incr(lock_key)
            if failures == 1:
                await get_redis().expire(lock_key, settings.login_lockout_seconds)
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuário ou senha inválidos")
        if user.role is UserRole.ADMIN and client_ip not in settings.admin_ip_allowlist:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Acesso administrativo indisponível neste endereço")
        if user.role is UserRole.ADMIN:
            if not settings.admin_totp_secret:
                raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "MFA administrativo não configurado")
            if not verify_totp(settings.admin_totp_secret, payload.mfa_code or ""):
                raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Código MFA inválido")
        user_id = user.id
    await get_redis().delete(lock_key)
    session = await create_web_session(user_id)
    _set_session_cookies(response, session)
    return MessageResponse(message="Acesso confirmado")


@router.post("/logout", response_model=MessageResponse)
async def logout(response: Response, session: WebSession = Depends(require_csrf)) -> MessageResponse:
    settings = get_settings()
    await delete_web_session(session.id)
    same_site = settings.session_same_site
    response.delete_cookie(
        settings.session_cookie_name, path="/", secure=settings.cookie_secure, samesite=same_site
    )
    response.delete_cookie(
        "reda1000_csrf", path="/", secure=settings.cookie_secure, samesite=same_site
    )
    return MessageResponse(message="Sessão encerrada")
