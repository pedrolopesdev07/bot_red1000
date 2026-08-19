import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.v1.schemas import AnalysisCreate, AnalysisDetail, AnalysisInsights, AnalysisQueued, AnalysisSummary, MessageResponse, PaginatedAnalyses
from app.core.queue import get_queue
from app.core.web_security import get_current_user, rate_limit, require_csrf
from app.database.database import SessionFactory, get_session
from app.database.models import Analysis, CreditTransaction, EssayTopic, User
from app.database.repositories.analyses import AnalysisRepository
from app.services.usage import UsageLimiter
from app.services.plans import get_plan_policy

router = APIRouter(prefix="/analyses", tags=["analyses"])


def _summary(item: Analysis) -> AnalysisSummary:
    return AnalysisSummary(
        id=item.id, status=item.status.value, created_at=item.created_at,
        completed_at=item.completed_at, total_score=item.total_score,
        summary=(item.summary[:240] if item.summary else None),
    )


@router.post(
    "", response_model=AnalysisQueued, status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_csrf), Depends(rate_limit("analysis", 10, 3600))],
)
async def create_analysis(
    payload: AnalysisCreate,
    user: User = Depends(get_current_user),
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=16, max_length=64),
) -> AnalysisQueued:
    async with SessionFactory.begin() as db:
        repository = AnalysisRepository(db)
        existing = await repository.get_by_idempotency(user.id, idempotency_key)
        if existing:
            analysis_id, analysis_status = existing.id, existing.status.value
        else:
            current_user = await db.get(User, user.id)
            topic = None
            if payload.topic_id is not None:
                topic = await db.scalar(select(EssayTopic).where(EssayTopic.id == payload.topic_id, EssayTopic.active.is_(True)))
                if not topic:
                    raise HTTPException(status.HTTP_404_NOT_FOUND, "Tema não encontrado")
            if payload.topic_id is None and not payload.custom_topic:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Informe ou selecione o tema da redação")
            policy = get_plan_policy(current_user.plan.name)
            usage = await UsageLimiter(db).consume(current_user)
            paid_with_credits = False
            if usage is None:
                if current_user.bonus_credits < 150:
                    raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "Crédito indisponível")
                paid_with_credits = True
            detailed_feedback = policy.detailed_feedback or paid_with_credits
            evaluation_engine = "LOCAL" if policy.gemini_daily_limit and usage and usage.used > policy.gemini_daily_limit else "GEMINI"
            analysis = await repository.create_queued(
                user.id, payload.text, idempotency_key,
                detailed_feedback=detailed_feedback, evaluation_engine=evaluation_engine,
                topic_id=topic.id if topic else None, custom_topic=payload.custom_topic,
            )
            if paid_with_credits:
                current_user.bonus_credits -= 150
                db.add(CreditTransaction(
                    user_id=user.id, amount=-150, balance_after=current_user.bonus_credits,
                    reason="ANALYSIS_PURCHASE", description="Correção Premium avulsa",
                    analysis_id=analysis.id,
                ))
            analysis_id, analysis_status = analysis.id, analysis.status.value
    if analysis_status == "QUEUED":
        queue = await get_queue()
        await queue.enqueue_job("process_analysis", str(analysis_id), _job_id=f"analysis:{analysis_id}")
    return AnalysisQueued(id=analysis_id, status=analysis_status)


@router.get("", response_model=PaginatedAnalyses)
async def list_analyses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> PaginatedAnalyses:
    items, total = await AnalysisRepository(db).list_for_user(user.id, page, page_size)
    return PaginatedAnalyses(items=[_summary(item) for item in items], page=page, page_size=page_size, total=total)


@router.get("/insights", response_model=AnalysisInsights)
async def analysis_insights(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> AnalysisInsights:
    items = await AnalysisRepository(db).list_completed(user.id, limit=100)
    if not items:
        return AnalysisInsights(completed_count=0, score_delta=0, weakest_competency=None)
    latest, oldest = items[0], items[-1]
    weakest = min(range(1, 6), key=lambda number: getattr(latest, f"competency_{number}_score") or 0)
    return AnalysisInsights(
        completed_count=len(items), score_delta=(latest.total_score or 0) - (oldest.total_score or 0),
        weakest_competency=weakest,
    )


@router.get("/{analysis_id}", response_model=AnalysisDetail)
async def analysis_detail(
    analysis_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> AnalysisDetail:
    item = await AnalysisRepository(db).get_owned(analysis_id, user.id)
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Redação não encontrada")
    summary = _summary(item)
    topic_title = item.custom_topic
    if item.topic_id:
        topic_title = await db.scalar(select(EssayTopic.title).where(EssayTopic.id == item.topic_id))
    return AnalysisDetail(
        **summary.model_dump(), text=item.confirmed_text,
        competency_scores=[getattr(item, f"competency_{n}_score") for n in range(1, 6)],
        feedback=item.raw_ai_response if item.detailed_feedback else None,
        detailed_feedback=item.detailed_feedback,
        topic=topic_title,
    )


@router.delete("/{analysis_id}", response_model=MessageResponse, dependencies=[Depends(require_csrf)])
async def delete_analysis(
    analysis_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> MessageResponse:
    deleted = await AnalysisRepository(db).delete_owned(analysis_id, user.id)
    if not deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Redação não encontrada")
    await db.commit()
    return MessageResponse(message="Redação excluída")
