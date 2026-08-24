from datetime import datetime, timedelta, timezone

from arq import cron
from sqlalchemy import delete, select

from app.core.config import get_settings
from app.core.queue import redis_settings
from app.database.database import SessionFactory
from app.database.models import Analysis
from app.database.models import AnalysisStatus
from app.core.queue import get_queue
from app.database.repositories.users import UserRepository
from app.services.email import send_daily_limit_reminder


async def purge_expired_analyses(_: dict) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=get_settings().data_retention_days)
    async with SessionFactory.begin() as db:
        await db.execute(delete(Analysis).where(Analysis.created_at < cutoff))


async def send_due_daily_limit_reminders(_: dict) -> None:
    async with SessionFactory.begin() as db:
        users = await UserRepository(db).due_daily_limit_reminders()
        for user in users:
            if user.email and await send_daily_limit_reminder(user.email):
                user.last_reminder_at = datetime.now(timezone.utc)


async def recover_stale_analyses(_: dict) -> None:
    queued_ids = []
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    async with SessionFactory.begin() as db:
        rows = await db.scalars(
            select(Analysis).where(
                Analysis.status.in_([AnalysisStatus.QUEUED, AnalysisStatus.PROCESSING_ANALYSIS]),
                Analysis.created_at < cutoff,
            ).limit(100)
        )
        for analysis in rows:
            analysis.status = AnalysisStatus.QUEUED
            queued_ids.append(analysis.id)
    queue = await get_queue()
    for analysis_id in queued_ids:
        await queue.enqueue_job("process_analysis", str(analysis_id), _job_id=f"recovery:{analysis_id}:{int(datetime.now().timestamp()) // 600}")


class WorkerSettings:
    functions = [purge_expired_analyses, send_due_daily_limit_reminders, recover_stale_analyses]
    cron_jobs = [
        cron(purge_expired_analyses, hour=3, minute=15),
        cron(send_due_daily_limit_reminders, minute={0, 15, 30, 45}),
        cron(recover_stale_analyses, minute={5, 15, 25, 35, 45, 55}),
    ]
    redis_settings = redis_settings()
    queue_name = "arq:scheduler"
    max_jobs = 1
