from dataclasses import dataclass
import uuid

from aiogram.types import InlineKeyboardMarkup

from app.bot.keyboards import premium_upgrade_keyboard
from app.schemas.gemini import EnemEvaluation, EnemEvidence
from app.services.plans import get_plan_policy


DISCLAIMER = (
    "A avaliação é uma estimativa baseada nos critérios do ENEM e pode divergir de uma "
    "correção humana."
)


@dataclass(frozen=True)
class RenderedEvaluation:
    text: str
    reply_markup: InlineKeyboardMarkup | None = None


def _items(values: list[str | EnemEvidence]) -> str:
    def render(item: str | EnemEvidence) -> str:
        if isinstance(item, EnemEvidence):
            label = "Ponto forte" if item.tipo == "ponto_forte" else "Ponto fraco"
            return f"{label}: {item.text}"
        return item

    return "\n".join(f"• {render(item)}" for item in values) or "• Nenhum item informado."


def _render_free(
    evaluation: EnemEvaluation, remaining: int | str, daily_limit: int | str, analysis_id: uuid.UUID
) -> RenderedEvaluation:
    sections = [
        "🎯 RESULTADO DA ANÁLISE",
        f"Nota estimada: {evaluation.total_score}/1000",
        "📊 Desempenho por competência",
    ]
    for number in range(1, 6):
        competency = getattr(evaluation, f"competencia_{number}")
        sections.append(
            f"Competência {number}: {competency.score}/200\n"
            "🔒 Análise detalhada: disponível no Premium"
        )
    sections.extend(
        [
            "📈 Pontos fortes\n🔒 Recurso Premium\n"
            "Veja o que você fez bem e quais aspectos deve manter nas próximas redações.",
            "⚠️ Onde você perdeu pontos\n🔒 Recurso Premium\n"
            "Descubra os principais problemas encontrados no seu texto e como afetaram sua nota.",
            "🚀 Como melhorar sua redação\n🔒 Recurso Premium\n"
            "Receba recomendações personalizadas com base nos erros identificados.",
            "📝 Análise detalhada por competência\n🔒 Recurso Premium\n"
            "Entenda o motivo da sua pontuação em cada uma das cinco competências.",
            f"💎 Quer entender como sair dos {evaluation.total_score} pontos e evoluir sua redação?\n\n"
            "Com o Reda1000IA Premium, você recebe a análise completa do texto:\n\n"
            "✓ justificativa das 5 competências\n"
            "✓ identificação dos seus principais erros\n"
            "✓ pontos fortes da redação\n"
            "✓ pontos que precisam melhorar\n"
            "✓ recomendações personalizadas\n"
            "✓ análise completa da proposta de intervenção\n"
            "✓ mais redações por dia",
            f"📅 Análises gratuitas restantes hoje: {remaining}/{daily_limit}",
            DISCLAIMER,
        ]
    )
    return RenderedEvaluation(
        "\n\n".join(sections), premium_upgrade_keyboard(analysis_id)
    )


def _render_premium(
    evaluation: EnemEvaluation, remaining: int | str, daily_limit: int | str
) -> RenderedEvaluation:
    sections = ["🎯 RESULTADO DA ANÁLISE", f"Nota estimada: {evaluation.total_score}/1000"]
    for number in range(1, 6):
        competency = getattr(evaluation, f"competencia_{number}")
        sections.append(
            f"Competência {number}: {competency.score}/200\n"
            f"Justificativa: {competency.justification}\n"
            f"Evidências do texto:\n{_items(competency.evidence)}\n"
            f"Como melhorar:\n{_items(competency.improvements)}"
        )
    weakest_number = min(
        range(1, 6), key=lambda number: getattr(evaluation, f"competencia_{number}").score
    )
    weakest = getattr(evaluation, f"competencia_{weakest_number}")
    sections.extend(
        [
            f"📈 Pontos fortes\n{_items(evaluation.strengths)}",
            f"⚠️ Pontos a melhorar\n{_items(evaluation.weaknesses)}",
            f"🚀 Recomendações\n{_items(evaluation.improvements)}",
            "🗓️ Plano de ação personalizado\n"
            f"1. Priorize a Competência {weakest_number}.\n"
            f"2. Aplique esta orientação: {(weakest.improvements or evaluation.improvements or ['revise os pontos indicados'])[0]}\n"
            "3. Reescreva o trecho mais fraco e confira se a ideia ficou explícita.",
            "✍️ Exercício prático\n"
            f"Reescreva um parágrafo focando na Competência {weakest_number}. "
            "Depois, compare a nova versão com as evidências e recomendações acima.",
            f"Ressalvas\n{_items(evaluation.warnings)}",
            f"Confiança da análise: {evaluation.confidence}",
            f"Análises restantes hoje: {remaining}/{daily_limit}",
            DISCLAIMER,
        ]
    )
    return RenderedEvaluation("\n\n".join(sections))


def render_evaluation(
    evaluation: EnemEvaluation,
    plan: str,
    remaining_analyses: int | str,
    analysis_id: uuid.UUID,
    daily_limit: int | str | None = None,
) -> RenderedEvaluation:
    policy = get_plan_policy(plan)
    limit = daily_limit if daily_limit is not None else policy.daily_analyses
    if policy.detailed_feedback:
        return _render_premium(evaluation, remaining_analyses, limit)
    return _render_free(evaluation, remaining_analyses, limit, analysis_id)
