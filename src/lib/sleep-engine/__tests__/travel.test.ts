import { describe, expect, it } from "vitest";
import {
  collectCircadianSamples,
  evaluateAll7DiagnosticCategories,
  getTimeZoneDifferenceMinutes,
  recommendTravelStrategy,
  resolveAdaptationDays,
  resolveLogTimeZone,
  resolveScheduleClock,
  type TravelPlan,
} from "../index";
import type { DiagnosticEvaluationInput, SleepLog } from "../types";

// Październik 2026: Warszawa UTC+2 (do 25.10), Nowy Jork UTC−4, Tokio UTC+9
const ARRIVAL = "2026-10-10T12:00:00.000Z";
const DAY_MS = 86_400_000;
const daysAfter = (n: number) => new Date(new Date(ARRIVAL).getTime() + n * DAY_MS).toISOString();

const westPlan: TravelPlan = {
  fromTimeZone: "Europe/Warsaw",
  toTimeZone: "America/New_York",
  startedAt: ARRIVAL,
  strategy: "gradual",
};
const eastPlan: TravelPlan = { ...westPlan, toTimeZone: "Asia/Tokyo" };

describe("Podróż: strategia", () => {
  it("różnica stref: dodatnia na wschód", () => {
    expect(getTimeZoneDifferenceMinutes("Europe/Warsaw", "Asia/Tokyo", ARRIVAL)).toBe(420);
    expect(getTimeZoneDifferenceMinutes("Europe/Warsaw", "America/New_York", ARRIVAL)).toBe(-360);
  });

  it("zaleca czas domowy przy krótkim wyjeździe i różnicy do 3 h", () => {
    expect(recommendTravelStrategy(120, true)).toBe("stay_home");
    expect(recommendTravelStrategy(120, false)).toBe("gradual");
    expect(recommendTravelStrategy(420, true)).toBe("gradual");
    expect(recommendTravelStrategy(60, false)).toBe("local_now");
  });

  it("na wschód 30 min dziennie, na zachód 60 min", () => {
    expect(resolveAdaptationDays(420)).toBe(14);
    expect(resolveAdaptationDays(-360)).toBe(6);
  });
});

describe("Podróż: zegar harmonogramu", () => {
  it("bez planu liczymy w strefie dziecka", () => {
    const clock = resolveScheduleClock("Europe/Warsaw", null, ARRIVAL);
    expect(clock).toMatchObject({
      timeZone: "Europe/Warsaw",
      circadianShiftMin: 0,
      isAdapting: false,
    });
  });

  it("na zachód: dzień 2 to 2 h później w zegarze domowym", () => {
    const clock = resolveScheduleClock("America/New_York", westPlan, daysAfter(1));
    expect(clock).toMatchObject({
      timeZone: "Europe/Warsaw",
      circadianShiftMin: 120,
      isAdapting: true,
      pauseTimeDiagnostics: true,
      adaptationDay: 2,
      adaptationDays: 6,
    });
  });

  it("na wschód: dzień 1 to 30 min wcześniej", () => {
    const clock = resolveScheduleClock("Asia/Tokyo", eastPlan, daysAfter(0));
    expect(clock.circadianShiftMin).toBe(-30);
  });

  it("po przestawieniu liczymy w strefie lokalnej, każdy wpis w swojej strefie", () => {
    const clock = resolveScheduleClock("America/New_York", westPlan, daysAfter(10));
    expect(clock).toMatchObject({ timeZone: "America/New_York", isAdapting: false });
    expect(resolveLogTimeZone(daysAfter(-3), undefined, clock)).toBe("Europe/Warsaw");
    expect(resolveLogTimeZone(daysAfter(-3), "Europe/Warsaw", clock)).toBe("Europe/Warsaw");
    expect(resolveLogTimeZone(daysAfter(5), undefined, clock)).toBe("America/New_York");
  });

  it("czas domowy: liczymy w strefie domu bez przesunięcia", () => {
    const clock = resolveScheduleClock(
      "Europe/Warsaw",
      { ...westPlan, strategy: "stay_home" },
      daysAfter(1),
    );
    expect(clock).toMatchObject({
      timeZone: "Europe/Warsaw",
      circadianShiftMin: 0,
      pauseTimeDiagnostics: false,
    });
    expect(resolveLogTimeZone(daysAfter(1), "America/New_York", clock)).toBe("Europe/Warsaw");
  });

  it("od razu lokalny: diagnozy godzin wstrzymane tylko 2 doby", () => {
    const plan: TravelPlan = { ...westPlan, strategy: "local_now" };
    expect(resolveScheduleClock("America/New_York", plan, daysAfter(1)).pauseTimeDiagnostics).toBe(
      true,
    );
    expect(resolveScheduleClock("America/New_York", plan, daysAfter(3)).pauseTimeDiagnostics).toBe(
      false,
    );
  });
});

