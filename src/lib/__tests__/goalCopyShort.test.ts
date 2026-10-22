import { describe, expect, it } from "vitest";
import { countGoalTasks } from "@/components/goals/GoalPathCard";
import type { DailyTask, DailyTaskKind } from "@/lib/goals-engine/types";
import type { GoalDailyTaskRecord } from "@/lib/types/database";
import { describeTaskShort } from "../goal-copy";

const KINDS: readonly DailyTaskKind[] = [
  "NIGHT_FEED_LIMIT",
  "CHECK_INTERVALS",
  "RESPONSE_RUNG",
  "CHAIR_DISTANCE",
  "PICK_UP_PUT_DOWN",
  "NO_RESPONSE",
  "BEDTIME_ROUTINE",
  "SLEEP_HABIT",
];

describe("describeTaskShort", () => {
  it("zwraca krótki, niepusty tytuł w obu językach dla każdego rodzaju zadania", () => {
    for (const kind of KINDS) {
      const task: DailyTask = { kind, params: {} };
      for (const locale of ["pl", "en"] as const) {
        const title = describeTaskShort(task, locale);
        expect(title.length).toBeGreaterThan(0);
        expect(title.length).toBeLessThan(40);
      }
    }
  });

  it("podaje liczbę karmień i odstępy", () => {
    expect(describeTaskShort({ kind: "NIGHT_FEED_LIMIT", params: { nightFeedsAllowed: 0 } })).toBe(
      "Noc bez mleka",
    );
    expect(
      describeTaskShort({ kind: "CHECK_INTERVALS", params: { checkIntervalsMin: [3, 5] } }, "en"),
    ).toBe("Check after 3 → 5 min");
  });
});

describe("countGoalTasks", () => {
  it("liczy odhaczone zadania po kluczu rodzaj:indeks", () => {
    const daily = {
      tasks_json: [
        { kind: "NO_RESPONSE", params: {} },
        { kind: "BEDTIME_ROUTINE", params: {} },
        { kind: "SLEEP_HABIT", params: {} },
      ],
      done_json: ["BEDTIME_ROUTINE:1"],
    } as unknown as GoalDailyTaskRecord;
    expect(countGoalTasks(daily)).toEqual({ done: 1, total: 3 });
    expect(countGoalTasks(null)).toEqual({ done: 0, total: 0 });
  });
});
