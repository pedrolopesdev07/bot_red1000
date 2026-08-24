import json
import os
import uuid

import pytest
from arq import create_pool
from arq.worker import Worker
from sqlalchemy import delete, select, text

from app.api.v1.analyses import create_analysis
from app.api.v1.billing import stripe_webhook
from app.api.v1.schemas import AnalysisCreate
from app.core.queue import ANALYSIS_QUEUE_NAME, close_queue, redis_settings
from app.database.database import SessionFactory
from app.database.models import (
    Analysis, AnalysisStatus, CreditTransaction, Payment, PaymentStatus, Plan,
    UsageDaily, User,
)
from app.services.usage import UsageLimiter
from app.services.enem.local_evaluator import evaluate_locally
from app.workers.analysis import process_analysis


pytestmark = [
    pytest.mark.infrastructure,
    pytest.mark.asyncio(loop_scope="module"),
    pytest.mark.skipif(
        os.getenv("RUN_INFRASTRUCTURE_TESTS") != "1",
        reason="set RUN_INFRASTRUCTURE_TESTS=1 with dedicated PostgreSQL and Redis services",
    ),
]


async def _create_user(plan_name: str = "FREE") -> User:
    async with SessionFactory.begin() as db:
        plan = await db.scalar(select(Plan).where(Plan.name == plan_name))
        assert plan is not None, "run alembic upgrade head before infrastructure tests"
        user = User(email=f"infra-{uuid.uuid4()}@example.com", plan_id=plan.id, plan=plan)
        db.add(user)
        await db.flush()
        return user


async def _delete_user(user_id: int) -> None:
    async with SessionFactory.begin() as db:
        await db.execute(delete(CreditTransaction).where(CreditTransaction.user_id == user_id))
        await db.execute(delete(Analysis).where(Analysis.user_id == user_id))
        await db.execute(delete(UsageDaily).where(UsageDaily.user_id == user_id))
        await db.execute(delete(Payment).where(Payment.user_id == user_id))
        await db.execute(delete(User).where(User.id == user_id))


async def test_postgresql_migrations_and_concurrent_free_reservation() -> None:
    async with SessionFactory() as db:
        revision = await db.scalar(text("select version_num from alembic_version"))
    assert revision == "0009_welcome_credits"

    user = await _create_user()
    try:
        async def reserve():
            async with SessionFactory.begin() as db:
                loaded = await db.get(User, user.id)
                return await UsageLimiter(db).consume(loaded)

        first, second = await __import__("asyncio").gather(reserve(), reserve())
        assert sum(result is not None for result in (first, second)) == 1
    finally:
        await _delete_user(user.id)


async def test_redis_arq_processes_analysis_from_queue_to_result(monkeypatch) -> None:
    user = await _create_user("PREMIUM")
    pool = await create_pool(redis_settings(), default_queue_name=ANALYSIS_QUEUE_NAME)
    essay = "A educação transforma a sociedade. Além disso, políticas públicas são necessárias. " * 8

    async def local_provider(_self, text_value: str, _topic: str | None = None):
        return evaluate_locally(text_value)

    monkeypatch.setattr("app.workers.analysis.GeminiEvaluator.evaluate", local_provider)
    try:
        queued = await create_analysis(
            AnalysisCreate(text=essay, custom_topic="Desafios da educação brasileira"),
            user,
            uuid.uuid4().hex,
        )
        analysis_id = queued.id
        worker = Worker(
            functions=[process_analysis], redis_pool=pool, queue_name=ANALYSIS_QUEUE_NAME,
            burst=True, handle_signals=False, poll_delay=0.05,
        )
        await worker.async_run()

        async with SessionFactory() as db:
            completed = await db.get(Analysis, analysis_id)
            assert completed.status is AnalysisStatus.COMPLETED
            assert completed.total_score is not None
            assert completed.raw_ai_response
    finally:
        await close_queue()
        await pool.aclose()
        await _delete_user(user.id)


async def test_stripe_webhook_is_idempotent(monkeypatch) -> None:
    user = await _create_user()
    payment_id = uuid.uuid4()
    session_id = f"cs_{uuid.uuid4().hex}"
    event = {
        "id": f"evt_{uuid.uuid4().hex}",
        "type": "checkout.session.completed",
        "data": {"object": {"id": session_id, "payment_intent": "pi_test", "customer": "cus_test"}},
    }
    try:
        async with SessionFactory.begin() as db:
            db.add(Payment(
                id=payment_id, user_id=user.id, provider_session_id=session_id,
                product="credits:150", amount_cents=999, status=PaymentStatus.PENDING,
            ))

        monkeypatch.setattr("app.api.v1.billing.stripe.Webhook.construct_event", lambda *_: event)

        async def receive():
            return {"type": "http.request", "body": json.dumps(event).encode(), "more_body": False}

        from starlette.requests import Request
        request = Request({"type": "http", "method": "POST", "path": "/webhooks/payment-provider", "headers": []}, receive)
        first = await stripe_webhook(request, "test-signature")
        second = await stripe_webhook(request, "test-signature")

        async with SessionFactory() as db:
            updated = await db.get(User, user.id)
            assert updated.bonus_credits == 300
        assert first.message == "Evento processado"
        assert second.message == "Evento já processado"
    finally:
        await _delete_user(user.id)
