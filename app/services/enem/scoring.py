from app.schemas.gemini import EnemEvaluation


def calculate_total(evaluation: EnemEvaluation) -> int:
    return sum(getattr(evaluation, f"competencia_{number}").score for number in range(1, 6))
