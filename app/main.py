import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.v1.router import router as api_v1_router
from app.core.queue import close_queue
from app.core.redis import close_redis
from app.core.web_middleware import SecurityHeadersMiddleware
from app.core.config import get_settings
from app.core.logging import configure_logging

settings = get_settings()
configure_logging(settings.log_level)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await close_queue()
    await close_redis()


app = FastAPI(
    title="Reda1000IA", version="1.0.0", lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.allowed_origin_regex or None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-CSRF-Token", "Idempotency-Key", "X-Request-ID", "Stripe-Signature"],
)

@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled_request_error", extra={"correlation_id": getattr(request.state, "correlation_id", None), "path": request.url.path})
    headers = {
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer",
    }
    origin = request.headers.get("origin")
    if origin and settings.is_cors_origin_allowed(origin):
        headers.update({
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true", "Vary": "Origin",
        })
    return JSONResponse(
        status_code=500, headers=headers,
        content={"detail": "Erro interno", "request_id": getattr(request.state, "correlation_id", None)},
    )

app.include_router(health_router)
app.include_router(api_v1_router)
