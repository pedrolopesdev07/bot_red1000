import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.models.base import Base


class AnalysisStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    PROCESSING_ANALYSIS = "PROCESSING_ANALYSIS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class Analysis(Base):
    __tablename__ = "analyses"
    __table_args__ = (UniqueConstraint("user_id", "idempotency_key", name="uq_analysis_user_idempotency"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[AnalysisStatus] = mapped_column(Enum(AnalysisStatus), index=True)
    original_text: Mapped[str | None] = mapped_column(Text)
    confirmed_text: Mapped[str | None] = mapped_column(Text)
    competency_1_score: Mapped[int | None] = mapped_column(Integer)
    competency_2_score: Mapped[int | None] = mapped_column(Integer)
    competency_3_score: Mapped[int | None] = mapped_column(Integer)
    competency_4_score: Mapped[int | None] = mapped_column(Integer)
    competency_5_score: Mapped[int | None] = mapped_column(Integer)
    total_score: Mapped[int | None] = mapped_column(Integer)
    confidence: Mapped[str | None] = mapped_column(String(20))
    summary: Mapped[str | None] = mapped_column(Text)
    strengths: Mapped[list | None] = mapped_column(JSON)
    weaknesses: Mapped[list | None] = mapped_column(JSON)
    improvements: Mapped[list | None] = mapped_column(JSON)
    warnings: Mapped[list | None] = mapped_column(JSON)
    raw_ai_response: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    idempotency_key: Mapped[str | None] = mapped_column(String(64))
    detailed_feedback: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    evaluation_engine: Mapped[str] = mapped_column(String(20), default="GEMINI", server_default="GEMINI")
    topic_id: Mapped[int | None] = mapped_column(ForeignKey("essay_topics.id"), index=True)
    custom_topic: Mapped[str | None] = mapped_column(String(500))
    user = relationship("User", back_populates="analyses")
