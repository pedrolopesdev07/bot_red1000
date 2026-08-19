from app.services.enem.local_evaluator import evaluate_locally


def test_local_evaluator_returns_valid_enem_evaluation() -> None:
    result = evaluate_locally(
        "A educação exige atenção da sociedade. Além disso, políticas públicas são essenciais.\n"
        "Portanto, o governo deve criar programas por meio de escolas, a fim de ampliar o acesso."
    )
    assert result.total_score % 40 == 0
    assert result.confidence == "baixa"
    assert result.warnings
