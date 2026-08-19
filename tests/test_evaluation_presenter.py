import uuid

from app.bot.presenters import render_evaluation


def test_free_renders_scores_and_blocks_all_detailed_content(evaluation) -> None:
    evaluation.competencia_1.justification = "SEGREDO JUSTIFICATIVA C1"
    evaluation.competencia_2.justification = "SEGREDO JUSTIFICATIVA C2"
    evaluation.strengths = ["SEGREDO PONTO FORTE"]
    evaluation.weaknesses = ["SEGREDO PONTO FRACO"]
    evaluation.improvements = ["SEGREDO RECOMENDAÇÃO"]
    evaluation.warnings = ["SEGREDO RESSALVA"]

    rendered = render_evaluation(evaluation, "FREE", 0, uuid.uuid4(), daily_limit=1)

    assert "Nota estimada: 800/1000" in rendered.text
    for number in range(1, 6):
        assert f"Competência {number}: 160/200" in rendered.text
    assert "disponível no Premium" in rendered.text
    assert "Quer entender como sair dos 800 pontos" in rendered.text
    assert "Análises gratuitas restantes hoje: 0/1" in rendered.text
    assert rendered.reply_markup is not None
    button = rendered.reply_markup.inline_keyboard[0][0]
    assert button.text == "🔓 DESBLOQUEAR ANÁLISE COMPLETA"
    assert button.callback_data.startswith("upgrade_premium:")

    forbidden = [
        "SEGREDO JUSTIFICATIVA C1",
        "SEGREDO JUSTIFICATIVA C2",
        "SEGREDO PONTO FORTE",
        "SEGREDO PONTO FRACO",
        "SEGREDO RECOMENDAÇÃO",
        "SEGREDO RESSALVA",
    ]
    assert all(value not in rendered.text for value in forbidden)


def test_premium_renders_complete_evaluation(evaluation) -> None:
    evaluation.competencia_1.justification = "JUSTIFICATIVA PREMIUM"
    evaluation.strengths = ["PONTO FORTE PREMIUM"]
    evaluation.weaknesses = ["PONTO FRACO PREMIUM"]
    evaluation.improvements = ["RECOMENDAÇÃO PREMIUM"]
    evaluation.warnings = ["RESSALVA PREMIUM"]

    rendered = render_evaluation(evaluation, "PREMIUM", 7, uuid.uuid4(), daily_limit=10)

    assert "Nota estimada: 800/1000" in rendered.text
    for number in range(1, 6):
        assert f"Competência {number}: 160/200" in rendered.text
    assert "JUSTIFICATIVA PREMIUM" in rendered.text
    assert "PONTO FORTE PREMIUM" in rendered.text
    assert "PONTO FRACO PREMIUM" in rendered.text
    assert "RECOMENDAÇÃO PREMIUM" in rendered.text
    assert "RESSALVA PREMIUM" in rendered.text
    assert "Análises restantes hoje: 7/10" in rendered.text
    assert "Recurso Premium" not in rendered.text
    assert "disponível no Premium" not in rendered.text
    assert rendered.reply_markup is None
