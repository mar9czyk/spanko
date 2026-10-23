import { describe, expect, it } from "vitest";
import {
  type FeedingEvent,
  feedToSleepGapMin,
  isFeedToSleep,
  minutesSinceLastFeeding,
  summarizeNightFeedings,
  wasFedJustBeforeSleep,
} from "../feedingSignals";

const bottle = (timestamp: string, ml: number): FeedingEvent => ({
  timestamp,
  kind: "bottle",
  ml,
});

describe("minutesSinceLastFeeding", () => {
  it("zwraca null bez karmień", () => {
    expect(minutesSinceLastFeeding([], "2026-10-19T20:00:00Z")).toBeNull();
  });

  it("liczy od ostatniego karmienia i ignoruje przyszłe", () => {
    const events = [
      bottle("2026-10-19T17:00:00Z", 120),
      bottle("2026-10-19T19:00:00Z", 100),
      bottle("2026-10-19T21:00:00Z", 100),
    ];
    expect(minutesSinceLastFeeding(events, "2026-10-19T19:45:00Z")).toBe(45);
  });
});

describe("feedToSleepGapMin / wasFedJustBeforeSleep", () => {
  it("zwraca odstęp i flagę dla karmienia 20 min przed snem", () => {
    const events = [bottle("2026-10-19T19:10:00Z", 150)];
    expect(feedToSleepGapMin(events, "2026-10-19T19:30:00Z")).toBe(20);
    expect(wasFedJustBeforeSleep(events, "2026-10-19T19:30:00Z")).toBe(true);
  });

  it("nie flaguje karmienia 90 min przed snem", () => {
    const events = [bottle("2026-10-19T18:00:00Z", 150)];
    expect(wasFedJustBeforeSleep(events, "2026-10-19T19:30:00Z")).toBe(false);
  });

  it("ignoruje karmienia starsze niż 4 h", () => {
    const events = [bottle("2026-10-19T12:00:00Z", 150)];
    expect(feedToSleepGapMin(events, "2026-10-19T19:30:00Z")).toBeNull();
  });
});

describe("isFeedToSleep", () => {
  it("wykrywa karmienie w trakcie usypiania", () => {
    const events: FeedingEvent[] = [
      { timestamp: "2026-10-19T19:32:00Z", kind: "breast", breastMinutes: 10 },
    ];
    expect(isFeedToSleep(events, "2026-10-19T19:30:00Z", "2026-10-19T19:42:00Z")).toBe(true);
  });

  it("nie traktuje posiłku stałego jako karmienia do snu", () => {
    const events: FeedingEvent[] = [{ timestamp: "2026-10-19T19:32:00Z", kind: "solid" }];
    expect(isFeedToSleep(events, "2026-10-19T19:30:00Z", "2026-10-19T19:42:00Z")).toBe(false);
  });

  it("nie wykrywa karmienia dużo wcześniej", () => {
    const events = [bottle("2026-10-19T18:30:00Z", 120)];
    expect(isFeedToSleep(events, "2026-10-19T19:30:00Z", "2026-10-19T19:42:00Z")).toBe(false);
  });
});

describe("summarizeNightFeedings", () => {
  it("sumuje tylko mleko w oknie nocnym, także przez północ", () => {
    const events: FeedingEvent[] = [
      bottle("2026-10-19T19:00:00Z", 150), // przed zaśnięciem
      bottle("2026-10-19T23:30:00Z", 90),
      { timestamp: "2026-10-20T02:10:00Z", kind: "breast", breastMinutes: 12 },
      { timestamp: "2026-10-20T03:00:00Z", kind: "solid" },
      bottle("2026-10-20T06:30:00Z", 120), // po pobudce
    ];
    expect(summarizeNightFeedings(events, "2026-10-19T19:30:00Z", "2026-10-20T06:00:00Z")).toEqual({
      count: 2,
      totalMl: 90,
      breastMinutes: 12,
    });
  });

  it("liczy butelkę bez ilości jako karmienie, ale nie dodaje ml", () => {
    const events: FeedingEvent[] = [
      { timestamp: "2026-10-19T23:30:00Z", kind: "bottle" },
      bottle("2026-10-20T02:00:00Z", 90),
    ];
    expect(summarizeNightFeedings(events, "2026-10-19T19:30:00Z", "2026-10-20T06:00:00Z")).toEqual({
      count: 2,
      totalMl: 90,
      breastMinutes: 0,
    });
  });

  it("zwraca zera bez nocnych karmień", () => {
    expect(summarizeNightFeedings([], "2026-10-19T19:30:00Z", "2026-10-20T06:00:00Z")).toEqual({
      count: 0,
      totalMl: 0,
      breastMinutes: 0,
    });
  });
});
