import { describe, expect, it } from "vitest";
import {
  createFallbackCoachMessage,
  formatGoalCoachPrompt,
  type GoalCoachContext,
  GoalCoachSchema,
} from "../goal-coach";
import { BLOCKER_TEXT, describeTask, REASON_TEXT } from "../goal-copy";
import type { DailyTask } from "../goals-engine/types";

const tasks: DailyTask[] = [
  { kind: "NIGHT_FEED_LIMIT", params: { nightFeedsAllowed: 1, mlPerFeed: 60 } },
  { kind: "BEDTIME_ROUTINE", params: {} },
];

const ctx: GoalCoachContext = {
  goal: "night_weaning",
  locale: "pl",
  ageMonths: 9,
  dayNumber: 3,
  totalDays: 13,
  decision: { action: "hold", reason: "STEP_IN_PROGRESS", nextStepIndex: 0 },
  baselineValue: 2,
  latestValue: 1,
  tasks,
  nightTip: tasks[0] ?? null,
  methodTitle: "Łagodne wygaszanie",
  goalTitle: "Noc bez mleka",
};

describe("goal coach", () => {
  it("prompt zawiera deterministyczne zadania i decyzję silnika", () => {
    const prompt = formatGoalCoachPrompt(ctx);
    expect(prompt).toContain("maks. 1 karmień");
    expect(prompt).toContain("60 ml");
    expect(prompt).toContain("STEP_IN_PROGRESS");
    expect(prompt).toContain("Doba planu: 3 / 13");
  });

  it("wiadomość awaryjna powstaje z zadań i spełnia schemat odpowiedzi AI", () => {
    const message = createFallbackCoachMessage(ctx);
    expect(message.headline).toContain("dzień 3 z 13");
    expect(message.todayAdvice.length).toBeGreaterThan(0);
    expect(GoalCoachSchema.safeParse(message).success).toBe(true);
  });

  it("wiadomość awaryjna działa po angielsku", () => {
    const message = createFallbackCoachMessage({
      ...ctx,
      locale: "en",
      goalTitle: "Night weaning",
    });
    expect(message.headline).toBe("Night weaning — day 3 of 13");
  });

  it("schemat odrzuca puste rady i zbyt wiele porad", () => {
    const base = { headline: "Tytuł", encouragement: "Dasz radę" };
    expect(GoalCoachSchema.safeParse({ ...base, todayAdvice: [] }).success).toBe(false);
    expect(
      GoalCoachSchema.safeParse({ ...base, todayAdvice: ["aaa", "bbb", "ccc", "ddd"] }).success,
    ).toBe(false);
  });
});

describe("goal copy", () => {
  it("opisuje każdy rodzaj zadania po polsku i angielsku", () => {
    const kinds: DailyTask[] = [
      { kind: "NIGHT_FEED_LIMIT", params: { nightFeedsAllowed: 0 } },
      { kind: "CHECK_INTERVALS", params: { checkIntervalsMin: [3, 5, 10] } },
      { kind: "RESPONSE_RUNG", params: { rung: "pat" } },
      { kind: "CHAIR_DISTANCE", params: { chairDistance: "doorway" } },
      { kind: "PICK_UP_PUT_DOWN", params: {} },
      { kind: "NO_RESPONSE", params: {} },
      { kind: "BEDTIME_ROUTINE", params: {} },
    ];
    for (const task of kinds) {
      expect(describeTask(task, "pl").length).toBeGreaterThan(5);
      expect(describeTask(task, "en").length).toBeGreaterThan(5);
    }
    expect(describeTask(kinds[1] as DailyTask, "pl")).toContain("3 → 5 → 10");
  });

  it("ma teksty dla wszystkich blokerów i kodów powodu postępu", () => {
    expect(Object.keys(BLOCKER_TEXT)).toHaveLength(7);
    for (const reason of [
      "ILLNESS_PAUSE",
      "TARGET_REACHED",
      "STEP_IN_PROGRESS",
      "STEP_COMPLETED",
      "REGRESSION_DETECTED",
      "CONSOLIDATING",
      "INSUFFICIENT_DATA",
    ]) {
      expect(REASON_TEXT[reason]).toBeDefined();
    }
  });
});
