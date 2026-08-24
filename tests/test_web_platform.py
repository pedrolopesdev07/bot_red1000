import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.v1.schemas import AnalysisCreate, AnalysisSummary, CredentialsRequest
from app.core.passwords import hash_password, verify_password
from app.core.config import Settings
from app.core.web_security import require_admin
from app.database.models import User, UserRole
from app.main import app


def test_analysis_payload_enforces_essay_length() -> None:
    with pytest.raises(ValidationError):
        AnalysisCreate(text="curta")


def test_analysis_list_contract_never_contains_full_text() -> None:
    assert "text" not in AnalysisSummary.model_json_schema()["properties"]


def test_passwords_are_salted_and_verifiable() -> None:
    first = hash_password("senha-segura-123")
    second = hash_password("senha-segura-123")
    assert first != second
    assert verify_password("senha-segura-123", first)
    assert not verify_password("senha-incorreta", first)


def test_credentials_normalize_username() -> None:
    credentials = CredentialsRequest(username="Aluno.Teste", password="senha-segura-123")
    assert credentials.username == "aluno.teste"


async def test_admin_requires_role_and_mfa() -> None:
    user = User(role=UserRole.ADMIN, mfa_enabled=False)
    with pytest.raises(HTTPException) as error:
        await require_admin(user)
    assert error.value.status_code == 403


def test_api_exposes_versioned_routes_and_security_headers() -> None:
    paths = app.openapi()["paths"]
    assert "/api/v1/analyses" in paths
    assert "/api/v1/webhooks/payment-provider" in paths
    with TestClient(app) as client:
        response = client.get("/openapi.json")
    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["cross-origin-opener-policy"] == "same-origin"


def test_production_rejects_insecure_configuration() -> None:
    with pytest.raises(ValidationError):
        Settings(environment="production", auth_disabled=True, cookie_secure=False)


def test_production_accepts_secure_configuration() -> None:
    settings = Settings(
        environment="production", auth_disabled=False, cookie_secure=True,
        secret_key="x" * 32, allowed_origins="https://reda1000.example",
    )
    assert settings.is_production


def test_cors_accepts_only_this_projects_vercel_previews() -> None:
    settings = Settings(
        allowed_origins="https://bot-red1000.vercel.app",
        allowed_origin_regex=(
            r"^https://bot-red1000(?:-[a-z0-9-]+)?-lopes-projects-09b60071\.vercel\.app$"
        ),
    )
    assert settings.is_cors_origin_allowed("https://bot-red1000.vercel.app")
    assert settings.is_cors_origin_allowed(
        "https://bot-red1000-fdxernnl7-lopes-projects-09b60071.vercel.app"
    )
    assert not settings.is_cors_origin_allowed("https://bot-red1000-attacker.vercel.app")
    assert not settings.is_cors_origin_allowed("https://evil.example")


def test_cors_regex_must_be_https_and_anchored() -> None:
    with pytest.raises(ValidationError):
        Settings(allowed_origin_regex=r".*\.vercel\.app")


def test_vercel_preview_preflight_returns_cors_headers() -> None:
    origin = "https://bot-red1000-fdxernnl7-lopes-projects-09b60071.vercel.app"
    with TestClient(app) as client:
        response = client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-credentials"] == "true"
