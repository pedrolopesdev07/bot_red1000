import uuid

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup


def confirmation_keyboard(analysis_id: uuid.UUID) -> InlineKeyboardMarkup:
    value = str(analysis_id)
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Confirmar", callback_data=f"confirm:{value}"),
                InlineKeyboardButton(text="✏️ Corrigir", callback_data=f"edit:{value}"),
            ],
            [InlineKeyboardButton(text="❌ Cancelar", callback_data=f"cancel:{value}")],
        ]
    )


def premium_upgrade_keyboard(analysis_id: uuid.UUID) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🔓 DESBLOQUEAR ANÁLISE COMPLETA",
                    callback_data=f"upgrade_premium:{analysis_id}",
                )
            ]
        ]
    )


def purchase_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="💎 Assinar Premium", callback_data="purchase:premium")],
            [InlineKeyboardButton(text="🎟️ Comprar pacote de correções", callback_data="purchase:credits")],
        ]
    )


def reminders_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="🔔 Ativar", callback_data="reminders:on"), InlineKeyboardButton(text="Desativar", callback_data="reminders:off")]]
    )


def test_plan_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="🆓 Testar FREE", callback_data="test_plan:FREE"),
                InlineKeyboardButton(
                    text="💎 Testar PREMIUM", callback_data="test_plan:PREMIUM"
                ),
            ]
        ]
    )


def admin_mode_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🔄 Trocar de plano", callback_data="admin_mode:change_plan"
                )
            ],
            [
                InlineKeyboardButton(text="♾️ Infinito ON", callback_data="admin_mode:infinite_on"),
                InlineKeyboardButton(text="⏹️ Infinito OFF", callback_data="admin_mode:infinite_off"),
            ],
            [
                InlineKeyboardButton(
                    text="🔄 Resetar correções FREE",
                    callback_data="admin_mode:reset_corrections",
                )
            ],
            [
                InlineKeyboardButton(
                    text="🚪 Sair do modo admin", callback_data="admin_mode:exit"
                )
            ],
        ]
    )
