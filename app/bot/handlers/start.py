from aiogram import Router
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from app.bot.states import EssayFlow
from app.database.database import SessionFactory
from app.database.repositories.users import UserRepository
from app.services.usage import UsageLimiter

router = Router(name="start")


@router.message(CommandStart())
async def start(message: Message, state: FSMContext) -> None:
    if not message.from_user:
        return
    async with SessionFactory.begin() as session:
        user = await UserRepository(session).get_or_create(
            message.from_user.id, message.from_user.username, message.from_user.first_name
        )
        usage = await UsageLimiter(session).status(user)
    await state.clear()
    await state.set_state(EssayFlow.IDLE)
    await message.answer(
        f"👋 Olá! Eu sou o Reda1000IA.\n\nDigite ou cole aqui o texto completo da sua "
        f"redação para começar.\n\nSeu plano: {usage.plan}\n"
        f"Análises disponíveis: {usage.remaining_label}/{usage.daily_limit_label}"
        + (f"\nPróximo crédito: {usage.next_credit_label()}." if usage.next_credit_label() else "")
        + f"\n\nTema da semana: use /tema\nEvolução: use /historico\nLembretes: use /lembretes"
    )


@router.message(Command("help"))
async def help_command(message: Message) -> None:
    await message.answer(
        "Digite ou cole aqui o texto completo da sua redação. "
        "Comandos: /start, /plan, /status e /cancelar. A avaliação é uma estimativa por IA."
    )
