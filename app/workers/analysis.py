import uuid
from sqlalchemy import select

from app.core.config import get_settings
from app.core.queue import ANALYSIS_QUEUE_NAME, redis_settings
from app.database.database import SessionFactory
from app.database.models import Analysis, AnalysisStatus, EssayTopic
from app.database.repositories.analyses import AnalysisRepository
from app.services.gemini.client import GeminiClient
from app.services.gemini.evaluator import GeminiEvaluator
from app.services.enem.local_evaluator import evaluate_locally


async def process_analysis(_: dict, analysis_id: str) -> None:
    identifier = uuid.UUID(analysis_id)
    async with SessionFactory.begin() as db:
        analysis = await db.get(Analysis, identifier)
        if not analysis or analysis.status is not AnalysisStatus.QUEUED:
            return
        analysis.status = AnalysisStatus.PROCESSING_ANALYSIS
        essay = analysis.confirmed_text or ""
        topic = analysis.custom_topic
        if analysis.topic_id:
            topic = await db.scalar(select(EssayTopic.title).where(EssayTopic.id == analysis.topic_id))
    settings = get_settings()
    try:
        if analysis.evaluation_engine == "LOCAL":
            result = evaluate_locally(essay)
        else:
            evaluator = GeminiEvaluator(GeminiClient(settings.gemini_api_key, settings.gemini_model, settings.gemini_timeout_seconds))
            result = await evaluator.evaluate(essay, topic)
        async with SessionFactory.begin() as db:
            analysis = await db.get(Analysis, identifier)
            if analysis and analysis.status is AnalysisStatus.PROCESSING_ANALYSIS:
                await AnalysisRepository(db).complete(analysis, result)
    except Exception:
        async with SessionFactory.begin() as db:
            analysis = await db.get(Analysis, identifier)
            if analysis and analysis.status is AnalysisStatus.PROCESSING_ANALYSIS:
                analysis.status = AnalysisStatus.FAILED
        raise


class WorkerSettings:
    functions = [process_analysis]
    redis_settings = redis_settings()
    queue_name = ANALYSIS_QUEUE_NAME
    max_jobs = 4
    job_timeout = 180
