import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.v1.schemas import AnalysisCreate, AnalysisSummary
from app.core.web_security import require_admin
from app.database.models import User, UserRole
from app.main import app


def test_analysis_payload_enforces_essay_length() -> None:
    with pytest.raises(ValidationError):
        AnalysisCreate(text="curta")


def test_analysis_list_contract_never_contains_full_text() -> None:
    assert "text" not in AnalysisSummary.model_json_schema()["properties"]


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
