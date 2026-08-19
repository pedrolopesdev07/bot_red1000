from typing import Protocol

from app.schemas.gemini import EnemEvaluation


class EvaluationProvider(Protocol):
    async def evaluate(self, essay: str) -> EnemEvaluation: ...


class EnemEvaluator:
    def __init__(self, provider: EvaluationProvider) -> None:
        self.provider = provider

    async def evaluate(self, essay: str) -> EnemEvaluation:
        return await self.provider.evaluate(essay)
