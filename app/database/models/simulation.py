from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.models.base import Base


class CompetitionSimulationProfile(Base):
    __tablename__ = "competition_simulation_profiles"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    simulated_position: Mapped[int] = mapped_column(Integer, default=17_500)
    simulated_points: Mapped[int] = mapped_column(Integer, default=0)
    position_boost: Mapped[int] = mapped_column(Integer, default=0)
    top3_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cycle_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    disclaimer_acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SimulationEvent(Base):
    __tablename__ = "simulation_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    event_type: Mapped[str] = mapped_column(String(40))
    simulated_price_cents: Mapped[int] = mapped_column(Integer, default=0)
    points_delta: Mapped[int] = mapped_column(Integer, default=0)
    positions_delta: Mapped[int] = mapped_column(Integer, default=0)
    event_metadata: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
