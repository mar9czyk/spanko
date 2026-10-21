import { describe, expect, it } from "vitest";
import {
  clampInsightWwOffset,
  DIAGNOSIS_CODES,
  evaluateAll7DiagnosticCategories,
  evaluateCat1SleepAssociations,
  evaluateCat2BedtimeResistance,
  evaluateCat3EarlyWakingAndSplitNight,
  getAgeBracket,
  getMinutesFromMidnightInTimeZone,
  predictNextSleepSlot,
  resolveInsightWwOffset,
  sanitizeParentOverride,
  selectLogsInDiagnosticWindow,
} from "../index";
import type { DiagnosticEvaluationInput, SleepLog } from "../types";

const NOW_ISO = "2026-07-15T12:00:00.000Z";
const DAY_MS = 86_400_000;

const BASE_NIGHT: SleepLog = {
  id: "n",
  childId: "c",
  physiologicalDate: "2026-07-14",
  type: "night",
  status: "completed",
  putDownAt: "2026-07-14T17:30:00.000Z", // 19:30 w Warszawie (CEST)
  fellAsleepAt: "2026-07-14T17:40:00.000Z",
  wokeUpAt: "2026-07-15T04:30:00.000Z", // 06:30 w Warszawie
  interventions: ["independent"],
  mood: "easy",
  nightWakings: [],
};

/**
 * Tworzy noce z kolejnych dób wstecz od BASE_NIGHT.
 *
 * @param {number} count - Liczba nocy
 * @param {Partial<SleepLog>} [patch] - Zmiany dla każdej nocy
 * @returns {SleepLog[]} Noce
 */
function nights(count: number, patch: Partial<SleepLog> = {}): SleepLog[] {
  return Array.from({ length: count }, (_, index) => {
    const base = { ...BASE_NIGHT, ...patch };
    const shift = (iso: string | undefined) =>
      iso ? new Date(new Date(iso).getTime() - index * DAY_MS).toISOString() : iso;
    return {
      ...base,
      id: `n-${index}`,
      putDownAt: shift(base.putDownAt) as string,
      fellAsleepAt: shift(base.fellAsleepAt) as string,
      wokeUpAt: shift(base.wokeUpAt),
    };
  });
}

/**
 * Buduje wejście diagnostyczne dla dziecka w Warszawie.
 *
 * @param {readonly SleepLog[]} logs - Logi snu
 * @param {number} [ageDays=240] - Wiek efektywny
 * @returns {DiagnosticEvaluationInput} Wejście silnika
 */
function input(logs: readonly SleepLog[], ageDays = 240): DiagnosticEvaluationInput {
  return {
    nowIso: NOW_ISO,
    timeZone: "Europe/Warsaw",
    child: { birthDateIso: "2025-11-01", activeDayMode: "home" },
    recentSleepLogs: logs,
    dailyTotalsLast14DaysMin: [],
    currentMetrics: {
      effectiveAgeDays: ageDays,
      chronicSleepDebtMin: 0,
      sleepBatteryPercent: 100,
      sleepNeedsProfile: "average",
      biologicalBedtimeMinFromMidnight: 1170,
    },
  };
}

const SPLIT_WAKING = {
  wokeAt: "01:30",
  estimatedDurationMin: 75,
  fedMilk: false,
  interventions: ["room_presence" as const],
};

describe("Strefa czasowa dziecka", () => {
  it("liczy minuty od północy w strefie dziecka, nie w UTC", () => {
    expect(getMinutesFromMidnightInTimeZone("2026-07-15T04:30:00.000Z", "Europe/Warsaw")).toBe(390);
    expect(getMinutesFromMidnightInTimeZone("2026-01-15T04:30:00.000Z", "Europe/Warsaw")).toBe(330);
    expect(getMinutesFromMidnightInTimeZone("2026-07-15T04:30:00.000Z", "UTC")).toBe(270);
  });

  it("CAT3: pobudka 06:30 czasu polskiego (04:30 UTC) nie jest wczesną pobudką", () => {
    const result = evaluateCat3EarlyWakingAndSplitNight(input(nights(7)));
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT3_NORMAL);
  });

  it("CAT3: pobudka 05:00 czasu polskiego przez 3 noce jest wczesną pobudką", () => {
    const early = nights(3, { wokeUpAt: "2026-07-15T03:00:00.000Z" });
    const result = evaluateCat3EarlyWakingAndSplitNight(input(early));
    // Noc 9 h 20 min (<9,5 h) → wariant krótkiej nocy
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT3_EARLY_WAKING_SHORT_NIGHT);
  });

  it("WMZ: unikanie strefy liczone w czasie lokalnym dziecka", () => {
    const bracket = getAgeBracket(240);
    // Pora biologiczna 19:30 lokalnie (1170), WMZ 18:00–19:00 lokalnie.
    // Ostatnia pobudka 15:00 lokalnie (13:00 UTC) + okno 215 min = 18:35 lokalnie → w WMZ.
    const params = {
      lastWakeUpIso: "2026-07-15T13:00:00.000Z",
      previousNapDurationMin: 60,
      napIndexToday: bracket.targetNapsCount,
      effectiveAgeDays: 240,
      bracket,
      chronicSleepDebtMin: 0,
      dayMode: "home" as const,
      insightWwOffsetMin: 0,
      biologicalBedtimeMinFromMidnight: 1170,
    };
    const local = predictNextSleepSlot({ ...params, timeZone: "Europe/Warsaw" });
    expect(local.reasonCode).toBe("CIRCADIAN_WMZ_AVOIDANCE_SHIFT");
    expect(getMinutesFromMidnightInTimeZone(local.sweetSpotIso, "Europe/Warsaw")).toBe(1170);

    // Ta sama chwila liczona w UTC (16:35) jest poza strefą — stary błąd
    const utc = predictNextSleepSlot({ ...params, timeZone: "UTC" });
    expect(utc.reasonCode).not.toBe("CIRCADIAN_WMZ_AVOIDANCE_SHIFT");
  });
});

