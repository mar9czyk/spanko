import { describe, expect, it } from "vitest";
import { findNightSleep, summarizeDay } from "../daySummary";
import type { TimelineEvent } from "../types";

const nap = (type: "nap" | "night", extra: object = {}): TimelineEvent => ({
  id: `${type}-${Math.random()}`,
  kind: "nap",
  type,
  status: "completed",
  startTime: "09:00",
  ...extra,
});

describe("summarizeDay", () => {
  it("counts only naps as drzemki and sums their minutes", () => {
    const summary = summarizeDay([
      nap("nap", { durationMinutes: 60 }),
      nap("nap", { durationMinutes: 40 }),
      nap("night", { durationMinutes: 600, nightWakingIsos: ["a", "b"] }),
    ]);
    expect(summary).toMatchObject({ naps: 2, napMinutes: 100, nightWakings: 2 });
  });

  it("counts a both-diaper as wet and dirty", () => {
    const diaper = (diaperKind: "wet" | "dirty" | "both"): TimelineEvent => ({
      id: diaperKind,
      kind: "diaper",
      time: "10:00",
      diaperKind,
    });
    const summary = summarizeDay([diaper("wet"), diaper("dirty"), diaper("both")]);
    expect(summary).toMatchObject({ wet: 2, dirty: 2, feedings: 0 });
  });
});

describe("findNightSleep", () => {
  it("returns the night sleep or null", () => {
    expect(findNightSleep([nap("nap")])).toBeNull();
    expect(findNightSleep([nap("nap"), nap("night")])?.type).toBe("night");
  });
});
