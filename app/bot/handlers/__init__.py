from aiogram import Router

from app.bot.handlers.analysis import router as analysis_router
from app.bot.handlers.confirmation import router as confirmation_router
from app.bot.handlers.engagement import router as engagement_router
from app.bot.handlers.start import router as start_router
from app.bot.handlers.subscription import router as subscription_router
from app.bot.handlers.transcription import router as transcription_router


def build_router() -> Router:
    router = Router(name="root")
    router.include_routers(
        start_router, subscription_router, engagement_router, analysis_router, confirmation_router, transcription_router
    )
    return router
