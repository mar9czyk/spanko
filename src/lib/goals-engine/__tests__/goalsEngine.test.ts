import { describe, expect, it } from "vitest";
import type { SleepLog } from "../../sleep-engine/types";
import { buildDailyTasks, buildNightTip } from "../dailyTasks";
import { buildDailyGoalMetrics, computeBaseline } from "../metrics";
import { FERBER_INTERVALS_MIN, generatePlan, stepIndexForDay } from "../plans";
import { evaluateProgress } from "../progress";
import { evaluateReadiness } from "../readiness";
import type { DailyGoalMetrics, GoalBaseline, GoalMethod, GoalType } from "../types";

const day = (overrides: Partial<DailyGoalMetrics> = {}): DailyGoalMetrics => ({
  date: "2026-10-01",
  hasData: true,
  nightWakings: 3,
  nightFeedCount: 2,
  nightMilkMl: 240,
  sleepOnsetLatencyMin: 30,
  independentOnset: false,
  dominantIntervention: "breast",
  illness: false,
  ...overrides,
});

const baseline: GoalBaseline = {
  dayCount: 7,
  avgNightWakings: 3,
  avgNightFeedCount: 2,
  avgNightMilkMl: 240,
  avgLatencyMin: 30,
  dominantRung: "feed",
};

const readyInput = {
  goal: "night_weaning" as const,
  method: "gentle_fading" as const,
  effectiveAgeDays: 270,
  baseline,
  todayTags: [] as string[],
  redFlagsAcknowledged: true,
};

describe("evaluateReadiness", () => {
  it("jest gotowe dla 9-miesięcznego dziecka z nocnymi karmieniami", () => {
    expect(evaluateReadiness(readyInput)).toEqual({ ready: true, blockers: [], warnings: [] });
  });

  it("blokuje odstawienie nocnego mleka poniżej 6 mies. (wiek korygowany)", () => {
    const result = evaluateReadiness({ ...readyInput, effectiveAgeDays: 150 });
    expect(result.blockers).toContain("AGE_TOO_YOUNG");
  });

  it("blokuje metody stanowcze poniżej 6 mies., ale nie łagodne", () => {
    const firm = evaluateReadiness({
      ...readyInput,
      goal: "reduce_night_wakings",
      method: "check_and_console",
      effectiveAgeDays: 150,
    });
    expect(firm.blockers).toEqual(["METHOD_AGE_TOO_YOUNG"]);
    const gentle = evaluateReadiness({
      ...readyInput,
      goal: "reduce_night_wakings",
      method: "gentle_fading",
      effectiveAgeDays: 150,
    });
    expect(gentle.ready).toBe(true);
  });

  it("blokuje nieobsługiwaną metodę dla celu", () => {
    const result = evaluateReadiness({ ...readyInput, method: "chair_method" });
    expect(result.blockers).toContain("METHOD_NOT_SUPPORTED");
  });

  it("wymaga danych, braku choroby i potwierdzenia czerwonych flag", () => {
    const result = evaluateReadiness({
      ...readyInput,
      baseline: { ...baseline, dayCount: 2 },
      todayTags: ["gorączka"],
      redFlagsAcknowledged: false,
    });
    expect(result.blockers).toEqual(
      expect.arrayContaining(["INSUFFICIENT_DATA", "ILLNESS_ACTIVE", "RED_FLAGS_NOT_ACKNOWLEDGED"]),
    );
    expect(result.ready).toBe(false);
  });

  it("blokuje cel, gdy nie ma problemu do rozwiązania", () => {
    const result = evaluateReadiness({
      ...readyInput,
      baseline: { ...baseline, avgNightFeedCount: 0 },
    });
    expect(result.blockers).toContain("NO_PROBLEM_TO_SOLVE");
  });

  it("ostrzega przy ząbkowaniu i małej liczbie dób", () => {
    const result = evaluateReadiness({
      ...readyInput,
      baseline: { ...baseline, dayCount: 4 },
      todayTags: ["ząbkowanie"],
    });
    expect(result.ready).toBe(true);
    expect(result.warnings).toEqual(["TEETHING_ACTIVE", "LOW_DATA_QUALITY"]);
  });

  it("weź–odłóż po 6. mies. (wiek korygowany) ostrzega, ale nie blokuje", () => {
    const pupd = {
      ...readyInput,
      goal: "independent_sleep_onset" as const,
      method: "pick_up_put_down" as const,
    };
    const older = evaluateReadiness({ ...pupd, effectiveAgeDays: 270 });
    expect(older.ready).toBe(true);
    expect(older.warnings).toContain("PUPD_OLDER_CHILD");
    expect(evaluateReadiness({ ...pupd, effectiveAgeDays: 150 }).warnings).not.toContain(
      "PUPD_OLDER_CHILD",
    );
  });
});

