from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message

from app.database.database import SessionFactory
from app.database.repositories.analyses import AnalysisRepository
from app.database.repositories.users import UserRepository
from app.services.retention import weekly_theme

router = Router(name="engagement")


def _history_text(analyses: list) -> str:
    if not analyses:
        return "Você ainda não possui redações corrigidas. Envie a primeira para iniciar sua evolução."
    chronological = list(reversed(analyses))
    first, latest = chronological[0], chronological[-1]
    delta = (latest.total_score or 0) - (first.total_score or 0)
    trend = f"+{delta}" if delta > 0 else str(delta)
    lines = ["📈 SUA EVOLUÇÃO", f"Evolução no período: {trend} pontos", ""]
    for item in analyses:
        when = item.completed_at.strftime("%d/%m/%Y") if item.completed_at else "--/--/----"
        scores = "/".join(str(getattr(item, f"competency_{n}_score") or 0) for n in range(1, 6))
        lines.append(f"{when} • {item.total_score}/1000 • C1–C5: {scores}")
    weakest = min(range(1, 6), key=lambda n: getattr(latest, f"competency_{n}_score") or 0)
    lines.extend(["", f"Foco recomendado: Competência {weakest}."])
    return "\n".join(lines)


@router.message(Command("historico"))
async def history(message: Message) -> None:
    if not message.from_user:
        return
    async with SessionFactory() as session:
        user = await UserRepository(session).get_by_telegram_id(message.from_user.id)
        if not user:
            await message.answer("Use /start para criar seu cadastro.")
            return
        analyses = await AnalysisRepository(session).list_completed(user.id)
    await message.answer(_history_text(analyses))


@router.message(Command("tema"))
async def theme(message: Message) -> None:
    await message.answer(f"📝 Tema da semana:\n\n{weekly_theme()}\n\nEnvie sua redação quando estiver pronta.")


async def _set_reminders(telegram_id: int, enabled: bool) -> bool:
    async with SessionFactory.begin() as session:
        user = await UserRepository(session).get_by_telegram_id(telegram_id)
        if not user:
            return False
        user.reminders_enabled = enabled
    return True


@router.callback_query(F.data.in_({"reminders:on", "reminders:off"}))
async def reminder_callback(callback: CallbackQuery) -> None:
    enabled = callback.data == "reminders:on"
    saved = await _set_reminders(callback.from_user.id, enabled)
    await callback.answer("Preferência salva" if saved else "Use /start primeiro", show_alert=not saved)
    if saved and callback.message:
        status = "ativados" if enabled else "desativados"
        await callback.message.answer(f"🔔 Lembretes {status}.")


@router.message(Command("lembretes"))
async def reminders(message: Message) -> None:
    from app.bot.keyboards import reminders_keyboard

    await message.answer("Deseja receber um aviso quando seu crédito FREE estiver disponível?", reply_markup=reminders_keyboard())
