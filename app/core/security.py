import time
from collections import defaultdict, deque

from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, TelegramObject
from typing import Any, Awaitable, Callable


class InMemoryRateLimiter:
    """Best-effort single-process limiter; replaceable by Redis in multi-instance deployments."""

    def __init__(self, requests: int = 8, window_seconds: int = 60) -> None:
        self.requests = requests
        self.window_seconds = window_seconds
        self._events: dict[int, deque[float]] = defaultdict(deque)

    def allow(self, key: int) -> bool:
        now = time.monotonic()
        events = self._events[key]
        while events and events[0] <= now - self.window_seconds:
            events.popleft()
        if len(events) >= self.requests:
            return False
        events.append(now)
        return True


class RateLimitMiddleware(BaseMiddleware):
    def __init__(self, requests: int = 15, window_seconds: int = 60) -> None:
        self.limiter = InMemoryRateLimiter(requests, window_seconds)

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        user = data.get("event_from_user")
        if user and not self.limiter.allow(user.id):
            if isinstance(event, Message):
                await event.answer("Muitas solicitações em pouco tempo. Aguarde um minuto.")
            elif isinstance(event, CallbackQuery):
                await event.answer("Aguarde um minuto antes de tentar novamente.", show_alert=True)
            return None
        return await handler(event, data)
