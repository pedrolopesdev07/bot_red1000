from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import Plan


class PlanRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_name(self, name: str) -> Plan | None:
        return await self.session.scalar(select(Plan).where(Plan.name == name, Plan.active.is_(True)))
