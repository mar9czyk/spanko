import { describe, expect, it } from "vitest";
import type { DayContextRecord, SleepLogRecord } from "@/lib/types/database";
import { buildPastDay, pastDayStripNowIso, shiftPhysiologicalDate } from "../dayHistory";

function sleepLog(partial: Partial<SleepLogRecord> & Pick<SleepLogRecord, "id">): SleepLogRecord {
  return {
    child_id: "c1",
    physiological_date: "2026-10-18",
    type: "nap",
    status: "completed",
    is_rebound_sleep: false,
    ignore_in_calibration: false,
    created: "",
    updated: "",
    ...partial,
  };
}

function context(
  partial: Partial<DayContextRecord> & Pick<DayContextRecord, "id" | "timestamp">,
): DayContextRecord {
  return {
    child_id: "c1",
    physiological_date: "2026-10-18",
    event_type: "feeding",
    feeding_type: "bottle",
    bottle_ml: 120,
    created: "",
    updated: "",
    ...partial,
  };
}

const LOGS: readonly SleepLogRecord[] = [
  sleepLog({
    id: "night-17",
    type: "night",
    physiological_date: "2026-10-17",
    fell_asleep_at: "2026-10-17T18:30:00Z",
    woke_up_at: "2026-10-18T05:10:00Z",
  }),
  sleepLog({
    id: "nap-1",
    fell_asleep_at: "2026-10-18T07:00:00Z",
    woke_up_at: "2026-10-18T08:00:00Z",
  }),
  sleepLog({
    id: "nap-2",
    fell_asleep_at: "2026-10-18T11:00:00Z",
    woke_up_at: "2026-10-18T12:30:00Z",
  }),
  sleepLog({
    id: "night-18",
    type: "night",
    fell_asleep_at: "2026-10-18T18:00:00Z",
    woke_up_at: "2026-10-19T04:50:00Z",
  }),
  sleepLog({ id: "nap-19", physiological_date: "2026-10-19" }),
];

describe("shiftPhysiologicalDate", () => {
  it("moves across month and year boundaries", () => {
    expect(shiftPhysiologicalDate("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftPhysiologicalDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftPhysiologicalDate("2026-10-19", -14)).toBe("2026-10-05");
  });

  it("is not affected by the DST change at the end of October", () => {
    expect(shiftPhysiologicalDate("2026-10-26", -1)).toBe("2026-10-25");
    expect(shiftPhysiologicalDate("2026-10-25", 1)).toBe("2026-10-26");
  });
});

describe("buildPastDay", () => {
  it("pokazuje drzemkę, która nigdy nie została zakończona", () => {
    const open = sleepLog({
      id: "nap-open",
      status: "sleeping",
      fell_asleep_at: "2026-10-18T13:00:00Z",
    });
    const day = buildPastDay("2026-10-18", [...LOGS, open], []);
    expect(day.events.map((event) => event.id)).toContain("nap-open");
  });

  const contexts = [
    context({ id: "feed-1", timestamp: "2026-10-18T06:00:00Z" }),
    context({ id: "feed-2", timestamp: "2026-10-18T10:00:00Z" }),
    context({
      id: "feed-other",
      timestamp: "2026-10-19T06:00:00Z",
      physiological_date: "2026-10-19",
    }),
  ];

  it("opens the day at the previous night's wake-up and closes it at its own night's wake-up", () => {
    const day = buildPastDay("2026-10-18", LOGS, contexts);
    expect(day.dayStartIso).toBe("2026-10-18T05:10:00Z");
    expect(day.dayEndIso).toBe("2026-10-19T04:50:00Z");
  });

  it("keeps only this day's entries, oldest first (morning to evening)", () => {
    const day = buildPastDay("2026-10-18", LOGS, contexts);
    expect(day.events.map((event) => event.id)).toEqual([
      "feed-1",
      "nap-1",
      "feed-2",
      "nap-2",
      "night-18",
    ]);
  });

  it("interleaves feeds, diapers and naps chronologically, oldest first (morning to evening)", () => {
    const mixed = [
      context({ id: "feed-a", timestamp: "2026-10-18T06:00:00Z" }),
      context({
        id: "diaper-a",
        timestamp: "2026-10-18T07:30:00Z",
        event_type: "diaper",
        diaper_kind: "wet",
      }),
      context({ id: "feed-b", timestamp: "2026-10-18T09:00:00Z" }),
      context({ id: "feed-c", timestamp: "2026-10-18T12:45:00Z" }),
    ];
    const day = buildPastDay("2026-10-18", LOGS, mixed);
    expect(day.events.map((event) => event.id)).toEqual([
      "feed-a",
      "nap-1",
      "diaper-a",
      "feed-b",
      "nap-2",
      "feed-c",
      "night-18",
    ]);
  });

  it("has no start when the previous night was not logged", () => {
    const day = buildPastDay("2026-10-17", LOGS, contexts);
    expect(day.dayStartIso).toBeUndefined();
    expect(pastDayStripNowIso(day)).toBeUndefined();
  });
});

describe("pastDayStripNowIso", () => {
  it("ends the strip at the next morning wake-up", () => {
    expect(
      pastDayStripNowIso({
        date: "2026-10-18",
        dayStartIso: "2026-10-18T05:10:00Z",
        dayEndIso: "2026-10-19T04:50:00Z",
        events: [],
      }),
    ).toBe("2026-10-19T04:50:00.000Z");
  });

  it("caps the strip at 24 hours when the day ended later or is still open", () => {
    expect(
      pastDayStripNowIso({
        date: "2026-10-18",
        dayStartIso: "2026-10-18T05:10:00Z",
        dayEndIso: "2026-10-19T07:00:00Z",
        events: [],
      }),
    ).toBe("2026-10-19T05:10:00.000Z");
    expect(
      pastDayStripNowIso({ date: "2026-10-18", dayStartIso: "2026-10-18T05:10:00Z", events: [] }),
    ).toBe("2026-10-19T05:10:00.000Z");
  });
});