describe("generatePlan", () => {
  it("odstawianie łagodne: 3 redukcje objętości, zdejmowanie karmień, utrwalenie", () => {
    const plan = generatePlan({ goal: "night_weaning", method: "gentle_fading", baseline });
    expect(plan.steps.map((s) => s.code)).toEqual([
      "WEAN_REDUCE_VOLUME",
      "WEAN_REDUCE_VOLUME",
      "WEAN_REDUCE_VOLUME",
      "WEAN_DROP_FEED",
      "WEAN_DROP_FEED",
      "CONSOLIDATE",
    ]);
    expect(plan.steps.slice(0, 3).map((s) => s.params.mlPerFeed)).toEqual([90, 60, 30]);
    expect(plan.steps.slice(3, 5).map((s) => s.params.nightFeedsAllowed)).toEqual([1, 0]);
    expect(plan.totalDays).toBe(2 * 5 + 3);
  });

  it("kroki są ciągłe i bez luk", () => {
    const plan = generatePlan({
      goal: "independent_sleep_onset",
      method: "chair_method",
      baseline,
    });
    let expectedFrom = 1;
    for (const step of plan.steps) {
      expect(step.fromDay).toBe(expectedFrom);
      expectedFrom = step.toDay + 1;
    }
    expect(plan.totalDays).toBe(4 * 3 + 3);
  });

  it("drabina interwencji startuje o szczebel niżej od dominującego", () => {
    const plan = generatePlan({
      goal: "reduce_night_wakings",
      method: "gentle_fading",
      baseline: { ...baseline, dominantRung: "carry" },
    });
    expect(plan.steps.map((s) => s.params.rung)).toEqual([
      "pat",
      "shush",
      "presence",
      "independent",
      "independent",
    ]);
  });

  it("Ferber: doby 1–3 z rosnącymi odstępami, od doby 4 stałe 12/15/17 + utrwalenie", () => {
    const plan = generatePlan({
      goal: "reduce_night_wakings",
      method: "check_and_console",
      baseline,
    });
    expect(plan.steps).toHaveLength(5);
    expect(plan.steps[0]?.params.checkIntervalsMin).toEqual([3, 5, 10]);
    expect(plan.steps[1]?.params.checkIntervalsMin).toEqual([5, 10, 12]);
    expect(plan.steps[3]).toMatchObject({ fromDay: 4, toDay: 7 });
    expect(plan.steps[3]?.params.checkIntervalsMin).toEqual([12, 15, 17]);
    expect(plan.steps[4]?.params.checkIntervalsMin).toEqual(FERBER_INTERVALS_MIN[3]);
    expect(plan.totalDays).toBe(10);
  });

  it("czas trwania metod mieści się w zakresach spec v2.0", () => {
    const total = (goal: GoalType, method: GoalMethod) =>
      generatePlan({ goal, method, baseline }).totalDays;
    const chair = total("independent_sleep_onset", "chair_method");
    expect(chair - 3).toBeGreaterThanOrEqual(10);
    expect(chair - 3).toBeLessThanOrEqual(14);
    const pupd = total("independent_sleep_onset", "pick_up_put_down");
    expect(pupd).toBeGreaterThanOrEqual(14);
    expect(pupd).toBeLessThanOrEqual(21);
    const fading = total("independent_sleep_onset", "gentle_fading");
    expect(fading).toBeGreaterThanOrEqual(7);
    expect(fading).toBeLessThanOrEqual(14);
  });

  it("extinction i pick-up-put-down generują krótkie plany", () => {
    expect(
      generatePlan({ goal: "reduce_night_wakings", method: "extinction", baseline }).totalDays,
    ).toBe(6);
    expect(
      generatePlan({ goal: "independent_sleep_onset", method: "pick_up_put_down", baseline })
        .totalDays,
    ).toBe(17);
  });

  it("stepIndexForDay mapuje dobę na krok, a po końcu zwraca ostatni", () => {
    const plan = generatePlan({ goal: "night_weaning", method: "extinction", baseline });
    expect(stepIndexForDay(plan, 1)).toBe(0);
    expect(stepIndexForDay(plan, 4)).toBe(1);
    expect(stepIndexForDay(plan, 99)).toBe(1);
  });
});

