import { describe, expect, it } from "vitest";
import {
  calculateCircadianParameters,
  DIAGNOSIS_CODES,
  evaluateCat3EarlyWakingAndSplitNight,
  getAgeBracket,
  getMinutesFromMidnightInTimeZone,
  getUtcOffsetMinutesInTimeZone,
  hasUtcOffsetChangedWithinDays,
  resolvePhysiologicalDate,
} from "../index";
import type { DiagnosticEvaluationInput, SleepLog } from "../types";

const TZ = "Europe/Warsaw";

/**
 * Noc dziecka, które zasypia o 17:40 UTC i budzi się o 04:15 UTC (stały zegar biologiczny).
 * Do 24.10 to 19:40 / 06:15 czasu letniego (CEST), od 25.10 to 18:40 / 05:15 czasu zimowego (CET).
 *
 * @param {string} physiologicalDate - Data doby YYYY-MM-DD (wieczór nocy)
 * @returns {SleepLog} Noc
 */
function bodyClockNight(physiologicalDate: string): SleepLog {
  const eveningMs = Date.parse(`${physiologicalDate}T17:30:00.000Z`);
  return {
    id: `n-${physiologicalDate}`,
    childId: "c",
    physiologicalDate,
    type: "night",
    status: "completed",
    putDownAt: new Date(eveningMs).toISOString(),
    fellAsleepAt: new Date(eveningMs + 10 * 60_000).toISOString(),
    wokeUpAt: new Date(eveningMs + (10 * 60 + 45) * 60_000).toISOString(),
    interventions: ["independent"],
    mood: "easy",
    nightWakings: [],
  };
}

/**
 * Noce z kolejnych dób, najnowsza pierwsza.
 *
 * @param {readonly string[]} dates - Daty dób
 * @returns {SleepLog[]} Noce
 */
function nightsFor(dates: readonly string[]): SleepLog[] {
  return dates.map(bodyClockNight).toSorted((a, b) => b.putDownAt.localeCompare(a.putDownAt));
}

/**
 * Wejście CAT3 dla dziecka w Warszawie.
 *
 * @param {readonly SleepLog[]} logs - Noce
 * @param {string} nowIso - Teraz
 * @returns {DiagnosticEvaluationInput} Wejście silnika
 */
function cat3Input(logs: readonly SleepLog[], nowIso: string): DiagnosticEvaluationInput {
  return {
    nowIso,
    timeZone: TZ,
    child: { birthDateIso: "2026-01-15", activeDayMode: "home" },
    recentSleepLogs: logs,
    dailyTotalsLast14DaysMin: [],
    currentMetrics: {
      effectiveAgeDays: 280,
      chronicSleepDebtMin: 0,
      sleepBatteryPercent: 100,
      sleepNeedsProfile: "average",
      biologicalBedtimeMinFromMidnight: 1140,
    },
  };
}

const BEFORE = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"];
const AFTER = ["2026-10-24", "2026-10-25", "2026-10-26"];

describe("zmiana czasu 25.10.2026 (CEST → CET)", () => {
  it("ta sama godzina UTC to 06:15 przed zmianą i 05:15 po niej", () => {
    expect(getMinutesFromMidnightInTimeZone("2026-10-24T04:15:00.000Z", TZ)).toBe(6 * 60 + 15);
    expect(getMinutesFromMidnightInTimeZone("2026-10-25T04:15:00.000Z", TZ)).toBe(5 * 60 + 15);
  });

  it("rozpoznaje przesunięcie strefy i zmianę czasu w ostatnich 7 dniach", () => {
    expect(getUtcOffsetMinutesInTimeZone("2026-10-24T12:00:00.000Z", TZ)).toBe(120);
    expect(getUtcOffsetMinutesInTimeZone("2026-10-25T12:00:00.000Z", TZ)).toBe(60);
    expect(getUtcOffsetMinutesInTimeZone("2026-10-25T12:00:00.000Z", "America/New_York")).toBe(
      -240,
    );
    expect(hasUtcOffsetChangedWithinDays("2026-10-26T04:15:00.000Z", 7, TZ)).toBe(true);
    expect(hasUtcOffsetChangedWithinDays("2026-11-02T04:15:00.000Z", 7, TZ)).toBe(false);
    expect(hasUtcOffsetChangedWithinDays("2026-03-30T04:15:00.000Z", 7, TZ)).toBe(true);
  });

  it("doba fizjologiczna nocy ze zmianą czasu zostaje przy dacie wieczoru", () => {
    expect(
      resolvePhysiologicalDate({ eventTimestamp: "2026-10-25T01:30:00.000Z", timeZone: TZ }),
    ).toBe("2026-10-24");
    expect(
      resolvePhysiologicalDate({ eventTimestamp: "2026-10-25T05:30:00.000Z", timeZone: TZ }),
    ).toBe("2026-10-25");
  });

  it("CAT3 nie zgłasza wczesnych pobudek, gdy dziecko budzi się o tej samej porze biologicznej", () => {
    const logs = nightsFor([...BEFORE, ...AFTER]);
    const result = evaluateCat3EarlyWakingAndSplitNight(
      cat3Input(logs, "2026-10-27T12:00:00.000Z"),
    );
    expect(result.isTriggered).toBe(false);
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT3_CLOCK_CHANGE);
  });

  it("CAT3 wraca do zwykłej oceny tydzień po zmianie czasu", () => {
    const dates = [
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
    ];
    const result = evaluateCat3EarlyWakingAndSplitNight(
      cat3Input(nightsFor(dates), "2026-11-07T12:00:00.000Z"),
    );
    expect(result.isTriggered).toBe(true);
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT3_EARLY_WAKING);
  });

  it("kotwica poranna po zmianie czasu przesuwa się stopniowo, ok. 12 min na dobę", () => {
    const bracket = getAgeBracket(280);
    const anchorAfter = (logs: readonly SleepLog[]) =>
      calculateCircadianParameters({
        morningWakeTimesLast5DaysMinutesFromMidnight: logs
          .slice(0, 5)
          .map((l) => getMinutesFromMidnightInTimeZone(l.wokeUpAt as string, TZ)),
        bracket,
      }).circadianAnchorWakeTime;
    const all = nightsFor([...BEFORE, ...AFTER]);
    // Noce 22–23.10 kończą się o 06:15, noce 24–26.10 o 05:15 (czas zimowy)
    expect(anchorAfter(all.slice(2))).toBe("06:03");
    expect(anchorAfter(all.slice(1))).toBe("05:51");
    expect(anchorAfter(all)).toBe("05:39");
  });
});
