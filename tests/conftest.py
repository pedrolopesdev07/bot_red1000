import pytest

from app.schemas.gemini import EnemCompetencyScore, EnemEvaluation


@pytest.fixture
def evaluation_payload() -> dict:
    competency = {
        "score": 160, "justification": "Justificativa objetiva.",
        "evidence": ["trecho"], "improvements": ["melhorar"]
    }
    return {
        **{f"competencia_{i}": competency.copy() for i in range(1, 6)},
        "total_score": 999, "confidence": "media", "summary": "Resumo",
        "strengths": ["Coerência"], "weaknesses": ["Detalhamento"],
        "improvements": ["Revisar"], "warnings": ["Estimativa"]
    }


@pytest.fixture
def evaluation(evaluation_payload: dict) -> EnemEvaluation:
    return EnemEvaluation.model_validate(evaluation_payload)