describe("cel „Lepsze nawyki snu”", () => {
  it("jest dostępny od urodzenia bez czerwonych flag i bez „problemu”", () => {
    const result = evaluateReadiness({
      ...readyInput,
      goal: "healthy_sleep_habits",
      method: "habit_building",
      effectiveAgeDays: 20,
      baseline: { ...baseline, avgLatencyMin: 5, dominantRung: "independent" },
      redFlagsAcknowledged: false,
    });
    expect(result).toEqual({ ready: true, blockers: [], warnings: [] });
  });

  it("nadal wymaga danych i braku choroby", () => {
    const result = evaluateReadiness({
      ...readyInput,
      goal: "healthy_sleep_habits",
      method: "habit_building",
      baseline: { ...baseline, dayCount: 1 },
      todayTags: ["gorączka"],
    });
    expect(result.blockers).toEqual(["INSUFFICIENT_DATA", "ILLNESS_ACTIVE"]);
  });

  it("plan: 4 nawyki po 3 noce + 2 noce utrwalenia, bez dodatkowej rutyny w zadaniach", () => {
    const plan = generatePlan({ goal: "healthy_sleep_habits", method: "habit_building", baseline });
    expect(plan.steps.map((s) => s.params.habit)).toEqual([
      "WAKE_ANCHOR",
      "BEDTIME_ROUTINE",
      "SLEEP_ENVIRONMENT",
      "DROWSY_PUT_DOWN",
      undefined,
    ]);
    expect(plan.totalDays).toBe(14);
    expect(buildDailyTasks(plan, 0)).toEqual([
      { kind: "SLEEP_HABIT", params: { habit: "WAKE_ANCHOR" } },
    ]);
  });
});

describe("evaluateProgress", () => {
  const plan = generatePlan({ goal: "night_weaning", method: "gentle_fading", baseline });
  const run = (
    recentDays: DailyGoalMetrics[],
    stepIndex = 0,
    daysInStep = 2,
    goal: "night_weaning" | "reduce_night_wakings" = "night_weaning",
  ) => evaluateProgress({ goal, baseline, plan, stepIndex, daysInStep, recentDays });

  it("pauzuje podczas choroby", () => {
    expect(run([day({ illness: true })]).action).toBe("pause");
  });

  it("wstrzymuje, dopóki krok trwa", () => {
    expect(run([day({ nightFeedCount: 2 })], 0, 1)).toEqual({
      action: "hold",
      reason: "STEP_IN_PROGRESS",
      nextStepIndex: 0,
    });
  });

  it("przechodzi dalej po ukończonym kroku bez regresji", () => {
    const decision = run([day({ nightFeedCount: 2 }), day({ nightFeedCount: 1 })]);
    expect(decision).toEqual({ action: "advance", reason: "STEP_COMPLETED", nextStepIndex: 1 });
  });

  it("cofa się o krok po regresji", () => {
    const decision = run([day({ nightFeedCount: 4 }), day({ nightFeedCount: 4 })], 2);
    expect(decision).toEqual({
      action: "step_back",
      reason: "REGRESSION_DETECTED",
      nextStepIndex: 1,
    });
  });

  it("na pierwszym kroku regresja tylko wstrzymuje", () => {
    const decision = run([day({ nightFeedCount: 4 }), day({ nightFeedCount: 4 })], 0);
    expect(decision.action).toBe("hold");
    expect(decision.reason).toBe("REGRESSION_DETECTED");
  });

  it("3 dobre doby z rzędu to jeszcze nie sukces", () => {
    const zero = day({ nightFeedCount: 0 });
    expect(run([zero, zero, zero], 1, 0).action).not.toBe("achieved");
  });

  it("cel pobudek: ≤1 pobudka w 5 z 7 nocy, mimo dwóch gorszych nocy", () => {
    const calm = day({ nightWakings: 1 });
    const rough = day({ nightWakings: 3 });
    const week = [calm, rough, calm, calm, rough, calm, calm];
    expect(run(week, 0, 0, "reduce_night_wakings").action).toBe("achieved");
  });

  it("4 dobre noce z 7 nie wystarczą", () => {
    const calm = day({ nightWakings: 0 });
    const rough = day({ nightWakings: 3 });
    const week = [rough, calm, rough, calm, rough, calm, calm];
    expect(run(week, 0, 0, "reduce_night_wakings").action).not.toBe("achieved");
  });

  it("liczy tylko ostatnie 7 zmierzonych nocy", () => {
    const zero = day({ nightFeedCount: 0 });
    const bad = day({ nightFeedCount: 3 });
    const result = run([zero, zero, zero, zero, zero, bad, bad, bad], 1, 0);
    expect(result.action).not.toBe("achieved");
  });

  it("doby bez danych lub chore nie liczą się do serii", () => {
    const zero = day({ nightFeedCount: 0 });
    const result = run(
      [zero, zero, day({ hasData: false }), zero, day({ illness: true }), zero],
      1,
      0,
    );
    expect(result.action).not.toBe("achieved");
  });

  it("ostatni krok bez osiągnięcia celu utrwala", () => {
    const decision = run([day({ nightFeedCount: 1 }), day({ nightFeedCount: 1 })], 5, 3);
    expect(decision).toEqual({ action: "hold", reason: "CONSOLIDATING", nextStepIndex: 5 });
  });
});

