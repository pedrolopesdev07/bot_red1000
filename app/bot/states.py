from aiogram.fsm.state import State, StatesGroup


class EssayFlow(StatesGroup):
    IDLE = State()
    WAITING_CONFIRMATION = State()
    EDITING_TEXT = State()
    PROCESSING_ANALYSIS = State()
    COMPLETED = State()
