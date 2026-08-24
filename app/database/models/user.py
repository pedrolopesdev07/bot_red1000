from datetime import datetime

import enum

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.models.base import Base, TimestampMixin


class UserRole(str, enum.Enum):
    USER = "USER"
    SUPPORT = "SUPPORT"
    ADMIN = "ADMIN"


class User(TimestampMixin, Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str | None] = mapped_column(String(320), unique=True, index=True)
    username: Mapped[str | None] = mapped_column(String(255))
    password_hash: Mapped[str | None] = mapped_column(String(255))
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id"), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    last_reminder_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.USER, server_default="USER")
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    bonus_credits: Mapped[int] = mapped_column(Integer, default=150, server_default="150")
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    subscription_status: Mapped[str] = mapped_column(String(30), default="inactive", server_default="inactive")
    plan = relationship("Plan", back_populates="users", lazy="joined")
    analyses = relationship("Analysis", back_populates="user")
