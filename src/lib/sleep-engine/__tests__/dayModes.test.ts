import { describe, expect, it } from "vitest";
import {
  evaluateAll7DiagnosticCategories,
  getAgeBracket,
  isIllnessDay,
  needsWakeCheck,
  predictNextSleepSlot,
  resolveDayModeGuidance,
  resolveOnTheGoBedtimeAdvance,
  resolveUsualNapStats,
} from "../index";
import type {
  DailySleepSummary,
  DayMode,
  DiagnosticEvaluationInput,
  NextSleepSlotParams,
  SleepLog,
} from "../types";

const MIN_MS = 60_000;
const NOW_ISO = "2026-04-15T12:00:00.000Z";

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * MIN_MS).toISOString();
}

/** Noce z długim usypianiem (45 min), żeby CAT2 zgłaszało problem w zwykły dzień. */
function slowOnsetNights(count: number): SleepLog[] {
  return Array.from({ length: count }, (_, index) => {
    const putDownAt = addMinutes("2026-04-14T19:00:00.000Z", -index * 24 * 60);
    return {
      id: `n-${index}`,
      childId: "c",
      physiologicalDate: putDownAt.slice(0, 10),
      type: "night",
      status: "completed",
      putDownAt,
      fellAsleepAt: addMinutes(putDownAt, 45),
      wokeUpAt: addMinutes(putDownAt, 11 * 60 + 30),
      interventions: ["independent"],
      mood: "easy",
      nightWakings: [],
    } satisfies SleepLog;
  });
}

function input(dayMode: DayMode, tags: readonly string[] = []): DiagnosticEvaluationInput {
  return {
    nowIso: NOW_ISO,
    timeZone: "UTC",
    child: { birthDateIso: "2025-06-01", activeDayMode: dayMode },
    todayContext: { dayMode, tags },
    recentSleepLogs: slowOnsetNights(7),
    dailyTotalsLast14DaysMin: [],
    currentMetrics: {
      effectiveAgeDays: 300,
      chronicSleepDebtMin: 0,
      sleepBatteryPercent: 100,
      sleepNeedsProfile: "average",
      biologicalBedtimeMinFromMidnight: 1200,
    },
  };
}

function triggered(dayMode: DayMode, tags: readonly string[] = []): string[] {
  return evaluateAll7DiagnosticCategories(input(dayMode, tags))
    .filter((r) => r.isTriggered)
    .map((r) => r.category);
}

describe("Tryby dnia: diagnozy", () => {
  it("w domu długie usypianie zgłasza CAT2", () => {
    expect(triggered("home")).toContain("CAT2_BEDTIME_RESISTANCE_LATENCY");
  });

  it("w chorobie zostaje tylko choroba (i ochrona noworodka)", () => {
    const categories = triggered("illness_regression");
    expect(categories).toContain("CAT5_REGRESSION_ILLNESS_CRISIS");
    for (const category of categories) {
      expect(["CAT5_REGRESSION_ILLNESS_CRISIS", "CAT6_NEWBORN_DAY_NIGHT_ACTIVE_SLEEP"]).toContain(
        category,
      );
    }
  });

  it("tag gorączki działa jak tryb choroby", () => {
    expect(triggered("home", ["gorączka"])).not.toContain("CAT2_BEDTIME_RESISTANCE_LATENCY");
  });

  it("w drodze pora snu i krótkie drzemki nie są problemem", () => {
    const categories = triggered("on_the_go");
    expect(categories).not.toContain("CAT2_BEDTIME_RESISTANCE_LATENCY");
    expect(categories).not.toContain("CAT4_SHORT_NAPS_TRANSITIONS");
  });
});

