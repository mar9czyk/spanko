import { describe, expect, it } from "vitest";
import { buildDayHourStrip, collectDayStripEvents, type DayStripHour } from "../dayHourStrip";

function hourAt(strip: readonly DayStripHour[], index: number): DayStripHour {
  const hour = strip[index];
  if (!hour) throw new Error(`missing hour ${index}`);
  return hour;
}

// Minuty :40 i :10 dają tę samą pełną godzinę w każdej strefie z pełnogodzinnym przesunięciem.
const DAY_START = "2026-10-19T06:40:00Z";

describe("buildDayHourStrip", () => {
  it("builds 24 hours starting at the full hour of the morning wake-up", () => {
    const strip = buildDayHourStrip({
      dayStartIso: DAY_START,
      nowIso: "2026-10-19T06:50:00Z",
      sleeps: [],
      feedingIsos: [],
      diaperIsos: [],
    });
    expect(strip).toHaveLength(24);
    expect(new Date(hourAt(strip, 0).startMs).toISOString()).toBe("2026-10-19T06:00:00.000Z");
    expect(hourAt(strip, 0).state).toBe("current");
    expect(hourAt(strip, 1).state).toBe("future");
  });

  it("splits a nap across hours by the fraction slept", () => {
    const strip = buildDayHourStrip({
      dayStartIso: DAY_START,
      nowIso: "2026-10-19T12:00:00Z",
      sleeps: [{ startIso: "2026-10-19T09:15:00Z", endIso: "2026-10-19T10:30:00Z", type: "nap" }],
      feedingIsos: [],
      diaperIsos: [],
    });
    expect(hourAt(strip, 3).sleepFraction).toBeCloseTo(0.75);
    expect(hourAt(strip, 4).sleepFraction).toBeCloseTo(0.5);
    expect(hourAt(strip, 3).sleepType).toBe("nap");
    expect(hourAt(strip, 2).sleepFraction).toBe(0);
    expect(hourAt(strip, 2).sleepType).toBeNull();
    expect(hourAt(strip, 3).state).toBe("past");
  });

  it("counts an ongoing sleep only up to now and picks the dominant sleep type", () => {
    const strip = buildDayHourStrip({
      dayStartIso: DAY_START,
      nowIso: "2026-10-19T19:40:00Z",
      sleeps: [
        { startIso: "2026-10-19T18:00:00Z", endIso: "2026-10-19T18:10:00Z", type: "nap" },
        { startIso: "2026-10-19T18:30:00Z", type: "night" },
      ],
      feedingIsos: [],
      diaperIsos: [],
    });
    expect(hourAt(strip, 12).sleepType).toBe("night");
    expect(hourAt(strip, 12).sleepFraction).toBeCloseTo(40 / 60);
    expect(hourAt(strip, 13).sleepFraction).toBeCloseTo(40 / 60);
    expect(hourAt(strip, 13).state).toBe("current");
  });

  it("places feedings and diapers in their hour", () => {
    const strip = buildDayHourStrip({
      dayStartIso: DAY_START,
      nowIso: "2026-10-19T12:00:00Z",
      sleeps: [],
      feedingIsos: ["2026-10-19T07:10:00Z", "2026-10-19T07:50:00Z"],
      diaperIsos: ["2026-10-19T08:10:00Z"],
    });
    expect(hourAt(strip, 1).feedings).toBe(2);
    expect(hourAt(strip, 2).diapers).toBe(1);
    expect(hourAt(strip, 0).feedings + hourAt(strip, 0).diapers).toBe(0);
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
