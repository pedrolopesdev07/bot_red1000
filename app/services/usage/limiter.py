from dataclasses import dataclass
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import UsageDaily, User
from app.services.plans import get_plan_policy


@dataclass(frozen=True)
class UsageLimit:
    plan: str
    daily_limit: int
    used: int
    unlimited: bool = False
    next_reset_at: datetime | None = None

    @property
    def remaining(self) -> int:
        return max(0, self.daily_limit - self.used)

    @property
    def remaining_label(self) -> str:
        return "∞" if self.unlimited else str(self.remaining)

    @property
    def daily_limit_label(self) -> str:
        return "∞" if self.unlimited else str(self.daily_limit)

    def next_reset_label(self, now: datetime | None = None) -> str | None:
        if self.unlimited or self.remaining or not self.next_reset_at:
            return None
        current = now or datetime.now(timezone.utc)
        available_at = self.next_reset_at
        if available_at.tzinfo is None:
            available_at = available_at.replace(tzinfo=timezone.utc)
        seconds = max(0, int((available_at - current).total_seconds()))
        if seconds == 0:
            return "disponível agora"
        hours, remainder = divmod(seconds, 3600)
        minutes = (remainder + 59) // 60
        if minutes == 60:
            hours, minutes = hours + 1, 0
        return f"em {hours}h {minutes:02d}min" if hours else f"em {minutes}min"


class UsageLimiter:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def status(self, user: User, day: date | None = None) -> UsageLimit:
        day = day or date.today()
        effective_plan = user.plan.name
        policy = get_plan_policy(effective_plan)
        used = await self.session.scalar(
            select(UsageDaily.analyses_count).where(
                UsageDaily.user_id == user.id, UsageDaily.date == day
            )
        )
        return UsageLimit(
            effective_plan,
            policy.daily_analyses,
            used or 0,
            unlimited=policy.unlimited,
            next_reset_at=None,
        )

    async def consume(self, user: User, day: date | None = None) -> UsageLimit | None:
        """Atomically reserves one daily analysis slot. Caller owns the transaction."""
        day = day or date.today()
        policy = get_plan_policy(user.plan.name)
        table = UsageDaily.__table__
        statement = pg_insert(table).values(user_id=user.id, date=day, analyses_count=1)
        statement = statement.on_conflict_do_update(
            index_elements=[table.c.user_id, table.c.date],
            set_={"analyses_count": table.c.analyses_count + 1, "updated_at": func.now()},
            where=table.c.analyses_count < policy.daily_analyses,
        ).returning(table.c.analyses_count)
        used = await self.session.scalar(statement)
        if used is None:
            return None
        return UsageLimit(user.plan.name, policy.daily_analyses, used, unlimited=policy.unlimited)