describe("buildDailyTasks / buildNightTip", () => {
  it("odstawianie: limit karmień i ml bez rutyny wieczornej", () => {
    const plan = generatePlan({ goal: "night_weaning", method: "gentle_fading", baseline });
    expect(buildDailyTasks(plan, 0)).toEqual([
      { kind: "NIGHT_FEED_LIMIT", params: { nightFeedsAllowed: 2, mlPerFeed: 90 } },
    ]);
  });

  it("Ferber: odstępy sprawdzania + rutyna wieczorna, wskazówka nocna z odstępami", () => {
    const plan = generatePlan({
      goal: "reduce_night_wakings",
      method: "check_and_console",
      baseline,
    });
    const tasks = buildDailyTasks(plan, 1);
    expect(tasks.map((t) => t.kind)).toEqual(["CHECK_INTERVALS", "BEDTIME_ROUTINE"]);
    expect(buildNightTip(plan, 1)?.params.checkIntervalsMin).toEqual([5, 10, 12]);
  });

  it("zwraca puste zadania dla nieistniejącego kroku", () => {
    const plan = generatePlan({ goal: "night_weaning", method: "extinction", baseline });
    expect(buildDailyTasks(plan, 99)).toEqual([]);
    expect(buildNightTip(plan, 99)).toBeNull();
  });
});

describe("buildDailyGoalMetrics / computeBaseline", () => {
  const nightLog: SleepLog = {
    id: "n1",
    childId: "c1",
    physiologicalDate: "2026-10-01",
    type: "night",
    status: "completed",
    putDownAt: "2026-10-01T19:00:00Z",
    fellAsleepAt: "2026-10-01T19:25:00Z",
    wokeUpAt: "2026-10-02T06:00:00Z",
    interventions: ["breast"],
    mood: "easy",
    nightWakings: [
      {
        wokeAt: "2026-10-01T23:00:00Z",
        estimatedDurationMin: 10,
        fedMilk: true,
        interventions: ["bottle"],
      },
      {
        wokeAt: "2026-10-02T03:00:00Z",
        estimatedDurationMin: 10,
        fedMilk: false,
        interventions: ["patting"],
      },
    ],
  };

  it("liczy pobudki, karmienia (max z logów i karmień), latencję i dominującą interwencję", () => {
    const metrics = buildDailyGoalMetrics({
      date: "2026-10-01",
      nightLog,
      feedings: [
        { timestamp: "2026-10-01T23:00:00Z", kind: "bottle", ml: 120 },
        { timestamp: "2026-10-02T03:10:00Z", kind: "bottle", ml: 90 },
      ],
      tags: [],
    });
    expect(metrics).toMatchObject({
      hasData: true,
      nightWakings: 2,
      nightFeedCount: 2,
      nightMilkMl: 210,
      sleepOnsetLatencyMin: 25,
      independentOnset: false,
      illness: false,
    });
  });

  it("brak zakończonego snu = brak danych; tag gorączki oznacza chorobę", () => {
    const metrics = buildDailyGoalMetrics({
      date: "2026-10-01",
      feedings: [],
      tags: ["gorączka"],
    });
    expect(metrics.hasData).toBe(false);
    expect(metrics.illness).toBe(true);
  });

  it("baseline pomija doby chore i bez danych oraz bierze maks. 7 dób", () => {
    const days = [
      ...Array.from({ length: 9 }, () => day({ nightWakings: 2, nightFeedCount: 1 })),
      day({ nightWakings: 10, illness: true }),
      day({ hasData: false, nightWakings: 10 }),
    ];
    const result = computeBaseline(days);
    expect(result.dayCount).toBe(7);
    expect(result.avgNightWakings).toBe(2);
    expect(result.dominantRung).toBe("feed");
  });
});