describe("Podróż: kotwica okołodobowa", () => {
  // Noce z pobudką 7:00 i zaśnięciem 19:30 czasu warszawskiego (UTC+2)
  const homeNights = [1, 2, 3].map((n) => ({
    wokeUpAt: new Date(new Date("2026-10-10T05:00:00.000Z").getTime() - n * DAY_MS).toISOString(),
    fellAsleepAt: new Date(
      new Date("2026-10-09T17:30:00.000Z").getTime() - n * DAY_MS,
    ).toISOString(),
    timeZone: "Europe/Warsaw",
  }));

  it("w trakcie przestawiania: noce sprzed podróży plus przesunięcie dnia", () => {
    const clock = resolveScheduleClock("America/New_York", westPlan, daysAfter(1));
    const samples = collectCircadianSamples(homeNights, clock, 5);
    expect(samples.wakeMinutes).toEqual([540, 540, 540]); // 7:00 + 2 h
    expect(samples.bedtimeMinutes).toEqual([1290, 1290, 1290]); // 19:30 + 2 h
  });

  it("po przestawieniu stare noce zostają o 7:00 swojego czasu", () => {
    const clock = resolveScheduleClock("America/New_York", westPlan, daysAfter(10));
    expect(collectCircadianSamples(homeNights, clock, 5).wakeMinutes).toEqual([420, 420, 420]);
  });
});

describe("Podróż: diagnozy", () => {
  it("w trakcie przestawiania wczesne pobudki nie są problemem", () => {
    // Pobudki 4:30 czasu dziecka przez 7 nocy
    const logs: SleepLog[] = Array.from({ length: 7 }, (_, i) => {
      const woke = new Date(new Date("2026-10-15T02:30:00.000Z").getTime() - i * DAY_MS);
      return {
        id: `n${i}`,
        childId: "c",
        physiologicalDate: woke.toISOString().slice(0, 10),
        type: "night",
        status: "completed",
        putDownAt: new Date(woke.getTime() - 10 * 3_600_000).toISOString(),
        fellAsleepAt: new Date(woke.getTime() - 10 * 3_600_000).toISOString(),
        wokeUpAt: woke.toISOString(),
        interventions: ["independent"],
        mood: "easy",
        nightWakings: [],
        timeZone: "Europe/Warsaw",
      };
    });
    const input = (pause: boolean): DiagnosticEvaluationInput => ({
      nowIso: "2026-10-15T12:00:00.000Z",
      timeZone: "Europe/Warsaw",
      child: { birthDateIso: "2025-10-01", activeDayMode: "home" },
      todayContext: { pauseTimeDiagnostics: pause },
      recentSleepLogs: logs,
      dailyTotalsLast14DaysMin: [],
      currentMetrics: {
        effectiveAgeDays: 380,
        chronicSleepDebtMin: 0,
        sleepBatteryPercent: 100,
        sleepNeedsProfile: "average",
        biologicalBedtimeMinFromMidnight: 1170,
      },
    });
    const cat3 = (pause: boolean) =>
      evaluateAll7DiagnosticCategories(input(pause)).find(
        (r) => r.category === "CAT3_EARLY_WAKING_SPLIT_NIGHT",
      );
    expect(cat3(false)?.isTriggered).toBe(true);
    expect(cat3(true)?.isTriggered).toBe(false);
  });
});
