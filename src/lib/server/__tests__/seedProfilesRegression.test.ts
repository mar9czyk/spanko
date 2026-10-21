import { describe, expect, it } from "vitest";
import {
  replayPredictionsForChild,
  summarizeCalibration,
  toSleepPredictionDraft,
} from "@/lib/admin/calibration";
import { runDeterministicEngine } from "@/lib/server/childEngine";
import type { ProblemCategory } from "@/lib/sleep-engine/types";
import type { ChildRecord } from "@/lib/types/database";
import {
  addDays,
  generateProfileSleepLogs,
  SEED_PROFILES,
  zonedIso,
} from "../../../../scripts/seed-profiles.mjs";

const TODAY = "2026-10-12";
const TIME_ZONE = "Europe/Warsaw";
const HISTORY_DAYS = 21;
/** Ile ostatnich poranków oceniamy (każdy z pełnym tygodniem historii). */
const EVALUATION_MORNINGS = 7;
/** Godzina oceny: 10:00 czasu dziecka, po porannej pobudce. */
const EVALUATION_MINUTES = 600;
/** Limit fałszywych alarmów: odsetek poranków z kategorią spoza wzorca profilu. */
const FALSE_ALARM_MAX_RATE = 0.15;

/**
 * Buduje rekord dziecka profilu (wiek liczony względem ostatniego dnia historii).
 *
 * @param {(typeof SEED_PROFILES)[number]} profile - Profil
 * @returns {ChildRecord} Dziecko
 */
function buildChild(profile: (typeof SEED_PROFILES)[number]): ChildRecord {
  return {
    id: `child_${profile.key}`,
    household_id: "household_dev",
    name: profile.name,
    birth_date: `${addDays(TODAY, -profile.ageDays)}T00:00:00.000Z`,
    active_day_mode: "home",
    anti_orthosomnia_mode: false,
    timezone: TIME_ZONE,
    created: "2026-01-01T00:00:00.000Z",
    updated: "2026-01-01T00:00:00.000Z",
  };
}

/**
 * Ocenia profil każdego z ostatnich poranków tak jak serwer (logi znane do chwili oceny).
 *
 * @param {(typeof SEED_PROFILES)[number]} profile - Profil
 * @returns {ProblemCategory[][]} Kategorie z diagnozą (bez `info`) dla każdego poranka
 */
function evaluateMornings(profile: (typeof SEED_PROFILES)[number]): ProblemCategory[][] {
  const child = buildChild(profile);
  const logs = generateProfileSleepLogs(profile, {
    childId: child.id,
    today: TODAY,
    days: HISTORY_DAYS,
    timeZone: TIME_ZONE,
  });
  return Array.from({ length: EVALUATION_MORNINGS }, (_, index) => {
    const nowIso = zonedIso(addDays(TODAY, -index), EVALUATION_MINUTES, TIME_ZONE);
    const known = logs
      .filter((log) => (log.woke_up_at ?? "") <= nowIso)
      .toSorted((a, b) => b.created.localeCompare(a.created));
    return runDeterministicEngine({
      child,
      sleepRecords: known,
      matrixOverrideJson: null,
      nowIso,
    })
      .allDiagnostics.filter((d) => d.isTriggered && d.severity !== "info")
      .map((d) => d.category);
  });
}

describe("regresja silnika na profilach seeda", () => {
  for (const profile of SEED_PROFILES) {
    describe(profile.name, () => {
      const mornings = evaluateMornings(profile);

      for (const category of profile.expectedCategories) {
        it(`wykrywa ${category} każdego poranka`, () => {
          expect(mornings.every((categories) => categories.includes(category))).toBe(true);
        });
      }

      it("nie przekracza limitu fałszywych alarmów", () => {
        const allowed = new Set([...profile.expectedCategories, ...profile.allowedCategories]);
        const falseAlarms = mornings.filter((categories) =>
          categories.some((category) => !allowed.has(category)),
        );
        expect(falseAlarms.length / mornings.length).toBeLessThanOrEqual(FALSE_ALARM_MAX_RATE);
      });
    });
  }
});

describe("pomiar trafności na profilach seeda", () => {
  it("odtwarza prognozę dla każdej drzemki i nocy z pełną historią", () => {
    const profile = SEED_PROFILES[0];
    if (!profile) throw new Error("brak profili");
    const child = buildChild(profile);
    const logs = generateProfileSleepLogs(profile, {
      childId: child.id,
      today: TODAY,
      days: HISTORY_DAYS,
      timeZone: TIME_ZONE,
    });
    const fromIso = zonedIso(addDays(TODAY, -7), 0, TIME_ZONE);
    const outcomes = replayPredictionsForChild({ child, logs, insights: [], fromIso });
    const expected = logs.filter((log) => (log.put_down_at ?? "") >= fromIso).length;

    expect(outcomes).toHaveLength(expected);
    const rows = summarizeCalibration(outcomes.map((o) => toSleepPredictionDraft(o, "replay")));
    expect(rows.map((r) => `${r.ageBucket} ${r.type}`)).toEqual([
      "6–9 mies. nap",
      "6–9 mies. night",
    ]);
    // Typowe dziecko z profilu zasypia szybko — żadna drzemka ani noc nie ma długiej latencji
    expect(rows.every((r) => r.longLatencyRate === 0)).toBe(true);
  });
});
