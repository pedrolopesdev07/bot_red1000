import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import Analysis, AnalysisStatus
from app.schemas.gemini import EnemEvaluation


class AnalysisRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, user_id: int) -> Analysis:
        analysis = Analysis(user_id=user_id, status=AnalysisStatus.WAITING_CONFIRMATION)
        self.session.add(analysis)
        await self.session.flush()
        return analysis

    async def create_queued(
        self, user_id: int, essay: str, idempotency_key: str,
        *, detailed_feedback: bool, evaluation_engine: str,
        topic_id: int | None = None, custom_topic: str | None = None,
    ) -> Analysis:
        analysis = Analysis(
            user_id=user_id,
            status=AnalysisStatus.QUEUED,
            original_text=essay,
            confirmed_text=essay,
            idempotency_key=idempotency_key,
            detailed_feedback=detailed_feedback,
            evaluation_engine=evaluation_engine,
            topic_id=topic_id,
            custom_topic=custom_topic,
        )
        self.session.add(analysis)
        await self.session.flush()
        return analysis

    async def get_by_idempotency(self, user_id: int, key: str) -> Analysis | None:
        return await self.session.scalar(
            select(Analysis).where(
                Analysis.user_id == user_id, Analysis.idempotency_key == key
            )
        )

    async def list_for_user(
        self, user_id: int, page: int, page_size: int
    ) -> tuple[list[Analysis], int]:
        where = Analysis.user_id == user_id
        total = await self.session.scalar(select(func.count()).select_from(Analysis).where(where))
        result = await self.session.scalars(
            select(Analysis)
            .where(where)
            .order_by(Analysis.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(result), int(total or 0)

    async def delete_owned(self, analysis_id: uuid.UUID, user_id: int) -> bool:
        result = await self.session.execute(
            delete(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == user_id)
        )
        return bool(result.rowcount)

    async def get_owned(self, analysis_id: uuid.UUID, user_id: int) -> Analysis | None:
        return await self.session.scalar(
            select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == user_id)
        )

    async def list_completed(self, user_id: int, limit: int = 10) -> list[Analysis]:
        result = await self.session.scalars(
            select(Analysis)
            .where(Analysis.user_id == user_id, Analysis.status == AnalysisStatus.COMPLETED)
            .order_by(Analysis.completed_at.desc())
            .limit(limit)
        )
        return list(result)

    async def set_text(self, analysis: Analysis, text: str) -> None:
        analysis.original_text = text
        analysis.status = AnalysisStatus.WAITING_CONFIRMATION

    async def complete(self, analysis: Analysis, result: EnemEvaluation) -> None:
        analysis.competency_1_score = result.competencia_1.score
        analysis.competency_2_score = result.competencia_2.score
        analysis.competency_3_score = result.competencia_3.score
        analysis.competency_4_score = result.competencia_4.score
        analysis.competency_5_score = result.competencia_5.score
        analysis.total_score = result.total_score
        analysis.confidence = result.confidence
        analysis.summary = result.summary
        analysis.strengths = result.strengths
        analysis.weaknesses = result.weaknesses
        analysis.improvements = result.improvements
        analysis.warnings = result.warnings
        analysis.raw_ai_response = result.model_dump()
        analysis.status = AnalysisStatus.COMPLETED
        analysis.completed_at = datetime.now(timezone.utc)