describe("Tryby dnia: podpowiedzi", () => {
  it("ząbkowanie nie jest chorobą", () => {
    expect(isIllnessDay("home", ["ząbkowanie"])).toBe(false);
    expect(isIllnessDay("home", ["katar"])).toBe(true);
    expect(isIllnessDay("illness_regression", [])).toBe(true);
  });

  it("w chorobie tematy zależą od tagów, a czerwone flagi są zawsze", () => {
    const guidance = resolveDayModeGuidance({
      dayMode: "illness_regression",
      tags: ["gorączka", "katar"],
      effectiveAgeDays: 60,
    });
    expect(guidance?.mode).toBe("illness");
    expect(guidance?.topics).toEqual([
      "illness_general",
      "fever",
      "cold",
      "medicines",
      "unsafe",
      "back_to_plan",
    ]);
    expect(guidance?.showRedFlags).toBe(true);
    expect(guidance?.isYoungInfant).toBe(true);
    expect(guidance?.isUnder6Months).toBe(true);
  });

  it("w drodze bezpieczeństwo fotelika, wózka i nosidła, bez czerwonych flag", () => {
    const guidance = resolveDayModeGuidance({
      dayMode: "on_the_go",
      tags: [],
      effectiveAgeDays: 400,
    });
    expect(guidance?.mode).toBe("on_the_go");
    expect(guidance?.topics).toContain("car_seat");
    expect(guidance?.showRedFlags).toBe(false);
    expect(guidance?.isUnder6Months).toBe(false);
  });

  it("choroba ma pierwszeństwo przed trybem w drodze", () => {
    expect(
      resolveDayModeGuidance({ dayMode: "on_the_go", tags: ["gorączka"], effectiveAgeDays: 400 })
        ?.mode,
    ).toBe("illness");
  });

  it("zwykły dzień w domu nie ma karty", () => {
    expect(resolveDayModeGuidance({ dayMode: "home", tags: [], effectiveAgeDays: 400 })).toBeNull();
  });

  it("pytanie o budzenie przy drzemce > 3 h albo > 1,5× zwykłej", () => {
    expect(needsWakeCheck({ isIllness: true, napDurationMin: 190, usualLongestNapMin: null })).toBe(
      true,
    );
    expect(needsWakeCheck({ isIllness: true, napDurationMin: 100, usualLongestNapMin: 60 })).toBe(
      true,
    );
    expect(needsWakeCheck({ isIllness: true, napDurationMin: 80, usualLongestNapMin: 60 })).toBe(
      false,
    );
    expect(needsWakeCheck({ isIllness: false, napDurationMin: 300, usualLongestNapMin: 60 })).toBe(
      false,
    );
  });
});

describe("Tryby dnia: wcześniejszy sen po dniu w drodze", () => {
  it("połowa niedoboru, maks. 60 min, w krokach po 15 min", () => {
    expect(resolveOnTheGoBedtimeAdvance(150, 180)).toBe(0); // niedobór 30 min
    expect(resolveOnTheGoBedtimeAdvance(100, 180)).toBe(30); // 80 → 40 → 30
    expect(resolveOnTheGoBedtimeAdvance(0, 180)).toBe(60);
    expect(resolveOnTheGoBedtimeAdvance(0, null)).toBe(0);
  });

  it("zwykły sen dzienny to mediana dób z drzemkami, bez dni chorych", () => {
    const day = (date: string, daytime: number, ill = false): DailySleepSummary => ({
      physiologicalDate: date,
      totalSleepMin: 800,
      isIllOrIgnored: ill,
      daytimeSleepMin: daytime,
      napCount: 2,
      longestNapMin: daytime / 2,
    });
    const stats = resolveUsualNapStats([
      day("2026-04-14", 120),
      day("2026-04-13", 180),
      day("2026-04-12", 600, true),
      day("2026-04-11", 150),
    ]);
    expect(stats.daytimeMin).toBe(150);
    expect(stats.longestNapMin).toBe(75);
  });

  const bedtimeParams = (dayMode: DayMode, todayDaytime: number): NextSleepSlotParams => {
    const bracket = getAgeBracket(300);
    return {
      // Pobudka z ostatniej drzemki o 16:00, przewidywana pora snu 19:30
      lastWakeUpIso: "2026-04-15T16:00:00.000Z",
      previousNapDurationMin: 60,
      napIndexToday: bracket.targetNapsCount,
      effectiveAgeDays: 300,
      bracket,
      chronicSleepDebtMin: 0,
      dayMode,
      insightWwOffsetMin: 0,
      biologicalBedtimeMinFromMidnight: 19 * 60 + 30,
      timeZone: "UTC",
      todayDaytimeSleepMin: todayDaytime,
      usualDaytimeSleepMin: 180,
    };
  };

  it("w drodze z niedoborem drzemek kładzie wcześniej niż w domu", () => {
    const home = predictNextSleepSlot(bedtimeParams("home", 60));
    const onTheGo = predictNextSleepSlot(bedtimeParams("on_the_go", 60));
    expect(onTheGo.reasonCode).toBe("ON_THE_GO_EARLY_BEDTIME");
    expect(new Date(onTheGo.sweetSpotIso).getTime()).toBeLessThan(
      new Date(home.sweetSpotIso).getTime(),
    );
    // Nie wcześniej niż 60 min przed przewidywaną porą (19:30 → 18:30)
    expect(new Date(onTheGo.sweetSpotIso).getTime()).toBeGreaterThanOrEqual(
      new Date("2026-04-15T18:30:00.000Z").getTime(),
    );
    expect(onTheGo.targetWakeWindowMin).toBeGreaterThanOrEqual(
      bedtimeParams("home", 0).bracket.wwMinMorning,
    );
  });

  it("w drodze bez niedoboru prognoza jak w domu", () => {
    const home = predictNextSleepSlot(bedtimeParams("home", 180));
    const onTheGo = predictNextSleepSlot(bedtimeParams("on_the_go", 180));
    expect(onTheGo.sweetSpotIso).toBe(home.sweetSpotIso);
  });
});
