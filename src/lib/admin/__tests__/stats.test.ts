import { describe, expect, it } from "vitest";
import { estimateCallCostUsd } from "../pricing";
import {
  type AiCallStat,
  aggregateAiWindow,
  buildDailySeries,
  buildDashboardAlerts,
  checkAdminDemotion,
  findHouseholdsNearLimit,
  MS_PER_DAY,
} from "../stats";

const NOW = new Date("2026-10-19T12:00:00.000Z").getTime();

function call(overrides: Partial<AiCallStat> = {}): AiCallStat {
  return {
    created: new Date(NOW - 3_600_000).toISOString(),
    model: "openai/gpt-4o-mini",
    status: "ok",
    kind: "evaluate",
    prompt_tokens: 1000,
    completion_tokens: 500,
    latency_ms: 800,
    ...overrides,
  };
}

describe("estimateCallCostUsd", () => {
  it("liczy koszt wg tabeli cen modelu", () => {
    expect(estimateCallCostUsd("openai/gpt-4o-mini", 1_000_000, 1_000_000)).toBeCloseTo(0.75, 5);
  });

  it("używa ceny domyślnej dla nieznanego modelu, a 0 dla fallbacku deterministycznego", () => {
    expect(estimateCallCostUsd("x/unknown", 1_000_000, 0)).toBeCloseTo(1, 5);
    expect(estimateCallCostUsd("deterministic-fallback", 5000, 5000)).toBe(0);
    expect(estimateCallCostUsd(undefined, 5000, 5000)).toBe(0);
  });
});

describe("aggregateAiWindow", () => {
  it("pomija sandbox i wpisy spoza okna, liczy błędy i średni czas", () => {
    const stats = aggregateAiWindow(
      [
        call(),
        call({ status: "error", latency_ms: 1200 }),
        call({ status: "invalid_json" }),
        call({ kind: "sandbox" }),
        call({ created: new Date(NOW - 2 * MS_PER_DAY).toISOString() }),
      ],
      NOW,
      MS_PER_DAY,
    );
    expect(stats.calls).toBe(3);
    expect(stats.errors).toBe(1);
    expect(stats.invalidJson).toBe(1);
    expect(stats.errorRate).toBeCloseTo(2 / 3, 5);
    expect(stats.avgLatencyMs).toBe(933);
  });

  it("zwraca zera dla pustej listy", () => {
    expect(aggregateAiWindow([], NOW, MS_PER_DAY)).toMatchObject({ calls: 0, errorRate: 0 });
  });
});

describe("buildDailySeries", () => {
  it("zwraca ciągłą serię od najstarszego dnia i grupuje wywołania", () => {
    const series = buildDailySeries([call(), call(), call({ kind: "sandbox" })], NOW, 3);
    expect(series.map((p) => p.date)).toEqual(["2026-10-17", "2026-10-18", "2026-10-19"]);
    expect(series[2]?.calls).toBe(2);
    expect(series[0]?.calls).toBe(0);
  });
});

describe("alerty pulpitu", () => {
  const healthy = aggregateAiWindow([], NOW, MS_PER_DAY);

  it("zgłasza brak konta serwisowego i klucza OpenRouter (krytyczny pierwszy)", () => {
    const alerts = buildDashboardAlerts({
      hasOpenRouterKey: false,
      hasServiceAccount: false,
      stats24h: healthy,
      householdsNearLimit: [],
    });
    expect(alerts.map((a) => a.code)).toEqual(["NO_SERVICE_ACCOUNT", "NO_OPENROUTER_KEY"]);
  });

  it("zgłasza wysoki odsetek błędów dopiero od minimalnej liczby wywołań", () => {
    const few = aggregateAiWindow([call({ status: "error" })], NOW, MS_PER_DAY);
    const many = aggregateAiWindow(
      Array.from({ length: 6 }, () => call({ status: "error" })),
      NOW,
      MS_PER_DAY,
    );
    const base = { hasOpenRouterKey: true, hasServiceAccount: true, householdsNearLimit: [] };
    expect(buildDashboardAlerts({ ...base, stats24h: few })).toHaveLength(0);
    expect(buildDashboardAlerts({ ...base, stats24h: many }).map((a) => a.code)).toContain(
      "AI_ERROR_RATE",
    );
  });

  it("wykrywa gospodarstwa przy 80% limitu i ignoruje limit 0", () => {
    const near = findHouseholdsNearLimit([
      { name: "A", used: 16, limit: 20 },
      { name: "B", used: 5, limit: 20 },
      { name: "C", used: 3, limit: 0 },
    ]);
    expect(near.map((h) => h.name)).toEqual(["A"]);
  });
});

describe("checkAdminDemotion", () => {
  const base = {
    actorId: "a1",
    targetId: "u2",
    targetIsAdmin: true,
    adminCount: 2,
    nextIsAdmin: false,
  };

  it("pozwala odebrać admina innemu, gdy zostaje więcej niż jeden", () => {
    expect(checkAdminDemotion(base)).toBeNull();
  });

  it("blokuje odebranie uprawnień sobie samemu", () => {
    expect(checkAdminDemotion({ ...base, targetId: "a1" })).toContain("samemu sobie");
  });

  it("blokuje odebranie uprawnień ostatniemu adminowi", () => {
    expect(checkAdminDemotion({ ...base, adminCount: 1 })).toContain("ostatniemu");
  });

  it("nie blokuje nadawania admina ani zmian na nie-adminie", () => {
    expect(checkAdminDemotion({ ...base, targetIsAdmin: false, nextIsAdmin: true })).toBeNull();
    expect(checkAdminDemotion({ ...base, targetIsAdmin: false })).toBeNull();
  });
});
