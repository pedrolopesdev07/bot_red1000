import asyncio
import logging
import time

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)


class GeminiError(RuntimeError):
    pass


class GeminiTimeout(GeminiError):
    pass


class GeminiClient:
    _consecutive_failures = 0
    _open_until = 0.0
    _breaker_lock = asyncio.Lock()

    def __init__(self, api_key: str, model: str, timeout_seconds: float = 60) -> None:
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not configured")
        self.client = genai.Client(api_key=api_key)
        self.model = model
        self.timeout_seconds = timeout_seconds

    async def generate_json(self, prompt: str, system_instruction: str) -> str:
        async with self._breaker_lock:
            if time.monotonic() < self._open_until:
                raise GeminiError("Gemini service is temporarily unavailable")

        async def call() -> str:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )
            if not response.text:
                raise GeminiError("Gemini returned an empty response")
            return response.text

        for attempt in range(2):
            try:
                result = await asyncio.wait_for(call(), timeout=self.timeout_seconds)
                async with self._breaker_lock:
                    self.__class__._consecutive_failures = 0
                return result
            except TimeoutError as exc:
                if attempt == 1:
                    await self._record_failure()
                    raise GeminiTimeout("Gemini request timed out") from exc
            except Exception as exc:
                logger.warning("Gemini request failed", extra={"attempt": attempt + 1})
                if attempt == 1:
                    await self._record_failure()
                    raise GeminiError("Gemini request failed") from exc
            await asyncio.sleep(0.5)
        raise GeminiError("Gemini request failed")

    async def _record_failure(self) -> None:
        async with self._breaker_lock:
            self.__class__._consecutive_failures += 1
            if self._consecutive_failures >= 5:
                self.__class__._open_until = time.monotonic() + 30
