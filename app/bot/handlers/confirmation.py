import logging
import uuid

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from app.bot.handlers.result import split_telegram_message
from app.bot.keyboards import premium_upgrade_keyboard
from app.bot.presenters import render_evaluation
from app.bot.states import EssayFlow
from app.core.config import get_settings
from app.database.database import SessionFactory
from app.database.models import AnalysisStatus
from app.database.repositories.analyses import AnalysisRepository
from app.database.repositories.users import UserRepository
from app.services.gemini.client import GeminiClient, GeminiError
from app.services.gemini.evaluator import GeminiEvaluator
from app.services.usage import UsageLimiter

logger = logging.getLogger(__name__)
router = Router(name="confirmation")


def _callback_uuid(data: str | None) -> uuid.UUID | None:
    try:
        return uuid.UUID((data or "").split(":", 1)[1])
    except (ValueError, IndexError):
        return None


@router.callback_query(F.data.startswith("edit:"))
async def edit_text(callback: CallbackQuery, state: FSMContext) -> None:
    analysis_id = _callback_uuid(callback.data)
    if not analysis_id or not callback.from_user:
        await callback.answer("Solicitação inválida.", show_alert=True)
        return
    async with SessionFactory.begin() as session:
        user = await UserRepository(session).get_by_telegram_id(callback.from_user.id)
        analysis = await AnalysisRepository(session).get_owned(analysis_id, user.id) if user else None
        if not analysis or analysis.status != AnalysisStatus.WAITING_CONFIRMATION:
            await callback.answer("Análise indisponível.", show_alert=True)
            return
        analysis.status = AnalysisStatus.EDITING_TEXT
    await state.set_state(EssayFlow.EDITING_TEXT)
    await state.set_data({"analysis_id": str(analysis_id)})
    await callback.message.answer("Envie agora o texto completo corrigido.")
    await callback.answer()


@router.callback_query(F.data.startswith("confirm:"))
async def confirm_text(callback: CallbackQuery, state: FSMContext) -> None:
    analysis_id = _callback_uuid(callback.data)
    if not analysis_id or not callback.from_user:
        await callback.answer("Solicitação inválida.", show_alert=True)
        return
    async with SessionFactory.begin() as session:
        users = UserRepository(session)
        user = await users.get_by_telegram_id(callback.from_user.id)
        analysis = await AnalysisRepository(session).get_owned(analysis_id, user.id) if user else None
        if not analysis or analysis.status != AnalysisStatus.WAITING_CONFIRMATION:
            await callback.answer("Análise indisponível.", show_alert=True)
            return
        usage = await UsageLimiter(session).consume(user)
        if not usage:
            current = await UsageLimiter(session).status(user)
            if current.plan == "FREE":
                limit_message = (
                    "Você atingiu o limite do plano FREE. Uma nova correção "
                    f"será liberada {current.next_credit_label() or 'em até 24 horas'}.\n"
                )
                upgrade_markup = premium_upgrade_keyboard(analysis_id)
            else:
                limit_message = "Você atingiu o limite de análises do seu plano hoje.\n"
                upgrade_markup = None
            await callback.message.answer(
                limit_message
                + f"Plano: {current.plan} | Limite: {current.daily_limit_label} | "
                f"Utilizadas: {current.used} | Restantes: {current.remaining_label}",
                reply_markup=upgrade_markup,
            )
            await callback.answer()
            return
        analysis.confirmed_text = analysis.original_text
        analysis.status = AnalysisStatus.PROCESSING_ANALYSIS
        essay = analysis.confirmed_text or ""
    await state.set_state(EssayFlow.PROCESSING_ANALYSIS)
    await callback.message.answer("Analisando sua redação. Isso pode levar alguns instantes…")
    await callback.answer()
    settings = get_settings()
    try:
        evaluator = GeminiEvaluator(
            GeminiClient(settings.gemini_api_key, settings.gemini_model, settings.gemini_timeout_seconds)
        )
        result = await evaluator.evaluate(essay)
        async with SessionFactory.begin() as session:
            user = await UserRepository(session).get_by_telegram_id(callback.from_user.id)
            analysis = await AnalysisRepository(session).get_owned(analysis_id, user.id) if user else None
            if not analysis or analysis.status != AnalysisStatus.PROCESSING_ANALYSIS:
                raise RuntimeError("Analysis ownership/status changed during processing")
            await AnalysisRepository(session).complete(analysis, result)
            current_usage = await UsageLimiter(session).status(user)
            rendered = render_evaluation(
                result,
                current_usage.plan,
                current_usage.remaining_label,
                analysis_id,
                current_usage.daily_limit_label,
            )
        await state.set_state(EssayFlow.COMPLETED)
        chunks = split_telegram_message(rendered.text)
        for index, chunk in enumerate(chunks):
            markup = rendered.reply_markup if index == len(chunks) - 1 else None
            await callback.message.answer(chunk, reply_markup=markup)
    except Exception:
        logger.exception("Evaluation failed", extra={"analysis_id": str(analysis_id)})
        async with SessionFactory.begin() as session:
            user = await UserRepository(session).get_by_telegram_id(callback.from_user.id)
            analysis = await AnalysisRepository(session).get_owned(analysis_id, user.id) if user else None
            if analysis and analysis.status == AnalysisStatus.PROCESSING_ANALYSIS:
                analysis.status = AnalysisStatus.FAILED
        await state.clear()
        await callback.message.answer(
            "Não foi possível concluir a análise agora. O erro foi registrado; tente novamente mais tarde."
        )


@router.callback_query(F.data.startswith("cancel:"))
async def cancel_callback(callback: CallbackQuery, state: FSMContext) -> None:
    await _cancel(callback.from_user.id, state, callback.message)
    await callback.answer()


@router.message(Command("cancelar"))
async def cancel_command(message: Message, state: FSMContext) -> None:
    if message.from_user:
        await _cancel(message.from_user.id, state, message)


async def _cancel(telegram_id: int, state: FSMContext, message: Message) -> None:
    data = await state.get_data()
    try:
        analysis_id = uuid.UUID(data["analysis_id"])
    except (KeyError, ValueError):
        await state.clear()
        await message.answer("Fluxo cancelado.")
        return
    async with SessionFactory.begin() as session:
        user = await UserRepository(session).get_by_telegram_id(telegram_id)
        analysis = await AnalysisRepository(session).get_owned(analysis_id, user.id) if user else None
        if analysis and analysis.status not in {AnalysisStatus.COMPLETED, AnalysisStatus.PROCESSING_ANALYSIS}:
            analysis.status = AnalysisStatus.CANCELLED
    await state.clear()
    await message.answer("Fluxo cancelado. Nenhuma análise foi consumida.")
