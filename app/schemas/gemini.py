from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

VALID_SCORES = {0, 40, 80, 120, 160, 200}


class EnemCompetencyScore(BaseModel):
    model_config = ConfigDict(extra="forbid")
    score: int
    justification: str = Field(min_length=1)
    evidence: list["EnemEvidence | str"] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def score_uses_enem_scale(self) -> "EnemCompetencyScore":
        if self.score not in VALID_SCORES:
            raise ValueError(f"score must be one of {sorted(VALID_SCORES)}")
        return self


class EnemEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1)
    tipo: Literal["ponto_forte", "ponto_fraco"]


class EnemEvaluation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    competencia_1: EnemCompetencyScore
    competencia_2: EnemCompetencyScore
    competencia_3: EnemCompetencyScore
    competencia_4: EnemCompetencyScore
    competencia_5: EnemCompetencyScore
    total_score: int = 0
    confidence: Literal["baixa", "media", "alta"]
    summary: str
    strengths: list[str]
    weaknesses: list[str]
    improvements: list[str]
    warnings: list[str]

    @model_validator(mode="after")
    def calculate_total(self) -> "EnemEvaluation":
        self.total_score = sum(
            getattr(self, f"competencia_{number}").score for number in range(1, 6)
        )
        return self
