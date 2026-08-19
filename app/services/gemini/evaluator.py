import json

from pydantic import ValidationError

from app.schemas.gemini import EnemEvaluation
from app.services.gemini.client import GeminiClient, GeminiError
from app.services.gemini.prompts import load_prompt


class InvalidGeminiResponse(GeminiError):
    pass


class GeminiEvaluator:
    def __init__(self, client: GeminiClient) -> None:
        self.client = client

    async def evaluate(self, essay: str, topic: str | None = None) -> EnemEvaluation:
        user_prompt = load_prompt("enem_evaluation.txt").replace("{{ESSAY}}", essay).replace("{{TOPIC}}", topic or "Tema não informado")
        raw = await self.client.generate_json(user_prompt, load_prompt("enem_system.txt"))
        try:
            payload = json.loads(raw)
            return EnemEvaluation.model_validate(payload)
        except (json.JSONDecodeError, ValidationError) as exc:
            raise InvalidGeminiResponse("Gemini returned invalid evaluation JSON") from exc
