import { describe, expect, it } from "vitest";
import { aggregateUsageByUser, buildUserDailySeries, type UsageCall } from "../usage";

const NOW = new Date("2026-10-22T12:00:00Z").getTime();
const DAY = 86_400_000;
const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

const users = [
  { id: "u1", email: "a@x.pl", household_id: "h1", last_seen_at: at(0) },
  { id: "u2", email: "b@x.pl", household_id: "h1" },
];

const call = (over: Partial<UsageCall>): UsageCall => ({
  created: at(1),
  kind: "evaluate",
  status: "ok",
  model: "google/gemini-2.5-flash",
  prompt_tokens: 1000,
  completion_tokens: 500,
  ...over,
});

describe("aggregateUsageByUser", () => {
  it("liczy wywołania, błędy, tokeny i koszt per użytkownik, sortując po koszcie", () => {
    const report = aggregateUsageByUser(
      [
        call({ user_id: "u1", cost_usd: 0.5 }),
        call({ user_id: "u1", status: "error", cost_usd: 0.25, kind: "goal_coach" }),
        call({ user_id: "u2", cost_usd: 1 }),
      ],
      [],
      users,
      NOW,
      7,
    );
    expect(report.rows.map((r) => r.userId)).toEqual(["u2", "u1"]);
    const u1 = report.rows[1];
    expect(u1).toMatchObject({ calls: 2, errors: 1, promptTokens: 2000, completionTokens: 1000 });
    expect(u1?.costUsd).toBe(0.75);
    expect(u1?.byKind.goal_coach).toEqual({ calls: 1, costUsd: 0.25 });
    expect(report.totals).toEqual({ calls: 3, tokens: 4500, costUsd: 1.75 });
  });

  it("koszt: cost_usd z OpenRouter ma pierwszeństwo, brak → szacunek z tabeli cen", () => {
    const report = aggregateUsageByUser(
      [call({ user_id: "u1", cost_usd: 0 }), call({ user_id: "u2" })],
      [],
      users,
      NOW,
      7,
    );
    const byId = Object.fromEntries(report.rows.map((r) => [r.userId, r.costUsd]));
    expect(byId.u1).toBe(0);
    expect(byId.u2).toBe(0.0016);
  });

  it("pomija sandbox i wywołania poza oknem czasowym", () => {
    const report = aggregateUsageByUser(
      [
        call({ user_id: "u1", kind: "sandbox" }),
        call({ user_id: "u1", created: at(10) }),
        call({ user_id: "u1", created: at(3) }),
      ],
      [],
      users,
      NOW,
      7,
    );
    expect(report.totals.calls).toBe(1);
    expect(
      aggregateUsageByUser([call({ user_id: "u1", created: at(10) })], [], users, NOW, 30).totals
        .calls,
    ).toBe(1);
  });

  it("wywołania bez user_id trafiają do wiersza gospodarstwa sprzed telemetrii", () => {
    const report = aggregateUsageByUser(
      [call({ household_id: "h1" }), call({ household_id: "h1" }), call({ household_id: "h2" })],
      [],
      users,
      NOW,
      7,
    );
    expect(report.rows).toHaveLength(2);
    expect(report.rows.every((r) => r.userId === null && r.email === null)).toBe(true);
    expect(report.rows.find((r) => r.householdId === "h1")?.calls).toBe(2);
  });

  it("wpisy snu i dni aktywne: różne dni z wpisem lub wywołaniem, wpisy bez autora ignorowane", () => {
    const report = aggregateUsageByUser(
      [call({ user_id: "u1", created: at(1) })],
      [
        { created: at(1), created_by: "u1" },
        { created: at(2), created_by: "u1" },
        { created: at(2), created_by: "u1" },
        { created: at(3) },
        { created: at(20), created_by: "u1" },
      ],
      users,
      NOW,
      7,
    );
    const u1 = report.rows.find((r) => r.userId === "u1");
    expect(u1).toMatchObject({ sleepLogs: 3, activeDays: 2, calls: 1 });
    expect(u1?.lastSeenAt).toBe(at(0));
  });

  it("buildUserDailySeries: dzienne punkty od najstarszego, bez sandbox", () => {
    const series = buildUserDailySeries(
      [
        call({ user_id: "u1", cost_usd: 0.2, created: at(1) }),
        call({ kind: "sandbox", created: at(1) }),
      ],
      [{ created: at(0), created_by: "u1" }],
      NOW,
      3,
    );
    expect(series).toHaveLength(3);
    expect(series[1]).toMatchObject({ calls: 1, costUsd: 0.2, sleepLogs: 0 });
    expect(series[2]).toMatchObject({ calls: 0, sleepLogs: 1 });
  });
});
