from pathlib import Path


def test_plan_migration_explicitly_preserves_existing_users() -> None:
    migration = (
        Path(__file__).parents[1] / "migrations" / "versions" / "0002_free_premium_plans.py"
    ).read_text(encoding="utf-8")

    assert "'BASIC'" in migration and "'FREE'" in migration
    assert "'PRO'" in migration and "'VIP'" in migration and "'PREMIUM'" in migration
    assert migration.index("UPDATE users") < migration.index("DELETE FROM plans")


def test_new_users_are_assigned_to_free_plan() -> None:
    repository = (
        Path(__file__).parents[1] / "app" / "database" / "repositories" / "users.py"
    ).read_text(encoding="utf-8")
    assert 'Plan.name == "FREE"' in repository
    assert 'Plan.name == "BASIC"' not in repository
