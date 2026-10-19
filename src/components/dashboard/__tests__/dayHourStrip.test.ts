import { describe, expect, it } from "vitest";
import { buildDayStrip, collectDayStripEvents, type DayStripSlot } from "../dayHourStrip";

function slotAt(slots: readonly DayStripSlot[], index: number): DayStripSlot {
  const slot = slots[index];
  if (!slot) throw new Error(`missing slot ${index}`);
  return slot;
}

// Minuty :40 dają tę samą pełną godzinę w każdej strefie z pełnogodzinnym przesunięciem.
const DAY_START = "2026-10-19T06:40:00Z";
const EMPTY = { sleeps: [], feedingIsos: [], diaperIsos: [] };

describe("buildDayStrip", () => {
  it("builds 96 quarter-hour slots from the full hour of the morning wake-up", () => {
    const { slots, startMs, nowOffset } = buildDayStrip({
      ...EMPTY,
      dayStartIso: DAY_START,
      nowIso: "2026-10-19T06:50:00Z",
    });
    expect(slots).toHaveLength(96);
    expect(new Date(startMs).toISOString()).toBe("2026-10-19T06:00:00.000Z");
    expect(slotAt(slots, 2).state).toBe("past");
    expect(slotAt(slots, 3).state).toBe("current");
    expect(slotAt(slots, 4).state).toBe("future");
    expect(nowOffset).toBeCloseTo(50 / (24 * 60));
  });

  it("splits a nap across slots by the fraction slept", () => {
    const { slots } = buildDayStrip({
      ...EMPTY,
      dayStartIso: DAY_START,
      nowIso: "2026-10-19T12:00:00Z",
      sleeps: [{ startIso: "2026-10-19T09:05:00Z", endIso: "2026-10-19T09:35:00Z", type: "nap" }],
    });
    // 09:00–09:15 → 10 min, 09:15–09:30 → pełny, 09:30–09:45 → 5 min
    expect(slotAt(slots, 12).sleepFraction).toBeCloseTo(10 / 15);
    expect(slotAt(slots, 13).sleepFraction).toBe(1);
    expect(slotAt(slots, 14).sleepFraction).toBeCloseTo(5 / 15);
    expect(slotAt(slots, 13).sleepType).toBe("nap");
    expect(slotAt(slots, 11).sleepFraction).toBe(0);
    expect(slotAt(slots, 11).sleepType).toBeNull();
  });

  it("counts an ongoing sleep only up to now and picks the dominant sleep type", () => {
    const { slots } = buildDayStrip({
      ...EMPTY,
      dayStartIso: DAY_START,
      nowIso: "2026-10-19T19:40:00Z",
      sleeps: [
        { startIso: "2026-10-19T19:00:00Z", endIso: "2026-10-19T19:05:00Z", type: "nap" },
        { startIso: "2026-10-19T19:05:00Z", type: "night" },
      ],
    });
    expect(slotAt(slots, 52).sleepType).toBe("night");
    expect(slotAt(slots, 52).sleepFraction).toBe(1);
    expect(slotAt(slots, 54).sleepFraction).toBeCloseTo(10 / 15);
    expect(slotAt(slots, 54).state).toBe("current");
    expect(slotAt(slots, 55).sleepFraction).toBe(0);
  });

  it("places feedings and diapers at their exact moment and drops ones outside the day", () => {
    const { marks } = buildDayStrip({
      ...EMPTY,
      dayStartIso: DAY_START,
      nowIso: "2026-10-19T12:00:00Z",
      feedingIsos: ["2026-10-19T12:00:00Z", "2026-10-19T05:30:00Z"],
      diaperIsos: ["2026-10-20T00:00:00Z"],
    });
    expect(marks).toEqual([
      { kind: "feeding", offset: 0.25 },
      { kind: "diaper", offset: 0.75 },
    ]);
  });

  it("has no now marker after the day has ended", () => {
    const { nowOffset } = buildDayStrip({
      ...EMPTY,
      dayStartIso: DAY_START,
      nowIso: "2026-10-20T07:00:00Z",
    });
    expect(nowOffset).toBeNull();
  });
});

describe("collectDayStripEvents", () => {
  it("keeps only events with ISO moments and adds the active sleep", () => {
    const result = collectDayStripEvents(
      [
        {
          id: "a",
          kind: "nap",
          type: "nap",
          status: "completed",
          startTime: "09:00",
          startIso: "2026-10-19T09:00:00Z",
          endIso: "2026-10-19T10:00:00Z",
        },
        { id: "b", kind: "feeding", time: "10:00", feedingType: "bottle" },
        { id: "c", kind: "diaper", time: "11:00", diaperKind: "wet", timeIso: "x" },
      ],
      { startIso: "2026-10-19T19:00:00Z", type: "night" },
    );
    expect(result.sleeps).toHaveLength(2);
    expect(result.feedingIsos).toHaveLength(0);
    expect(result.diaperIsos).toEqual(["x"]);
  });
});
