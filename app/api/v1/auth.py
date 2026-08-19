import secrets
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.api.v1.schemas import MagicLinkRequest, MagicLinkResponse, MagicLinkVerify, MessageResponse
from app.core.config import get_settings
from app.core.redis import get_redis
from app.core.web_security import WebSession, create_web_session, delete_web_session, get_web_session, rate_limit, require_csrf
from app.database.database import SessionFactory
from app.database.repositories.users import UserRepository
from app.services.email import send_magic_link

router = APIRouter(prefix="/auth", tags=["auth"])


def _serializer() -> URLSafeTimedSerializer:
    secret = get_settings().secret_key
    if len(secret) < 32:
        raise RuntimeError("SECRET_KEY must contain at least 32 characters")
    return URLSafeTimedSerializer(secret, salt="reda1000-magic-link")


@router.post("/magic-link", response_model=MagicLinkResponse, dependencies=[Depends(rate_limit("login", 5, 300))])
async def request_magic_link(payload: MagicLinkRequest) -> MagicLinkResponse:
    settings = get_settings()
    nonce = secrets.token_urlsafe(24)
    token = _serializer().dumps({"email": str(payload.email).casefold(), "nonce": nonce})
    await get_redis().setex(f"magic:{nonce}", settings.magic_link_ttl_seconds, "unused")
    link = f"{settings.frontend_url}/login/verificar?token={quote(token)}"
    sent = await send_magic_link(str(payload.email), link)
    debug_url = link if settings.dev_auth_bypass and not settings.is_production else None
    if not sent and debug_url is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Envio de e-mail indisponível")
    return MagicLinkResponse(message="Se o e-mail for válido, o link de acesso será enviado.", debug_url=debug_url)


@router.post("/verify", response_model=MessageResponse, dependencies=[Depends(rate_limit("verify", 10, 300))])
async def verify_magic_link(payload: MagicLinkVerify, response: Response) -> MessageResponse:
    settings = get_settings()
    try:
        data = _serializer().loads(payload.token, max_age=settings.magic_link_ttl_seconds)
        email = str(data["email"])
        nonce = str(data["nonce"])
    except SignatureExpired as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Link expirado") from exc
    except (BadSignature, KeyError, TypeError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Link inválido") from exc
    if await get_redis().getdel(f"magic:{nonce}") is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Link já utilizado ou expirado")
    async with SessionFactory.begin() as db:
        user = await UserRepository(db).get_or_create_by_email(email)
    web_session = await create_web_session(user.id)
    response.set_cookie(
        settings.session_cookie_name, web_session.id, httponly=True, secure=settings.cookie_secure,
        samesite="lax", max_age=settings.session_ttl_seconds, path="/"
    )
    response.set_cookie(
        "reda1000_csrf", web_session.csrf_token, httponly=False, secure=settings.cookie_secure,
        samesite="lax", max_age=settings.session_ttl_seconds, path="/"
    )
    return MessageResponse(message="Acesso confirmado")


@router.post("/logout", response_model=MessageResponse)
async def logout(
    response: Response,
    session: WebSession = Depends(require_csrf),
) -> MessageResponse:
    settings = get_settings()
    await delete_web_session(session.id)
    response.delete_cookie(settings.session_cookie_name, path="/")
    response.delete_cookie("reda1000_csrf", path="/")
    return MessageResponse(message="Sessão encerrada")
