from aiogram import F, Router
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message
from sqlalchemy import delete, func, text

from app.database.database import SessionFactory
from app.database.models import UsageDaily
from app.database.repositories.users import UserRepository
from app.bot.keyboards import admin_mode_keyboard, purchase_keyboard, test_plan_keyboard
from app.core.config import get_settings
from app.services.usage import UsageLimiter
from app.services.test_access import test_access_registry

router = Router(name="subscription")


@router.message(F.text.casefold() == "modoadmin")
async def admin_mode_menu(message: Message) -> None:
    if not message.from_user:
        return
    if not test_access_registry.is_authorized(message.from_user.id):
        await message.answer("O modo admin não está ativo para o seu usuário.")
        return
    plan = test_access_registry.selected_plan(message.from_user.id)
    infinite_status = "ON" if test_access_registry.is_unlimited(message.from_user.id) else "OFF"
    await message.answer(
        f"🧪 Modo admin ativo | Plano: {plan.value if plan else 'não definido'} | "
        f"Infinito: {infinite_status}",
        reply_markup=admin_mode_keyboard(),
    )


@router.message(F.text.casefold() == "infinitoon")
async def infinite_on_command(message: Message) -> None:
    if not message.from_user:
        return
    if test_access_registry.enable_unlimited(message.from_user.id):
        await message.answer("♾️ Modo infinito ativado. As correções estão sem limite.")
    else:
        await message.answer("Ative o modo admin e escolha um plano primeiro.")


@router.message(F.text.casefold() == "infinitooff")
async def infinite_off_command(message: Message) -> None:
    if not message.from_user:
        return
    if test_access_registry.disable_unlimited(message.from_user.id):
        await message.answer("⏹️ Modo infinito desativado. Os limites voltaram a valer.")
    else:
        await message.answer("O modo admin não está ativo para o seu usuário.")


async def _reset_free_corrections(telegram_id: int) -> bool:
    if not test_access_registry.is_authorized(telegram_id):
        return False
    async with SessionFactory.begin() as session:
        user = await UserRepository(session).get_by_telegram_id(telegram_id)
        if not user:
            return False
        await session.execute(
            delete(UsageDaily).where(
                UsageDaily.user_id == user.id,
                UsageDaily.updated_at >= func.now() - text("interval '24 hours'"),
            )
        )
    return True


@router.message(F.text.casefold() == "resetarcorrecoes")
async def reset_corrections_command(message: Message) -> None:
    if not message.from_user:
        return
    if await _reset_free_corrections(message.from_user.id):
        await message.answer("🔄 Limite de correções FREE resetado.")
    else:
        await message.answer("O modo admin não está ativo para o seu usuário.")


@router.callback_query(F.data == "admin_mode:change_plan")
async def change_admin_plan(callback: CallbackQuery) -> None:
    if not test_access_registry.is_authorized(callback.from_user.id):
        await callback.answer("O modo admin não está ativo.", show_alert=True)
        return
    await callback.answer()
    if callback.message:
        await callback.message.edit_text(
            "Escolha o plano que deseja testar:",
            reply_markup=test_plan_keyboard(),
        )


@router.callback_query(F.data == "admin_mode:infinite_on")
async def infinite_on_callback(callback: CallbackQuery) -> None:
    if not test_access_registry.enable_unlimited(callback.from_user.id):
        await callback.answer("Escolha um plano no modo admin primeiro.", show_alert=True)
        return
    await callback.answer("Modo infinito ativado")
    if callback.message:
        await callback.message.answer("♾️ As correções agora estão sem limite.")


@router.callback_query(F.data == "admin_mode:infinite_off")
async def infinite_off_callback(callback: CallbackQuery) -> None:
    if not test_access_registry.disable_unlimited(callback.from_user.id):
        await callback.answer("O modo admin não está ativo.", show_alert=True)
        return
    await callback.answer("Modo infinito desativado")
    if callback.message:
        await callback.message.answer("⏹️ Os limites de correção voltaram a valer.")


