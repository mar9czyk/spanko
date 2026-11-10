import { describe, expect, it } from "vitest";
import { aggregateDailySleepSummaries } from "../../sleep-summary";
import type { SleepLogRecord } from "../../types/database";
import { analyzeNapPlaces, describeNapPlaceSignal } from "../napPlaces";
import type { SleepLog } from "../types";

const MIN = 60_000;

function nap(day: number, minutes: number, sleepPlace?: string): SleepLog {
  const start = new Date(Date.UTC(2026, 3, 1 + day, 10, 0)).toISOString();
  return {
    id: `n-${day}-${minutes}-${sleepPlace}`,
    childId: "c",
    physiologicalDate: start.slice(0, 10),
    type: "nap",
    status: "completed",
    putDownAt: start,
    fellAsleepAt: start,
    wokeUpAt: new Date(new Date(start).getTime() + minutes * MIN).toISOString(),
    interventions: [],
    nightWakings: [],
    ...(sleepPlace ? { sleepPlace } : {}),
  };
}

describe("analyzeNapPlaces", () => {
  it("bez drzemek zwraca brak danych", () => {
    expect(analyzeNapPlaces([]).code).toBe("NAP_PLACE_NO_DATA");
  });

  it("bez drzemek kontaktowych nie zgłasza sygnału", () => {
    const result = analyzeNapPlaces([nap(0, 40), nap(1, 40), nap(2, 50)]);
    expect(result.code).toBe("NAP_PLACE_NO_CONTACT");
    expect(describeNapPlaceSignal(result)).toBeNull();
  });

  it("pojedyncza drzemka kontaktowa to tylko obecność", () => {
    const result = analyzeNapPlaces([nap(0, 40), nap(1, 40), nap(2, 40), nap(3, 90, "contact")]);
    expect(result.code).toBe("NAP_PLACE_CONTACT_PRESENT");
    expect(result.contactNapCount).toBe(1);
  });

  it("kontaktowe ≥ 50% i ≥ 1,5× dłuższe od reszty to zależność od kontaktu", () => {
    const result = analyzeNapPlaces([
      nap(0, 100, "contact"),
      nap(1, 95, "contact"),
      nap(2, 90, "contact"),
      nap(3, 30),
    ]);
    expect(result.code).toBe("NAP_PLACE_CONTACT_DEPENDENT");
    expect(result.contactMedianMin).toBe(95);
    expect(result.otherMedianMin).toBe(30);
    expect(describeNapPlaceSignal(result)).toContain("NAP_PLACE_CONTACT_DEPENDENT");
  });

  it("kontaktowe tak samo długie jak reszta to nie zależność", () => {
    const result = analyzeNapPlaces([
      nap(0, 60, "contact"),
      nap(1, 60, "contact"),
      nap(2, 60),
      nap(3, 60),
    ]);
    expect(result.code).toBe("NAP_PLACE_CONTACT_PRESENT");
  });

  it("drzemki w ruchu są pomijane", () => {
    const result = analyzeNapPlaces([nap(0, 20, "stroller"), nap(1, 20, "car_seat")]);
    expect(result.code).toBe("NAP_PLACE_NO_DATA");
  });

  it("za mało drzemek nie daje zależności", () => {
    expect(analyzeNapPlaces([nap(0, 90, "contact"), nap(1, 90, "contact")]).code).toBe(
      "NAP_PLACE_CONTACT_PRESENT",
    );
  });
});

describe("aggregateDailySleepSummaries: drzemki kontaktowe", () => {
  const record = (place: string, start: string, end: string): SleepLogRecord =>
    ({
      id: place + start,
      child_id: "c",
      type: "nap",
      status: "completed",
      physiological_date: "2026-04-10",
      fell_asleep_at: start,
      woke_up_at: end,
      sleep_place: place,
    }) as unknown as SleepLogRecord;

  it("liczy kontaktowe do sum, wzorca stacjonarnego i osobnych pól", () => {
    const [day] = aggregateDailySleepSummaries([
      record("contact", "2026-04-10T10:00:00Z", "2026-04-10T11:30:00Z"),
      record("stroller", "2026-04-10T13:00:00Z", "2026-04-10T13:20:00Z"),
    ]);
    expect(day?.daytimeSleepMin).toBe(110);
    expect(day?.contactNapCount).toBe(1);
    expect(day?.contactNapMin).toBe(90);
    expect(day?.stationaryDaytimeSleepMin).toBe(90);
  });
});
