import re

from app.schemas.gemini import EnemCompetencyScore, EnemEvaluation, EnemEvidence


def _level(value: float) -> int:
    return min(200, max(0, round(value / 40) * 40))


def evaluate_locally(essay: str) -> EnemEvaluation:
    """Low-cost deterministic fallback used only after the Ultra Gemini allowance."""
    text = essay.strip()
    words = re.findall(r"[^\W\d_]+", text.lower(), flags=re.UNICODE)
    sentences = [part.strip() for part in re.split(r"[.!?]+", text) if part.strip()]
    paragraphs = [part.strip() for part in re.split(r"\n+", text) if part.strip()]
    connectors = sum(text.lower().count(term) for term in ("portanto", "além disso", "contudo", "assim", "dessa forma", "porém", "logo"))
    proposal = sum(term in text.lower() for term in ("deve", "por meio de", "a fim de", "governo", "ministério", "sociedade"))
    unique_ratio = len(set(words)) / max(1, len(words))

    raw_scores = [
        120 + min(80, unique_ratio * 100),
        80 + min(120, len(words) / 2),
        80 + min(120, len(sentences) * 10 + len(paragraphs) * 8),
        80 + min(120, connectors * 20),
        min(200, proposal * 40),
    ]
    names = (
        "domínio da modalidade escrita formal", "compreensão e desenvolvimento do tema",
        "organização dos argumentos", "coesão textual", "proposta de intervenção",
    )
    competencies: list[EnemCompetencyScore] = []
    for index, raw in enumerate(raw_scores):
        score = _level(raw)
        strong = score >= 160
        competencies.append(EnemCompetencyScore(
            score=score,
            justification=f"Avaliação local estimada de {names[index]}, baseada em indicadores estruturais do texto.",
            evidence=[EnemEvidence(
                text=(f"Os indicadores estruturais de {names[index]} foram consistentes." if strong else f"Os indicadores estruturais de {names[index]} ficaram abaixo do nível recomendado."),
                tipo="ponto_forte" if strong else "ponto_fraco",
            )],
            improvements=[] if strong else [f"Continue praticando {names[index]} e revise esse aspecto antes do próximo envio."],
        ))
    return EnemEvaluation(
        **{f"competencia_{index + 1}": value for index, value in enumerate(competencies)},
        confidence="baixa",
        summary="Correção estimada com base nos critérios estruturais e nas cinco competências do ENEM.",
        strengths=[item.evidence[0].text for item in competencies if item.score >= 160],
        weaknesses=[item.evidence[0].text for item in competencies if item.score < 160],
        improvements=[improvement for item in competencies for improvement in item.improvements],
        warnings=["A correção é uma estimativa educacional e pode divergir de uma avaliação humana."],
    )
