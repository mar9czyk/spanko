import { describe, expect, it } from "vitest";
import { applyClockTime, buildEntryTimePatch, toClockInputValue } from "../entryEdit";
import type { TimelineEvent } from "../types";

// Momenty budowane w czasie lokalnym, tak jak liczy je formularz edycji
const local = (day: number, hours: number, minutes = 0) =>
  new Date(2026, 9, day, hours, minutes).toISOString();
const NOW = local(21, 22, 0);

const diaper: TimelineEvent = {
  id: "d1",
  kind: "diaper",
  time: "",
  timeIso: local(21, 14, 10),
  diaperKind: "wet",
};

const nap: TimelineEvent = {
  id: "s1",
  kind: "nap",
  type: "nap",
  status: "completed",
  startTime: "",
  startIso: local(21, 12, 0),
  startField: "fell_asleep_at",
  putDownIso: local(21, 11, 50),
  endIso: local(21, 13, 0),
};

describe("applyClockTime", () => {
  it("zmienia godzinę w tym samym dniu", () => {
    expect(applyClockTime(local(21, 14, 10), "13:45")).toBe(local(21, 13, 45));
  });

  it("korekta przez północ trafia na moment najbliższy pierwotnemu", () => {
    expect(applyClockTime(local(21, 0, 30), "23:50")).toBe(local(20, 23, 50));
    expect(applyClockTime(local(20, 23, 40), "00:20")).toBe(local(21, 0, 20));
  });

  it("odrzuca błędną godzinę", () => {
    expect(applyClockTime(local(21, 14), "")).toBeNull();
    expect(applyClockTime(local(21, 14), "25:00")).toBeNull();
  });
});

describe("toClockInputValue", () => {
  it("formatuje HH:mm z zerami", () => {
    expect(toClockInputValue(local(21, 7, 5))).toBe("07:05");
    expect(toClockInputValue(undefined)).toBe("");
  });
});

describe("buildEntryTimePatch", () => {
  it("pielucha i karmienie zmieniają timestamp day_context", () => {
    expect(buildEntryTimePatch(diaper, { start: "13:30" }, NOW)).toEqual({
      collection: "day_context",
      id: "d1",
      patch: { timestamp: local(21, 13, 30) },
    });
  });

  it("nie pozwala przenieść wpisu w przyszłość", () => {
    expect(buildEntryTimePatch(diaper, { start: "22:30" }, local(21, 22, 0))).toBe("in_future");
  });

  it("sen: zmienia zaśnięcie i pobudkę", () => {
    expect(buildEntryTimePatch(nap, { start: "11:55", end: "13:20" }, NOW)).toEqual({
      collection: "sleep_logs",
      id: "s1",
      patch: { fell_asleep_at: local(21, 11, 55), woke_up_at: local(21, 13, 20) },
    });
  });

  it("sen: odłożenie późniejsze niż nowe zaśnięcie przesuwa się razem z nim", () => {
    const result = buildEntryTimePatch(nap, { start: "11:40", end: "13:00" }, NOW);
    expect(result).toMatchObject({
      patch: { fell_asleep_at: local(21, 11, 40), put_down_at: local(21, 11, 40) },
    });
  });

  it("sen bez zaśnięcia zmienia odłożenie", () => {
    const putDownOnly: TimelineEvent = {
      ...nap,
      startField: "put_down_at",
      startIso: local(21, 11, 50),
    };
    expect(buildEntryTimePatch(putDownOnly, { start: "11:30", end: "13:00" }, NOW)).toMatchObject({
      patch: { put_down_at: local(21, 11, 30), woke_up_at: local(21, 13, 0) },
    });
  });

  it("sen: pobudka musi być po zaśnięciu", () => {
    expect(buildEntryTimePatch(nap, { start: "13:10", end: "13:00" }, NOW)).toBe(
      "end_before_start",
    );
  });

  it("noc przez północ: zaśnięcie wieczorem, pobudka rano", () => {
    const night: TimelineEvent = {
      ...nap,
      type: "night",
      startIso: local(20, 19, 30),
      putDownIso: local(20, 19, 20),
      endIso: local(21, 6, 30),
    };
    expect(buildEntryTimePatch(night, { start: "20:00", end: "06:10" }, NOW)).toEqual({
      collection: "sleep_logs",
      id: "s1",
      patch: { fell_asleep_at: local(20, 20, 0), woke_up_at: local(21, 6, 10) },
    });
  });
});
