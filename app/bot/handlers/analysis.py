from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from app.bot.keyboards import confirmation_keyboard
from app.bot.states import EssayFlow
from app.core.config import get_settings
from app.database.database import SessionFactory
from app.database.repositories.analyses import AnalysisRepository
from app.database.repositories.users import UserRepository

router = Router(name="analysis")


@router.message(EssayFlow.IDLE, F.text & ~F.text.startswith("/"))
@router.message(EssayFlow.COMPLETED, F.text & ~F.text.startswith("/"))
async def receive_essay(message: Message, state: FSMContext) -> None:
    if not message.from_user or not message.text:
        return
    settings = get_settings()
    text = message.text.strip()
    if len(text) < settings.min_essay_length:
        await message.answer(
            f"O texto é muito curto. Envie a redação completa com ao menos "
            f"{settings.min_essay_length} caracteres."
        )
        return
    if len(text) > settings.max_essay_length:
        await message.answer(f"O texto excede o limite de {settings.max_essay_length} caracteres.")
        return
    async with SessionFactory.begin() as session:
        user = await UserRepository(session).get_or_create(
            message.from_user.id, message.from_user.username, message.from_user.first_name
        )
        repository = AnalysisRepository(session)
        analysis = await repository.create(user.id)
        await repository.set_text(analysis, text)
    await state.set_state(EssayFlow.WAITING_CONFIRMATION)
    await state.set_data({"analysis_id": str(analysis.id)})
    preview = text if len(text) <= 3500 else text[:3500] + "…"
    await message.answer(
        "📝 Recebi sua redação. Confira o texto antes de confirmar.\n\n"
        f"Texto:\n{preview}",
        reply_markup=confirmation_keyboard(analysis.id),
    )


@router.message(F.photo)
async def reject_photo(message: Message) -> None:
    await message.answer(
        "Este bot não recebe mais fotos. Digite ou cole aqui o texto completo da redação."
    )
