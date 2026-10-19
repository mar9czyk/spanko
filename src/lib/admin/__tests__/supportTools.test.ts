import { describe, expect, it } from "vitest";
import { extractStoredContext } from "@/app/api/admin/ai-calls/[id]/replay/route";
import { buildBackupName } from "@/app/api/admin/system/backup/route";
import { DEFAULT_SLEEP_MATRIX } from "@/lib/sleep-engine";
import type { AiCallRecord } from "@/lib/types/database";
import { isFeatureEnabled } from "../../featureFlags";
import { compareMatrices } from "../matrixPreview";
import { checkStuckSleepFix, MAX_SLEEP_DURATION_MS, STUCK_SLEEP_MIN_AGE_MS } from "../sleepFix";

const NOW = new Date("2026-10-19T12:00:00.000Z").getTime();
const iso = (ms: number) => new Date(ms).toISOString();

describe("checkStuckSleepFix", () => {
  const base = {
    status: "sleeping",
    startIso: iso(NOW - 3 * STUCK_SLEEP_MIN_AGE_MS),
    wokeUpAtIso: iso(NOW - 3 * STUCK_SLEEP_MIN_AGE_MS + 10 * 3_600_000),
    nowMs: NOW,
  };

  it("pozwala naprawić zawieszony sen z poprawną pobudką", () => {
    expect(checkStuckSleepFix(base)).toBeNull();
  });

  it("odrzuca zakończone i zbyt świeże sny", () => {
    expect(checkStuckSleepFix({ ...base, status: "completed" })).toContain("zakończony");
    expect(
      checkStuckSleepFix({ ...base, startIso: iso(NOW - 3_600_000), wokeUpAtIso: iso(NOW) }),
    ).toContain("krócej niż 24 h");
  });

  it("odrzuca pobudkę przed początkiem, z przyszłości i dłuższą niż 24 h", () => {
    const start = NOW - 3 * STUCK_SLEEP_MIN_AGE_MS;
    expect(checkStuckSleepFix({ ...base, wokeUpAtIso: iso(start - 1000) })).toContain(
      "po rozpoczęciu",
    );
    expect(checkStuckSleepFix({ ...base, wokeUpAtIso: iso(NOW + 60_000) })).toContain(
      "z przyszłości",
    );
    expect(
      checkStuckSleepFix({ ...base, wokeUpAtIso: iso(start + MAX_SLEEP_DURATION_MS + 1) }),
    ).toContain("dłużej niż 24 h");
  });

  it("odrzuca brak czasu rozpoczęcia i niepoprawną datę pobudki", () => {
    expect(checkStuckSleepFix({ ...base, startIso: undefined })).toContain("czasu rozpoczęcia");
    expect(checkStuckSleepFix({ ...base, wokeUpAtIso: "nie-data" })).toContain("Niepoprawny");
  });
});

describe("compareMatrices", () => {
  it("dla identycznych matryc zwraca zerowe różnice", () => {
    const rows = compareMatrices(DEFAULT_SLEEP_MATRIX, DEFAULT_SLEEP_MATRIX);
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.firstWindowDeltaMin).toBe(0);
      expect(row.bedtimeDeltaMin).toBe(0);
    }
  });

  it("wydłużenie okna porannego w przedziale 6 mies. przesuwa SweetSpot o tyle samo minut", () => {
    const changed = DEFAULT_SLEEP_MATRIX.map((bracket) =>
      bracket.minAgeDays <= 180 && bracket.maxAgeDays >= 180
        ? { ...bracket, wwMinMorning: bracket.wwMinMorning + 20 }
        : bracket,
    );
    const rows = compareMatrices(DEFAULT_SLEEP_MATRIX, changed);
    const sixMonths = rows.find((row) => row.label === "6 mies.");
    expect(sixMonths?.firstWindowDeltaMin).toBe(20);
    expect(rows.find((row) => row.label === "10 tyg.")?.firstWindowDeltaMin).toBe(0);
  });
});

describe("isFeatureEnabled", () => {
  it("wyłączona lub brakująca flaga nigdy nie włącza funkcji", () => {
    expect(isFeatureEnabled(undefined, "h1")).toBe(false);
    expect(isFeatureEnabled(null)).toBe(false);
    expect(isFeatureEnabled({ key: "x", enabled: false }, "h1")).toBe(false);
  });

  it("włączona flaga bez rolloutu działa dla wszystkich", () => {
    expect(isFeatureEnabled({ key: "x", enabled: true }, "h1")).toBe(true);
    expect(isFeatureEnabled({ key: "x", enabled: true, rollout_household_ids: [] })).toBe(true);
  });

  it("rollout ogranicza funkcję do wskazanych gospodarstw", () => {
    const flag = { key: "x", enabled: true, rollout_household_ids: ["h1", "h2"] };
    expect(isFeatureEnabled(flag, "h1")).toBe(true);
    expect(isFeatureEnabled(flag, "h3")).toBe(false);
    expect(isFeatureEnabled(flag)).toBe(false);
  });

  it("niepoprawna lista rolloutu jest traktowana jak brak listy", () => {
    expect(isFeatureEnabled({ key: "x", enabled: true, rollout_household_ids: "h1" }, "h9")).toBe(
      true,
    );
    expect(
      isFeatureEnabled({ key: "x", enabled: true, rollout_household_ids: [1, null] }, "h9"),
    ).toBe(true);
  });
});

describe("buildBackupName", () => {
  it("buduje nazwę z datą UTC", () => {
    expect(buildBackupName(new Date("2026-10-19T08:05:09.000Z"))).toBe(
      "spanko-20261019-080509.zip",
    );
  });
});

describe("extractStoredContext", () => {
  const call = (snapshot: Record<string, unknown> | undefined) =>
    ({ id: "c1", kind: "evaluate", status: "ok", request_snapshot_json: snapshot }) as AiCallRecord;

  it("zwraca kontekst zapisany w zrzucie żądania", () => {
    const context = { triggeredDiagnostics: [], activeInsights: [] };
    expect(extractStoredContext(call({ context }))).toEqual(context);
  });

  it("zwraca null dla starych wywołań bez pełnego kontekstu", () => {
    expect(extractStoredContext(call({ metricsSnapshot: {} }))).toBeNull();
    expect(extractStoredContext(call(undefined))).toBeNull();
    expect(extractStoredContext(call({ context: { triggeredDiagnostics: "x" } }))).toBeNull();
  });
});
