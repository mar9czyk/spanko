import { describe, expect, it } from "vitest";
import {
  applyClockTime,
  buildEntryTimePatch,
  clockAfterIso,
  entryDeleteTarget,
  stepBreastMinutes,
  toClockInputValue,
} from "../entryEdit";
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

  it("butelka zapisuje ilość tylko gdy ją podano", () => {
    const bottle: TimelineEvent = {
      id: "b1",
      kind: "feeding",
      time: "",
      timeIso: local(21, 14, 10),
      feedingType: "bottle",
    };
    expect(buildEntryTimePatch(bottle, { start: "14:10" }, NOW)).toEqual({
      collection: "day_context",
      id: "b1",
      patch: { timestamp: local(21, 14, 10) },
    });
    expect(buildEntryTimePatch(bottle, { start: "14:10", bottleMl: 130 }, NOW)).toEqual({
      collection: "day_context",
      id: "b1",
      patch: { timestamp: local(21, 14, 10), bottle_ml: 130 },
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

  it("sen: czas usypiania ustawia odłożenie względem zaśnięcia", () => {
    expect(
      buildEntryTimePatch(nap, { start: "12:00", end: "13:00", fallAsleepMin: 25 }, NOW),
    ).toMatchObject({
      patch: { fell_asleep_at: local(21, 12, 0), put_down_at: local(21, 11, 35) },
    });
    expect(
      buildEntryTimePatch(nap, { start: "12:00", end: "13:00", fallAsleepMin: 0 }, NOW),
    ).toMatchObject({ patch: { put_down_at: local(21, 12, 0) } });
    expect(buildEntryTimePatch(nap, { start: "12:00", end: "13:00", fallAsleepMin: -5 }, NOW)).toBe(
      "invalid_time",
    );
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

  it("sen: nastrój i co pomogło trafiają do zmiany rekordu", () => {
    const result = buildEntryTimePatch(
      nap,
      {
        start: "12:00",
        end: "13:00",
        mood: "fussy",
        interventions: ["pacifier_reinsert", "bouncing"],
      },
      NOW,
    );
    expect(result).toMatchObject({
      patch: { mood: "fussy", interventions: ["pacifier_reinsert", "bouncing"] },
    });
  });

  it("sen: wyczyszczony nastrój to pusta wartość, brak pola nie rusza nastroju", () => {
    const cleared = buildEntryTimePatch(nap, { start: "12:00", end: "13:00", mood: null }, NOW);
    expect(cleared).toMatchObject({ patch: { mood: "" } });
    const untouched = buildEntryTimePatch(nap, { start: "12:00", end: "13:00" }, NOW);
    expect(untouched).not.toHaveProperty("patch.mood");
    expect(untouched).not.toHaveProperty("patch.interventions");
  });
});

describe("stepBreastMinutes", () => {
  it("przesuwa o 5 min do wielokrotności kroku", () => {
    expect(stepBreastMinutes(15, 1)).toBe(20);
    expect(stepBreastMinutes(15, -1)).toBe(10);
    expect(stepBreastMinutes(12, 1)).toBe(15);
    expect(stepBreastMinutes(12, -1)).toBe(10);
  });

  it("trzyma się zakresu 0–120", () => {
    expect(stepBreastMinutes(0, -1)).toBe(0);
    expect(stepBreastMinutes(120, 1)).toBe(120);
  });
});

describe("buildEntryTimePatch: pierś", () => {
  const breast = (side: "left" | "right"): TimelineEvent => ({
    id: "br1",
    kind: "feeding",
    time: "",
    timeIso: local(21, 14, 10),
    feedingType: "breast",
    breastSide: side,
  });

  it("zapisuje minuty w polu strony karmienia", () => {
    expect(buildEntryTimePatch(breast("left"), { start: "14:10", breastMinutes: 25 }, NOW)).toEqual(
      {
        collection: "day_context",
        id: "br1",
        patch: { timestamp: local(21, 14, 10), breast_left_min: 25 },
      },
    );
    expect(buildEntryTimePatch(breast("right"), { start: "14:10", breastMinutes: 0 }, NOW)).toEqual(
      {
        collection: "day_context",
        id: "br1",
        patch: { timestamp: local(21, 14, 10), breast_right_min: 0 },
      },
    );
  });

  it("bez podanych minut nie rusza czasu karmienia", () => {
    expect(buildEntryTimePatch(breast("left"), { start: "14:10" }, NOW)).toEqual({
      collection: "day_context",
      id: "br1",
      patch: { timestamp: local(21, 14, 10) },
    });
  });
});

describe("night wakings in edit", () => {
  const night: TimelineEvent = {
    id: "n1",
    kind: "nap",
    type: "night",
    status: "completed",
    startTime: "",
    startIso: local(20, 22, 34),
    startField: "fell_asleep_at",
    endIso: local(21, 7, 30),
  };
  const waking = (iso: string) => ({
    wokeAt: iso,
    estimatedDurationMin: 15,
    fedMilk: false,
    interventions: [] as const,
  });

  it("clockAfterIso puts post-midnight clocks on the next day", () => {
    expect(clockAfterIso(local(20, 22, 34), "02:10")).toBe(local(21, 2, 10));
    expect(clockAfterIso(local(20, 22, 34), "23:30")).toBe(local(20, 23, 30));
  });

  it("saves sorted night wakings with the patch", () => {
    const result = buildEntryTimePatch(
      night,
      {
        start: "22:34",
        end: "07:30",
        nightWakings: [waking(local(21, 5, 0)), waking(local(21, 2, 10))],
      },
      NOW,
    );
    expect(result).toMatchObject({
      collection: "sleep_logs",
      patch: { night_wakings: [{ wokeAt: local(21, 2, 10) }, { wokeAt: local(21, 5, 0) }] },
    });
  });

  it("rejects a waking outside the sleep", () => {
    expect(
      buildEntryTimePatch(
        night,
        { start: "22:34", end: "07:30", nightWakings: [waking(local(21, 8, 0))] },
        NOW,
      ),
    ).toBe("waking_outside_sleep");
  });
});

describe("entryDeleteTarget", () => {
  it("usuwa karmienie, pieluchę i tagi z day_context", () => {
    expect(entryDeleteTarget(diaper)).toEqual({ collection: "day_context", id: "d1" });
    expect(
      entryDeleteTarget({ id: "f1", kind: "feeding", time: "14:13", feedingType: "solid" }),
    ).toEqual({ collection: "day_context", id: "f1" });
  });

  it("usuwa zakończony sen z sleep_logs", () => {
    expect(entryDeleteTarget(nap)).toEqual({ collection: "sleep_logs", id: "s1" });
  });

  it("nie usuwa trwającego snu", () => {
    expect(entryDeleteTarget({ ...nap, status: "sleeping" } as TimelineEvent)).toBeNull();
  });
});
