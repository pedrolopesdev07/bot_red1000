import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function mockApi(page: Page) {
  await page.route("http://localhost:8000/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const payloads: Record<string, unknown> = {
      "/api/v1/me": { id: 1, created_at: "2026-01-01T00:00:00Z", username: "estudante", email: "estudante@example.com", role: "USER", plan: "FREE", bonus_credits: 150, reminders_enabled: false, csrf_token: "csrf", subscription_status: "inactive" },
      "/api/v1/usage": { plan: "FREE", limit: 1, used: 0, remaining: 1, next_credit_at: null, bonus_credits: 150 },
      "/api/v1/analyses": { items: [], total: 0 },
      "/api/v1/plans": [],
      "/api/v1/theme": { theme: "Desafios da educação no Brasil" },
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payloads[path] ?? {}) });
  });
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Escreva sua redação" })).toBeVisible();
});

test("dashboard has no serious automated accessibility violations", async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(({ impact }) => impact === "serious" || impact === "critical");
  expect(serious).toEqual([]);
});

test("layout does not overflow its viewport", async ({ page }) => {
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});
