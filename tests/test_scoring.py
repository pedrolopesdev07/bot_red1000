from app.services.enem.scoring import calculate_total


def test_calculates_total_and_overwrites_ai_value(evaluation) -> None:
    assert evaluation.total_score == 800
    assert calculate_total(evaluation) == 800
