import pytest
from pydantic import ValidationError

from app.schemas.gemini import EnemCompetencyScore


@pytest.mark.parametrize("score", [0, 40, 80, 120, 160, 200])
def test_accepts_enem_score_levels(score: int) -> None:
    assert EnemCompetencyScore(score=score, justification="ok").score == score


@pytest.mark.parametrize("score", [-1, 20, 201])
def test_rejects_invalid_scores(score: int) -> None:
    with pytest.raises(ValidationError):
        EnemCompetencyScore(score=score, justification="ok")
