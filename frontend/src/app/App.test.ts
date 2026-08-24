import { describe, expect, it } from "vitest";

import { dailyRanking, displayIdentity } from "./App";

describe("frontend domain helpers", () => {
  it("formats a real account identity without exposing the email as the name", () => {
    const identity = displayIdentity({
      id: 1,
      created_at: "2026-01-01T00:00:00Z",
      username: null,
      email: "maria.silva@example.com",
      role: "USER",
      plan: "FREE",
      bonus_credits: 0,
      reminders_enabled: false,
      csrf_token: "token",
      subscription_status: "inactive",
    });

    expect(identity).toEqual({ name: "Maria Silva", email: "maria.silva@example.com", initials: "MS" });
  });

  it("counts only completed essays from the current ranking cycle", () => {
    const ranking = dailyRanking([
      { id: "current", status: "COMPLETED", created_at: "2026-01-03T00:00:00Z", completed_at: "2026-01-03T00:01:00Z", total_score: 1000, summary: null },
      { id: "old", status: "COMPLETED", created_at: "2025-12-20T00:00:00Z", completed_at: "2025-12-20T00:01:00Z", total_score: 1000, summary: null },
      { id: "queued", status: "QUEUED", created_at: "2026-01-03T00:00:00Z", completed_at: null, total_score: null, summary: null },
    ], "2026-01-01T00:00:00Z", Date.parse("2026-01-05T00:00:00Z"));

    expect(ranking.user.essays).toBe(1);
    expect(ranking.activeDays).toBe(1);
  });
});
