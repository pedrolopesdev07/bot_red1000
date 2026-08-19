import secrets

from app.services.plans import PlanName


class TestAccessRegistry:
    """Process-local unlimited access intended only for development and manual testing."""

    __test__ = False

    def __init__(self) -> None:
        self._authorized_ids: set[int] = set()
        self._selected_plans: dict[int, PlanName] = {}
        self._unlimited_ids: set[int] = set()

    def authorize(
        self,
        telegram_id: int,
        supplied_code: str,
        expected_code: str,
        allowed_telegram_id: int | None = None,
    ) -> bool:
        if not expected_code or not secrets.compare_digest(supplied_code, expected_code):
            return False
        if allowed_telegram_id is not None and telegram_id != allowed_telegram_id:
            return False
        self._authorized_ids.add(telegram_id)
        self._selected_plans.pop(telegram_id, None)
        self._unlimited_ids.discard(telegram_id)
        return True

    def select_plan(self, telegram_id: int, plan: str) -> bool:
        if telegram_id not in self._authorized_ids:
            return False
        try:
            self._selected_plans[telegram_id] = PlanName(plan)
        except ValueError:
            return False
        self._unlimited_ids.add(telegram_id)
        return True

    def selected_plan(self, telegram_id: int) -> PlanName | None:
        return self._selected_plans.get(telegram_id)

    def is_unlimited(self, telegram_id: int) -> bool:
        return telegram_id in self._unlimited_ids

    def is_authorized(self, telegram_id: int) -> bool:
        return telegram_id in self._authorized_ids

    def enable_unlimited(self, telegram_id: int) -> bool:
        if telegram_id not in self._authorized_ids or telegram_id not in self._selected_plans:
            return False
        self._unlimited_ids.add(telegram_id)
        return True

    def disable_unlimited(self, telegram_id: int) -> bool:
        if telegram_id not in self._authorized_ids:
            return False
        self._unlimited_ids.discard(telegram_id)
        return True

    def revoke(self, telegram_id: int) -> bool:
        """Remove the admin authorization and its selected unlimited plan."""
        was_active = telegram_id in self._authorized_ids or telegram_id in self._selected_plans
        self._authorized_ids.discard(telegram_id)
        self._selected_plans.pop(telegram_id, None)
        self._unlimited_ids.discard(telegram_id)
        return was_active


test_access_registry = TestAccessRegistry()
