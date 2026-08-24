from functools import lru_cache

from pydantic import Field, field_validator, model_validator
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
    cakto_webhook_secret: str = ""
    cakto_premium_product_ids: str = ""
    cakto_ultra_premium_product_ids: str = ""
    cakto_credits_150_product_ids: str = ""
    cakto_credits_270_product_ids: str = ""
    cakto_credits_750_product_ids: str = ""
    cakto_credits_1050_product_ids: str = ""
    reminder_poll_seconds: int = Field(default=900, ge=60)
    environment: str = "development"
    frontend_url: str = "http://localhost:3000"
    allowed_origins: str = "http://localhost:3000"
    redis_url: str = "redis://127.0.0.1:6379/0"
    session_cookie_name: str = "reda1000_session"
    session_ttl_seconds: int = Field(default=43_200, ge=300)
    magic_link_ttl_seconds: int = Field(default=900, ge=60, le=3600)
    cookie_secure: bool = False
    cookie_samesite: str = "none"
    dev_auth_bypass: bool = False
    auth_disabled: bool = False
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
    admin_allowed_ips: str = ""
    admin_totp_secret: str = ""
    max_request_body_bytes: int = Field(default=65_536, ge=1_024, le=1_048_576)
    global_rate_limit: int = Field(default=300, ge=10, le=10_000)
    login_lockout_attempts: int = Field(default=5, ge=3, le=20)
    login_lockout_seconds: int = Field(default=900, ge=60, le=86_400)

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.casefold() == "production"

    @property
    def session_same_site(self) -> str:
        if not self.cookie_secure:
            return "lax"
        return self.cookie_samesite.casefold()

    @property
    def admin_ip_allowlist(self) -> set[str]:
        return {ip.strip() for ip in self.admin_allowed_ips.split(",") if ip.strip()}

    def cakto_product_ids(self, value: str) -> set[str]:
        return {item.strip() for item in value.split(",") if item.strip()}

    @field_validator("test_admin_telegram_id", mode="before")
    @classmethod
    def empty_admin_id_is_none(cls, value: object) -> object:
        return None if value == "" else value

    @field_validator("cookie_samesite")
    @classmethod
    def valid_cookie_samesite(cls, value: str) -> str:
        normalized = value.casefold().strip()
        if normalized not in {"lax", "strict", "none"}:
            raise ValueError("COOKIE_SAMESITE deve ser lax, strict ou none")
        return normalized

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.is_production:
            if self.auth_disabled:
                raise ValueError("AUTH_DISABLED deve ser false em produção")
            if not self.cookie_secure:
                raise ValueError("COOKIE_SECURE deve ser true em produção")
            if len(self.secret_key) < 32:
                raise ValueError("SECRET_KEY deve ter ao menos 32 caracteres em produção")
            if any(origin.startswith("http://") for origin in self.cors_origins):
                raise ValueError("ALLOWED_ORIGINS deve usar HTTPS em produção")
        return self

@lru_cache
def get_settings() -> Settings:
    return Settings()
