import uuid

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from app.bot.keyboards import confirmation_keyboard
from app.bot.states import EssayFlow
from app.core.config import get_settings
from app.database.database import SessionFactory
from app.database.models import AnalysisStatus
from app.database.repositories.analyses import AnalysisRepository
from app.database.repositories.users import UserRepository

router = Router(name="text_editing")


@router.message(EssayFlow.EDITING_TEXT, F.text)
async def receive_edited_text(message: Message, state: FSMContext) -> None:
    if not message.from_user or not message.text:
        return
    settings = get_settings()
    text = message.text.strip()
    if len(text) < settings.min_essay_length:
        await message.answer(f"O texto é muito curto. Envie ao menos {settings.min_essay_length} caracteres.")
        return
    if len(text) > settings.max_essay_length:
        await message.answer(f"O texto excede o limite de {settings.max_essay_length} caracteres.")
        return
    data = await state.get_data()
    try:
        analysis_id = uuid.UUID(data["analysis_id"])
    except (KeyError, ValueError):
        await state.clear()
        await message.answer("Sessão inválida. Use /start e envie a redação novamente.")
        return
    async with SessionFactory.begin() as session:
        user = await UserRepository(session).get_by_telegram_id(message.from_user.id)
        analysis = await AnalysisRepository(session).get_owned(analysis_id, user.id) if user else None
        if not analysis or analysis.status != AnalysisStatus.EDITING_TEXT:
            await message.answer("Esta análise não está disponível para edição.")
            return
        await AnalysisRepository(session).set_text(analysis, text)
    await state.set_state(EssayFlow.WAITING_CONFIRMATION)
    preview = text if len(text) <= 3500 else text[:3500] + "…"
    await message.answer(
        "📝 Recebi o texto corrigido. Confira novamente antes de confirmar.\n\n"
        f"Texto:\n{preview}", reply_markup=confirmation_keyboard(analysis_id)
    )
