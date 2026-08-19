import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class MessageResponse(BaseModel):
    message: str


class MagicLinkRequest(BaseModel):
    email: EmailStr


class MagicLinkVerify(BaseModel):
    token: str = Field(min_length=20, max_length=2000)


class MagicLinkResponse(MessageResponse):
    debug_url: str | None = None


class UserResponse(BaseModel):
    id: int
    email: str | None
    role: str
    plan: str
    bonus_credits: int
    reminders_enabled: bool
    csrf_token: str
    subscription_status: str = "inactive"


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
    next_credit_at: datetime | None
    bonus_credits: int


class PlanResponse(BaseModel):
    name: str
    daily_limit: int
    price_cents: int
    detailed_feedback: bool
    unlimited: bool = False
    gemini_daily_limit: int | None = None


class ThemeResponse(BaseModel):
    theme: str


class RandomThemeResponse(ThemeResponse):
    id: int | None = None
    category: str


class CheckoutRequest(BaseModel):
    product: Literal["premium", "ultra_premium", "credits"]
    credit_amount: Literal[150, 270, 750, 1050] | None = None


class CheckoutResponse(BaseModel):
    url: str


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
    bonus_credits: int
    used: int
    remaining: int | str
    next_credit_at: datetime | None


class DemoControlsUpdate(BaseModel):
    plan: Literal["FREE", "PREMIUM", "ULTRA_PREMIUM"] | None = None
    bonus_credits: int | None = Field(default=None, ge=0, le=100_000)
    used: int | None = Field(default=None, ge=0, le=10_000)
    renewal_minutes: int | None = Field(default=None, ge=0, le=43_200)
    reset_usage: bool = False


class CreditTransactionResponse(BaseModel):
    id: uuid.UUID
    amount: int
    balance_after: int
    reason: str
    description: str
    analysis_id: uuid.UUID | None
    payment_id: uuid.UUID | None
    created_at: datetime


class CreditLedgerResponse(BaseModel):
    items: list[CreditTransactionResponse]
    page: int
    page_size: int
    total: int
