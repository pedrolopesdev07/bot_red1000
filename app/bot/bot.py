import asyncio
from contextlib import suppress

from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage

from app.bot.handlers import build_router
from app.core.security import RateLimitMiddleware
from app.bot.reminders import run_credit_reminders


def create_dispatcher() -> Dispatcher:
    dispatcher = Dispatcher(storage=MemoryStorage())
    dispatcher.update.outer_middleware(RateLimitMiddleware())
    dispatcher.include_router(build_router())
    return dispatcher


async def run_bot(token: str) -> None:
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not configured")
    bot = Bot(token=token)
    reminder_task = asyncio.create_task(run_credit_reminders(bot), name="credit-reminders")
    try:
        await create_dispatcher().start_polling(bot)
    finally:
        reminder_task.cancel()
        with suppress(asyncio.CancelledError):
            await reminder_task
        await bot.session.close()
