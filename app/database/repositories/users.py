from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import Plan, UsageDaily, User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_email(self, email: str) -> User | None:
        return await self.session.scalar(select(User).where(User.email == email.casefold()))

    async def get_or_create_by_email(self, email: str) -> User:
        normalized = email.strip().casefold()
        user = await self.get_by_email(normalized)
        if user:
            return user
        free = await self.session.scalar(select(Plan).where(Plan.name == "FREE", Plan.active.is_(True)))
        if not free:
            raise RuntimeError("FREE plan is missing; run migrations")
        user = User(email=normalized, plan_id=free.id, plan=free)
        self.session.add(user)
        await self.session.flush()
        return user

    async def due_credit_reminders(self) -> list[User]:
        last_usage = (
            select(func.max(UsageDaily.updated_at))
            .where(UsageDaily.user_id == User.id)
            .correlate(User)
            .scalar_subquery()
        )
        result = await self.session.scalars(
            select(User)
            .where(
                User.is_active.is_(True),
                User.reminders_enabled.is_(True),
                User.plan.has(name="FREE"),
                last_usage <= func.now() - text("interval '24 hours'"),
                or_(User.last_reminder_at.is_(None), User.last_reminder_at < last_usage),
            )
        )
        return list(result.unique())