@router.callback_query(F.data == "admin_mode:reset_corrections")
async def reset_corrections_callback(callback: CallbackQuery) -> None:
    if not await _reset_free_corrections(callback.from_user.id):
        await callback.answer("Não foi possível resetar o limite.", show_alert=True)
        return
    await callback.answer("Limite FREE resetado")
    if callback.message:
        await callback.message.answer("🔄 O limite de correções FREE foi resetado.")


@router.callback_query(F.data == "admin_mode:exit")
async def exit_admin_mode(callback: CallbackQuery) -> None:
    if not test_access_registry.revoke(callback.from_user.id):
        await callback.answer("O modo admin já está desativado.", show_alert=True)
        return
    await callback.answer("Modo admin desativado")
    if callback.message:
        await callback.message.edit_text(
            "🚪 Você saiu do modo admin. Os limites do seu plano voltaram a valer."
        )


@router.message(F.text == get_settings().test_unlock_code)
async def unlock_test_access(message: Message) -> None:
    if not message.from_user:
        return
    settings = get_settings()
    authorized = test_access_registry.authorize(
        message.from_user.id,
        message.text or "",
        settings.test_unlock_code,
        settings.test_admin_telegram_id,
    )
    try:
        await message.delete()
    except TelegramBadRequest:
        # Deleting user messages depends on the bot's permissions in the chat.
        pass
    if authorized:
        await message.answer(
            "🧪 Código aceito. Qual versão você quer testar sem limite?",
            reply_markup=test_plan_keyboard(),
        )
    else:
        await message.answer("Este código de teste não está autorizado para o seu usuário.")


@router.callback_query(F.data.startswith("test_plan:"))
async def select_test_plan(callback: CallbackQuery) -> None:
    plan = (callback.data or "").partition(":")[2]
    if not test_access_registry.select_plan(callback.from_user.id, plan):
        await callback.answer(
            "Envie novamente o código secreto antes de escolher o modo.", show_alert=True
        )
        return
    await callback.answer("Modo de teste ativado")
    if callback.message:
        await callback.message.edit_text(
            f"🧪 Versão {plan} ativada em modo ilimitado.\n"
            "O acesso permanecerá ativo até o bot ser reiniciado."
        )


@router.callback_query(F.data.startswith("upgrade_premium:"))
async def upgrade_premium(callback: CallbackQuery) -> None:
    await callback.answer()
    if callback.message:
        await callback.message.answer(
            "Escolha como deseja continuar:\n\n"
            "💎 Premium: correções completas, plano de ação e mais análises.\n"
            "🎟️ Pacote avulso: créditos sem assinatura.",
            reply_markup=purchase_keyboard(),
        )


@router.message(Command("premium", "comprar"))
async def purchase_options(message: Message) -> None:
    await message.answer(
        "Planos disponíveis:\n\n💎 Premium mensal\n🎟️ Pacote avulso de correções",
        reply_markup=purchase_keyboard(),
    )


@router.callback_query(F.data.startswith("purchase:"))
async def purchase(callback: CallbackQuery) -> None:
    settings = get_settings()
    product = (callback.data or "").partition(":")[2]
    url = settings.premium_checkout_url if product == "premium" else settings.credits_checkout_url
    if not url:
        await callback.answer("Checkout ainda não configurado.", show_alert=True)
        return
    await callback.answer()
    if callback.message:
        await callback.message.answer(f"Finalize sua compra com segurança:\n{url}")


@router.message(Command("plan", "status"))
async def plan_status(message: Message) -> None:
    if not message.from_user:
        return
    async with SessionFactory() as session:
        user = await UserRepository(session).get_by_telegram_id(message.from_user.id)
        if not user:
            await message.answer("Use /start para criar seu cadastro.")
            return
        usage = await UsageLimiter(session).status(user)
    await message.answer(
        f"Plano atual: {usage.plan}\nLimite por ciclo: {usage.daily_limit_label}\n"
        f"Utilizadas: {usage.used}\nRestantes: {usage.remaining_label}"
        + (f"\nPróximo crédito: {usage.next_credit_label()}." if usage.next_credit_label() else "")
    )
