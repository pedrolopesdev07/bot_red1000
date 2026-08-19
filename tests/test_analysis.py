import json

import pytest

from app.services.gemini.client import GeminiTimeout
from app.services.gemini.evaluator import GeminiEvaluator, InvalidGeminiResponse


class FakeClient:
    def __init__(self, response: str | Exception) -> None:
        self.response = response

    async def generate_json(self, prompt: str, system_instruction: str) -> str:
        if isinstance(self.response, Exception):
            raise self.response
        return self.response


async def test_valid_gemini_json(evaluation_payload: dict) -> None:
    result = await GeminiEvaluator(FakeClient(json.dumps(evaluation_payload))).evaluate("x")
    assert result.total_score == 800


async def test_invalid_gemini_json() -> None:
    with pytest.raises(InvalidGeminiResponse):
        await GeminiEvaluator(FakeClient("not-json")).evaluate("x")


async def test_gemini_timeout_propagates() -> None:
    with pytest.raises(GeminiTimeout):
        await GeminiEvaluator(FakeClient(GeminiTimeout("timeout"))).evaluate("x")
