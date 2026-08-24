import uuid

from app.database.models import AnalysisStatus, Plan, User


def test_new_user_can_access_assigned_plan_without_lazy_loading() -> None:
    free = Plan(id=1, name="FREE", daily_limit=1, price=0, active=True)
    user = User(email="student@example.com", plan_id=free.id, plan=free)
    assert user.plan.name == "FREE"
    assert user.plan.daily_limit == 1


def test_analysis_status_transitions_are_declared() -> None:
    expected = {"QUEUED", "PROCESSING_ANALYSIS", "COMPLETED", "FAILED", "CANCELLED"}
    assert expected <= {status.value for status in AnalysisStatus}


def test_analysis_ownership_query_requires_user_id() -> None:
    from inspect import getsource
    from app.database.repositories.analyses import AnalysisRepository
    source = getsource(AnalysisRepository.get_owned)
    assert "Analysis.user_id == user_id" in source