describe("Powtarzalność diagnoz (spec. v2.0)", () => {
  it("CAT3: jedna rozbita noc nie wystarcza do diagnozy Split Night", () => {
    const logs = [...nights(1, { nightWakings: [SPLIT_WAKING] }), ...nights(7).slice(1)];
    expect(evaluateCat3EarlyWakingAndSplitNight(input(logs)).diagnosisCode).not.toBe(
      DIAGNOSIS_CODES.CAT3_SPLIT_NIGHT,
    );
  });

  it("CAT3: trzy rozbite noce z ostatnich 7 dają Split Night", () => {
    const logs = nights(3, { nightWakings: [SPLIT_WAKING] });
    expect(evaluateCat3EarlyWakingAndSplitNight(input(logs)).diagnosisCode).toBe(
      DIAGNOSIS_CODES.CAT3_SPLIT_NIGHT,
    );
  });

  it("CAT1: wymaga ≥3 pobudek przez ≥5 nocy i wieku ≥16 tyg.", () => {
    const wakings = [1, 2, 3].map(() => ({
      wokeAt: "02:00",
      estimatedDurationMin: 10,
      fedMilk: true,
      interventions: ["breast" as const],
    }));
    const fourNights = nights(4, { nightWakings: wakings });
    expect(evaluateCat1SleepAssociations(fourNights, 200).isTriggered).toBe(false);

    const fiveNights = nights(5, { nightWakings: wakings });
    expect(evaluateCat1SleepAssociations(fiveNights, 200).isTriggered).toBe(true);
    expect(evaluateCat1SleepAssociations(fiveNights, 100).isTriggered).toBe(false);
  });

  it("okno analizy: logi starsze niż 14 dni są pomijane", () => {
    const old = nights(3, {
      putDownAt: new Date(new Date(NOW_ISO).getTime() - 20 * DAY_MS).toISOString(),
      nightWakings: [SPLIT_WAKING],
    });
    expect(selectLogsInDiagnosticWindow(old, NOW_ISO)).toHaveLength(0);
    const results = evaluateAll7DiagnosticCategories(input(old));
    expect(results.find((r) => r.category === "CAT3_EARLY_WAKING_SPLIT_NIGHT")?.isTriggered).toBe(
      false,
    );
  });
});

describe("CAT2: brak nastroju to brak danych", () => {
  it("długa latencja bez zapisanego nastroju nie daje diagnozy niedomęczenia", () => {
    const longLatency = nights(3, {
      fellAsleepAt: "2026-07-14T18:20:00.000Z", // 50 min po odłożeniu
      mood: undefined,
    });
    const result = evaluateCat2BedtimeResistance(longLatency, 10);
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT2_UNCLEAR);
    expect(result.isTriggered).toBe(false);
  });
});

describe("Przesunięcie okna z wniosku (granica AI)", () => {
  it("ignoruje wwOffsetMin z wniosku, którego nie skorygował rodzic", () => {
    expect(
      resolveInsightWwOffset({ status: "active", algorithm_override_json: { wwOffsetMin: -90 } }),
    ).toBe(0);
  });

  it("używa przesunięcia silnika z ograniczeniem do ±30 min", () => {
    expect(
      resolveInsightWwOffset({
        status: "active",
        algorithm_override_json: { wakeWindowOffsetMinutes: -20 },
      }),
    ).toBe(-20);
    expect(
      resolveInsightWwOffset({
        status: "validated",
        algorithm_override_json: { wakeWindowOffsetMinutes: -200 },
      }),
    ).toBe(-30);
  });

  it("przesunięcie rodzica obowiązuje we wniosku skorygowanym i jest ograniczone", () => {
    expect(
      resolveInsightWwOffset({
        status: "corrected_by_parent",
        algorithm_override_json: { wwOffsetMin: 15 },
      }),
    ).toBe(15);
    expect(sanitizeParentOverride({ wwOffsetMin: 120, extra: "x" })).toEqual({ wwOffsetMin: 30 });
    expect(sanitizeParentOverride({ other: 1 })).toBeUndefined();
    expect(clampInsightWwOffset("10")).toBe(0);
    expect(resolveInsightWwOffset(null)).toBe(0);
  });
});
