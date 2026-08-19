from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import UsageDaily


class UsageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, user_id: int, day: date) -> UsageDaily | None:
        return await self.session.scalar(
            select(UsageDaily).where(UsageDaily.user_id == user_id, UsageDaily.date == day)
        )
