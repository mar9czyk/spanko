import { describe, expect, it } from "vitest";
import type { PastDayView } from "../dayHistory";
import { buildManualEntry, dayWindow } from "../entryCreate";
import type { TimelineEvent } from "../types";

// Momenty w czasie lokalnym, tak jak liczy je formularz
const local = (day: number, hours: number, minutes = 0) =>
  new Date(2026, 9, day, hours, minutes).toISOString();
const NOW = local(22, 12, 0);

const nap: TimelineEvent = {
  id: "s1",
  kind: "nap",
  type: "nap",
  status: "completed",
  startTime: "",
  startIso: local(20, 12, 0),
  endIso: local(20, 13, 0),
};

const day: PastDayView = {
  date: "2026-10-20",
  dayStartIso: local(20, 6, 30),
  dayEndIso: local(21, 6, 45),
  events: [nap],
};

describe("dayWindow", () => {
  it("uses morning wakes as the window", () => {
    expect(dayWindow(day)).toEqual({
      startMs: Date.parse(local(20, 6, 30)),
      endMs: Date.parse(local(21, 6, 45)),
    });
  });

  it("falls back to 04:00 and 24 h without wakes", () => {
    const { startMs, endMs } = dayWindow({ date: "2026-10-20" });
    expect(startMs).toBe(new Date(2026, 9, 20, 4).getTime());
    expect(endMs - startMs).toBe(86_400_000);
  });
});

describe("buildManualEntry", () => {
  it("builds a completed nap for the day", () => {
    const result = buildManualEntry(
      day,
      { kind: "sleep", sleepType: "nap", start: "09:00", end: "10:15" },
      NOW,
    );
    expect(result).toMatchObject({
      collection: "sleep_logs",
      data: {
        physiological_date: "2026-10-20",
        type: "nap",
        status: "completed",
        fell_asleep_at: local(20, 9, 0),
        woke_up_at: local(20, 10, 15),
      },
    });
  });

  it("puts night sleep across midnight on the next calendar day", () => {
    const result = buildManualEntry(
      { ...day, dayEndIso: undefined },
      { kind: "sleep", sleepType: "night", start: "20:00", end: "05:30" },
      NOW,
    );
    expect(result).toMatchObject({
      data: { fell_asleep_at: local(20, 20, 0), woke_up_at: local(21, 5, 30) },
    });
  });

  it("assigns post-midnight times to the next calendar day", () => {
    const result = buildManualEntry(day, { kind: "diaper", time: "00:40", diaperKind: "wet" }, NOW);
    expect(result).toMatchObject({
      collection: "day_context",
      data: { timestamp: local(21, 0, 40), physiological_date: "2026-10-20", diaper_kind: "wet" },
    });
  });

  it("saves bottle feeding with ml and breast feeding with side", () => {
    expect(buildManualEntry(day, { kind: "bottle", time: "15:00", ml: 120 }, NOW)).toMatchObject({
      data: { event_type: "feeding", feeding_type: "bottle", bottle_ml: 120 },
    });
    expect(
      buildManualEntry(day, { kind: "breast", time: "15:00", side: "left" }, NOW),
    ).toMatchObject({ data: { feeding_type: "breast", breast_side: "left" } });
  });

  it("rejects a malformed clock", () => {
    expect(buildManualEntry(day, { kind: "bottle", time: "25:00", ml: 90 }, NOW)).toBe(
      "invalid_time",
    );
    expect(buildManualEntry(day, { kind: "bottle", time: "", ml: 90 }, NOW)).toBe("invalid_time");
  });

  it("rejects sleep that ends at its start or runs implausibly long", () => {
    expect(
      buildManualEntry(day, { kind: "sleep", sleepType: "nap", start: "09:00", end: "09:00" }, NOW),
    ).toBe("end_before_start");
    expect(
      buildManualEntry(day, { kind: "sleep", sleepType: "nap", start: "14:00", end: "13:00" }, NOW),
    ).toBe("end_before_start");
  });

  it("rejects overlapping sleep", () => {
    expect(
      buildManualEntry(day, { kind: "sleep", sleepType: "nap", start: "12:30", end: "13:30" }, NOW),
    ).toBe("overlap");
    expect(
      buildManualEntry(day, { kind: "sleep", sleepType: "nap", start: "11:00", end: "12:00" }, NOW),
    ).toMatchObject({ collection: "sleep_logs" });
  });

  it("rejects entries outside the day", () => {
    expect(
      buildManualEntry(
        { ...day, dayEndIso: local(20, 18, 0) },
        { kind: "diaper", time: "19:00", diaperKind: "wet" },
        NOW,
      ),
    ).toBe("outside_day");
    expect(
      buildManualEntry(
        day,
        { kind: "sleep", sleepType: "night", start: "20:00", end: "07:30" },
        NOW,
      ),
    ).toBe("outside_day");
  });

  it("rejects entries in the future", () => {
    expect(
      buildManualEntry(
        day,
        { kind: "diaper", time: "10:00", diaperKind: "dirty" },
        local(20, 9, 0),
      ),
    ).toBe("in_future");
  });
});

describe("buildManualEntry night waking", () => {
  const night: TimelineEvent = {
    id: "n1",
    kind: "nap",
    type: "night",
    status: "completed",
    startTime: "",
    startIso: local(20, 19, 30),
    endIso: local(21, 6, 45),
  };
  const nightDay: PastDayView = { ...day, events: [nap, night] };

  it("attaches a waking after midnight to the night sleep", () => {
    expect(buildManualEntry(nightDay, { kind: "night_waking", time: "02:10" }, NOW)).toEqual({
      collection: "night_waking",
      logId: "n1",
      wokeAt: local(21, 2, 10),
    });
  });

  it("rejects a waking outside the night sleep", () => {
    expect(buildManualEntry(nightDay, { kind: "night_waking", time: "15:00" }, NOW)).toBe(
      "no_night_sleep",
    );
  });

  it("rejects a waking when the day has no night sleep", () => {
    expect(buildManualEntry(day, { kind: "night_waking", time: "02:10" }, NOW)).toBe(
      "no_night_sleep",
    );
  });
});

describe("buildManualEntry solid meal", () => {
  it("saves a solid meal as feeding without breast side or ml", () => {
    expect(buildManualEntry(day, { kind: "solid", time: "15:00" }, NOW)).toMatchObject({
      collection: "day_context",
      data: { event_type: "feeding", feeding_type: "solid" },
    });
  });
});
