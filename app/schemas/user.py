from pydantic import BaseModel


class TelegramUserInput(BaseModel):
    telegram_id: int
    username: str | None = None
    first_name: str | None = None
