import asyncio
import logging
from datetime import datetime, timezone

from aiogram import Bot

from app.core.config import get_settings
from app.database.database import SessionFactory
from app.database.repositories.users import UserRepository
from app.services.retention import weekly_theme

logger = logging.getLogger(__name__)


async def run_credit_reminders(bot: Bot) -> None:
    interval = get_settings().reminder_poll_seconds
    while True:
        try:
            async with SessionFactory.begin() as session:
                users = await UserRepository(session).due_credit_reminders()
                for user in users:
                    try:
                        await bot.send_message(
                            user.telegram_id,
                            "🎉 Seu crédito FREE foi renovado!\n\n"
                            f"Tema da semana: {weekly_theme()}\n\n"
                            "Envie sua redação quando quiser.",
                        )
                        user.last_reminder_at = datetime.now(timezone.utc)
                    except Exception:
                        logger.exception("Credit reminder failed", extra={"user_id": user.id})
        except Exception:
            logger.exception("Credit reminder cycle failed")
        await asyncio.sleep(interval)
