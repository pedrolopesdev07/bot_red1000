import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class MessageResponse(BaseModel):
    message: str


class CredentialsRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=128)
    mfa_code: str | None = Field(default=None, pattern=r"^\d{6}$")

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.strip().casefold()


class RegistrationRequest(CredentialsRequest):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().casefold()


class UserResponse(BaseModel):
    id: int
    created_at: datetime
    username: str | None
    email: str | None
    role: str
    plan: str
    reminders_enabled: bool
    csrf_token: str


class AnalysisCreate(BaseModel):
    text: str = Field(min_length=100, max_length=30_000)
    topic_id: int | None = None
    custom_topic: str | None = Field(default=None, min_length=5, max_length=500)


class AnalysisQueued(BaseModel):
    id: uuid.UUID
    status: str


class AnalysisSummary(BaseModel):
    id: uuid.UUID
    status: str
    created_at: datetime
    completed_at: datetime | None
    total_score: int | None
    summary: str | None


class PaginatedAnalyses(BaseModel):
    items: list[AnalysisSummary]
    page: int
    page_size: int
    total: int


class AnalysisInsights(BaseModel):
    completed_count: int
    score_delta: int
    weakest_competency: int | None


class AnalysisDetail(AnalysisSummary):
    text: str | None
    competency_scores: list[int | None]
    feedback: dict | None
    detailed_feedback: bool = False
    topic: str | None = None


class UsageResponse(BaseModel):
    plan: str
    limit: int | str
    used: int
    remaining: int | str
    next_reset_at: datetime | None


class PlanResponse(BaseModel):
    name: str
    daily_limit: int
    price_cents: int
    detailed_feedback: bool
    unlimited: bool = False
    gemini_daily_limit: int | None = None
    points_multiplier: int = 1
    position_bonus: int = 0


class SimulationProfileResponse(BaseModel):
    notice: str
    plan: str
    simulated_position: int
    simulated_points: int
    position_boost: int
    top3_until: datetime | None
    cycle_started_at: datetime
    disclaimer_acknowledged: bool


class SimulationAction(BaseModel):
    action: Literal["acknowledge", "premium", "ultra_premium", "boost_100", "boost_250", "boost_500", "boost_700", "top3_24h"]


class ThemeResponse(BaseModel):
    theme: str


class RandomThemeResponse(ThemeResponse):
    id: int | None = None
    category: str


class AccountUpdate(BaseModel):
    reminders_enabled: bool | None = None


class AdminUserSummary(BaseModel):
    id: int
    email: str | None
    role: str
    plan: str
    is_active: bool
    created_at: datetime


class AdminAnalysisSummary(AnalysisSummary):
    user_id: int


class DemoControlsResponse(BaseModel):
    plan: str
    used: int
    remaining: int | str
    next_reset_at: datetime | None


class DemoControlsUpdate(BaseModel):
    plan: Literal["FREE", "PREMIUM", "ULTRA_PREMIUM"] | None = None
    used: int | None = Field(default=None, ge=0, le=10_000)
    renewal_minutes: int | None = Field(default=None, ge=0, le=43_200)
    reset_usage: bool = False
