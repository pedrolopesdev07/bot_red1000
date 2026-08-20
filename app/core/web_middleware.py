import time
import uuid
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.responses import JSONResponse

from app.core.config import get_settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        settings = get_settings()
        request.state.correlation_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        started = time.perf_counter()
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > settings.max_request_body_bytes:
                    return JSONResponse({"detail": "Requisição muito grande"}, status_code=413)
            except ValueError:
                return JSONResponse({"detail": "Content-Length inválido"}, status_code=400)
        if request.url.path != "/health":
            client_ip = request.client.host if request.client else "unknown"
            bucket = int(time.time()) // 60
            key = f"rate:global:{client_ip}:{bucket}"
            count = await get_redis().incr(key)
            if count == 1:
                await get_redis().expire(key, 61)
            if count > settings.global_rate_limit:
                return JSONResponse({"detail": "Muitas requisições; aguarde um pouco"}, status_code=429, headers={"Retry-After": "60"})
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.correlation_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-site"
        response.headers["Cache-Control"] = "no-store"
        response.headers["Server-Timing"] = f"app;dur={(time.perf_counter() - started) * 1000:.1f}"
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        logger.info(
            "http_request",
            extra={
                "correlation_id": request.state.correlation_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round((time.perf_counter() - started) * 1000, 1),
            },
        )
        return response
