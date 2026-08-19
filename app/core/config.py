from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    telegram_bot_token: str = ""
    gemini_api_key: str = ""
    database_url: str = "postgresql+asyncpg://redacao:redacao_dev@localhost:5432/redacao_db"
    secret_key: str = ""
    log_level: str = "INFO"
    gemini_model: str = "gemini-2.5-flash-lite"
    gemini_timeout_seconds: float = Field(default=60, gt=0, le=180)
    min_essay_length: int = Field(default=100, ge=1)
    max_essay_length: int = Field(default=30_000, ge=100)
    premium_daily_limit: int = Field(default=10, ge=1)
    test_unlock_code: str = ""
    test_admin_telegram_id: int | None = None
    premium_checkout_url: str = ""
    ultra_premium_checkout_url: str = ""
    credits_checkout_url: str = ""
    credits_150_checkout_url: str = ""
    credits_270_checkout_url: str = ""
    credits_750_checkout_url: str = ""
    credits_1050_checkout_url: str = ""
    reminder_poll_seconds: int = Field(default=900, ge=60)
    environment: str = "development"
    frontend_url: str = "http://localhost:3000"
    allowed_origins: str = "http://localhost:3000"
    redis_url: str = "redis://localhost:6379/0"
    session_cookie_name: str = "reda1000_session"
    session_ttl_seconds: int = Field(default=43_200, ge=300)
    magic_link_ttl_seconds: int = Field(default=900, ge=60, le=3600)
    cookie_secure: bool = False
    dev_auth_bypass: bool = False
    auth_disabled: bool = True
    demo_user_email: str = "demo@reda1000.local"
    resend_api_key: str = ""
    email_from: str = "Reda1000IA <noreply@example.com>"
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_premium_price_id: str = ""
    stripe_ultra_premium_price_id: str = ""
    stripe_credits_price_id: str = ""
    data_retention_days: int = Field(default=365, ge=1)
    database_pool_size: int = Field(default=10, ge=1, le=100)
    enable_telegram_bot: bool = False

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.casefold() == "production"

    @field_validator("test_admin_telegram_id", mode="before")
    @classmethod
    def empty_admin_id_is_none(cls, value: object) -> object:
        return None if value == "" else value

@lru_cache
def get_settings() -> Settings:
    return Settings()
