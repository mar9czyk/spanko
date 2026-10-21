import { describe, expect, it } from "vitest";
import {
  DIAGNOSIS_CODES,
  evaluateAll7DiagnosticCategories,
  evaluateCat1SleepAssociations,
  evaluateCat2BedtimeResistance,
  evaluateCat3EarlyWakingAndSplitNight,
  evaluateCat4ShortNapsAndTransitions,
  evaluateCat5RegressionsAndCrisis,
  evaluateCat6NewbornCare,
  evaluateCat7NightWeaning,
} from "../index";
import type { DiagnosticEvaluationInput, NightWakingEntry, SleepLog } from "../types";

const NOW_ISO = "2026-04-15T12:00:00.000Z";
const DAY_MS = 86_400_000;
const MIN_MS = 60_000;

/**
 * Przesuwa ISO o podaną liczbę minut.
 *
 * @param {string} iso - Znacznik czasu
 * @param {number} minutes - Przesunięcie
 * @returns {string} Nowy ISO
 */
function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * MIN_MS).toISOString();
}

/**
 * Tworzy noce z kolejnych dób wstecz (noc 0 kończy się rano 15.04).
 *
 * @param {number} count - Liczba nocy
 * @param {(index: number) => Partial<SleepLog>} [patch] - Zmiany dla nocy o danym indeksie
 * @returns {SleepLog[]} Noce od najnowszej
 */
function nights(
  count: number,
  patch: (index: number) => Partial<SleepLog> = () => ({}),
): SleepLog[] {
  return Array.from({ length: count }, (_, index) => {
    const shift = -index * 24 * 60;
    const putDownAt = addMinutes("2026-04-14T19:00:00.000Z", shift);
    const date = putDownAt.slice(0, 10);
    return {
      id: `n-${index}`,
      childId: "c",
      physiologicalDate: date,
      type: "night",
      status: "completed",
      putDownAt,
      fellAsleepAt: addMinutes(putDownAt, 10),
      wokeUpAt: addMinutes(putDownAt, 11 * 60 + 30),
      interventions: ["independent"],
      mood: "easy",
      nightWakings: [],
      ...patch(index),
    } satisfies SleepLog;
  });
}

/**
 * Tworzy pobudki nocne w danej nocy.
 *
 * @param {string} putDownAt - Odłożenie na noc (punkt odniesienia)
 * @param {readonly { offsetMin: number; durationMin: number; fed?: boolean; breast?: boolean }[]} specs - Pobudki
 * @returns {NightWakingEntry[]} Pobudki
 */
function wakings(
  putDownAt: string,
  specs: readonly { offsetMin: number; durationMin: number; fed?: boolean; breast?: boolean }[],
): NightWakingEntry[] {
  return specs.map((s) => ({
    wokeAt: addMinutes(putDownAt, s.offsetMin),
    estimatedDurationMin: s.durationMin,
    fedMilk: s.fed ?? false,
    interventions: s.fed ? [s.breast === false ? "bottle" : "breast"] : ["room_presence"],
  }));
}

/**
 * Buduje wejście diagnostyczne.
 *
 * @param {readonly SleepLog[]} logs - Logi
 * @param {number} ageDays - Wiek efektywny
 * @param {Partial<DiagnosticEvaluationInput>} [extra] - Dodatkowe pola
 * @returns {DiagnosticEvaluationInput} Wejście
 */
function input(
  logs: readonly SleepLog[],
  ageDays: number,
  extra: Partial<DiagnosticEvaluationInput> = {},
): DiagnosticEvaluationInput {
  return {
    nowIso: NOW_ISO,
    timeZone: "UTC",
    child: { birthDateIso: "2025-06-01", activeDayMode: "home" },
    recentSleepLogs: logs,
    dailyTotalsLast14DaysMin: [],
    currentMetrics: {
      effectiveAgeDays: ageDays,
      chronicSleepDebtMin: 0,
      sleepBatteryPercent: 100,
      sleepNeedsProfile: "average",
      biologicalBedtimeMinFromMidnight: 1200,
    },
    ...extra,
  };
}

const THREE_WAKINGS = (putDownAt: string) =>
  wakings(putDownAt, [
    { offsetMin: 120, durationMin: 15, fed: true },
    { offsetMin: 300, durationMin: 15, fed: true },
    { offsetMin: 480, durationMin: 15, fed: true },
  ]);

describe("CAT1: próg wieku 6 mies.", () => {
  const frequent = nights(5).map((n) => ({ ...n, nightWakings: THREE_WAKINGS(n.putDownAt) }));

  it("w 4.–6. mies. częste pobudki to tylko informacja o normie", () => {
    const result = evaluateCat1SleepAssociations(frequent, 150);
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT1_AGE_NORMAL);
    expect(result.severity).toBe("info");
    expect(result.isTriggered).toBe(true);
  });

  it("od 6 mies. ten sam wzorzec to skojarzenia snu", () => {
    expect(evaluateCat1SleepAssociations(frequent, 185).diagnosisCode).toBe(
      DIAGNOSIS_CODES.CAT1_HIGH_INTERVENTION,
    );
  });

  it("poniżej 4 mies. nic nie zgłasza", () => {
    expect(evaluateCat1SleepAssociations(frequent, 110).isTriggered).toBe(false);
  });
});

describe("CAT2: przemęczenie wg spec. v2.0", () => {
  const crying = nights(3, (i) => ({
    fellAsleepAt: addMinutes(nights(3)[i]?.putDownAt ?? NOW_ISO, 25),
    mood: "crying",
  }));

  it("latencja >20 min + płacz + dług → przemęczenie, wcześniejsze kładzenie", () => {
    const result = evaluateCat2BedtimeResistance(crying, 75);
    expect(evaluateCat2BedtimeResistance(crying, 60).diagnosisCode).not.toBe(
      DIAGNOSIS_CODES.CAT2_OVERTIRED,
    );
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT2_OVERTIRED);
    expect(result.algorithmOverride?.wakeWindowOffsetMinutes).toBe(-20);
  });

  it("płacz bez długu nie wystarcza do przemęczenia", () => {
    expect(evaluateCat2BedtimeResistance(crying, 0).diagnosisCode).toBe(
      DIAGNOSIS_CODES.CAT2_OPTIMAL,
    );
  });
});

describe("CAT3: wczesne pobudki wg długości nocy", () => {
  it("noc ≥10,5 h → przesuwanie rytmu o 15 min co 2 dni", () => {
    const logs = nights(3, (i) => {
      const putDownAt = addMinutes("2026-04-13T17:30:00.000Z", -i * 24 * 60);
      return {
        putDownAt,
        fellAsleepAt: addMinutes(putDownAt, 10),
        wokeUpAt: addMinutes(putDownAt, 11 * 60 + 15), // 04:45
      };
    });
    const result = evaluateCat3EarlyWakingAndSplitNight(input(logs, 300));
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT3_EARLY_WAKING);
    expect(result.algorithmOverride).toEqual({ bedtimeFadingMinutes: 15, shiftEveryDays: 2 });
  });

  it("noc 9,5–10,5 h → łagodna informacja bez korekty", () => {
    const logs = nights(3, (i) => {
      const putDownAt = addMinutes("2026-04-13T18:30:00.000Z", -i * 24 * 60);
      return {
        putDownAt,
        fellAsleepAt: addMinutes(putDownAt, 10),
        wokeUpAt: addMinutes(putDownAt, 10 * 60 + 15), // 04:45, 10 h snu
      };
    });
    const result = evaluateCat3EarlyWakingAndSplitNight(input(logs, 300));
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT3_EARLY_WAKING_UNCLEAR);
    expect(result.algorithmOverride).toBeUndefined();
  });
});

describe("CAT4: NAP_TRANSITION_READY", () => {
  /**
   * Doby z dwiema drzemkami; druga z długim zasypianiem, gdy `resist`.
   *
   * @param {number} days - Liczba dób
   * @param {boolean} resist - Czy opór przed ostatnią drzemką
   * @returns {SleepLog[]} Drzemki
   */
  function twoNapDays(days: number, resist: boolean): SleepLog[] {
    return Array.from({ length: days }, (_, d) => {
      const date = new Date(new Date("2026-04-14T00:00:00.000Z").getTime() - d * DAY_MS)
        .toISOString()
        .slice(0, 10);
      return [9, 14].map((hour, i): SleepLog => {
        const putDownAt = `${date}T${String(hour).padStart(2, "0")}:00:00.000Z`;
        const latency = i === 1 && resist ? 30 : 5;
        return {
          id: `nap-${d}-${i}`,
          childId: "c",
          physiologicalDate: date,
          type: "nap",
          status: "completed",
          putDownAt,
          fellAsleepAt: addMinutes(putDownAt, latency),
          wokeUpAt: addMinutes(putDownAt, latency + 70),
          interventions: [],
          nightWakings: [],
        };
      });
    }).flat();
  }

  it("2→1 po 5 dniach oporu z rzędu w 12–18 mies.: drzemka +15 min co 3 dni", () => {
    const result = evaluateCat4ShortNapsAndTransitions(input(twoNapDays(5, true), 420));
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT4_TRANSITION_READY);
    expect(result.algorithmOverride).toEqual({ wakeWindowOffsetMinutes: 15, shiftEveryDays: 3 });
    expect(result.clinicalAction).toContain("12:00–12:30");
  });

  it("4 dni oporu to za mało", () => {
    const logs = [...twoNapDays(4, true), ...twoNapDays(6, false).slice(8)];
    expect(evaluateCat4ShortNapsAndTransitions(input(logs, 420)).diagnosisCode).toBe(
      DIAGNOSIS_CODES.CAT4_STABLE,
    );
  });

  it("poza wiekiem 12–18 mies. nie proponuje przejścia na 1 drzemkę", () => {
    expect(evaluateCat4ShortNapsAndTransitions(input(twoNapDays(5, true), 300)).diagnosisCode).toBe(
      DIAGNOSIS_CODES.CAT4_STABLE,
    );
  });
});

describe("CAT5: wybuch, nawrót, ząbkowanie i regresje", () => {
  const protest = (n: SleepLog) => ({
    ...n,
    nightWakings: wakings(n.putDownAt, [{ offsetMin: 200, durationMin: 20 }]),
  });

  it("ząbkowanie bez gorączki nie włącza trybu choroby", () => {
    const result = evaluateCat5RegressionsAndCrisis(
      input(nights(3), 300, { todayContext: { tags: ["ząbkowanie"] } }),
    );
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT5_TEETHING);
    expect(result.algorithmOverride?.recommendedDayMode).toBeUndefined();
    expect(result.explanation).toMatch(/gorączka/i);
  });

  it("choroba: powrót do planu 3–5 dni po objawach", () => {
    const result = evaluateCat5RegressionsAndCrisis(
      input(nights(3), 300, { todayContext: { tags: ["szczepienie"] } }),
    );
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT5_ILLNESS);
    expect(result.clinicalAction).toContain("3–5 dni");
  });

  it("wybuch tylko w nocach 2–5 planu", () => {
    const planFrom = (count: number) => ({
      child: {
        birthDateIso: "2025-06-01",
        activeDayMode: "home" as const,
        currentPlanStartDateIso: addMinutes(nights(count)[count - 1]?.putDownAt ?? NOW_ISO, -60),
      },
    });
    const at = (count: number) =>
      evaluateCat5RegressionsAndCrisis(input(nights(8).map(protest), 300, planFrom(count)))
        .diagnosisCode;
    expect(at(1)).not.toBe(DIAGNOSIS_CODES.CAT5_EXTINCTION_BURST);
    expect(at(2)).toBe(DIAGNOSIS_CODES.CAT5_EXTINCTION_BURST);
    expect(at(5)).toBe(DIAGNOSIS_CODES.CAT5_EXTINCTION_BURST);
    expect(at(6)).not.toBe(DIAGNOSIS_CODES.CAT5_EXTINCTION_BURST);
  });

  it("plan sprzed 20 dni i spokojne noce to stabilny okres (bez okna 14–28 dni)", () => {
    const result = evaluateCat5RegressionsAndCrisis(
      input(nights(10), 300, {
        child: {
          birthDateIso: "2025-06-01",
          activeDayMode: "home",
          currentPlanStartDateIso: "2026-03-26T12:00:00.000Z",
        },
      }),
    );
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT5_STABLE);
  });

  it("spontaniczny nawrót: po poprawie ostatnie 2 noce gorsze", () => {
    const logs = nights(10).map((n, i) =>
      i < 2 ? { ...n, nightWakings: THREE_WAKINGS(n.putDownAt) } : n,
    );
    const result = evaluateCat5RegressionsAndCrisis(
      input(logs, 300, {
        child: {
          birthDateIso: "2025-06-01",
          activeDayMode: "home",
          currentPlanStartDateIso: "2026-04-01T12:00:00.000Z",
        },
      }),
    );
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT5_SPONTANEOUS_RELAPSE);
  });

  const worsening = nights(10).map((n, i) =>
    i < 5 ? { ...n, nightWakings: THREE_WAKINGS(n.putDownAt) } : n,
  );

  it("zmiana ok. 4. mies. tylko przy wzroście pobudek i jako trwała zmiana", () => {
    const stable = evaluateCat5RegressionsAndCrisis(
      input(
        nights(10).map((n) => ({ ...n, nightWakings: THREE_WAKINGS(n.putDownAt) })),
        120,
      ),
    );
    expect(stable.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT5_STABLE);

    const result = evaluateCat5RegressionsAndCrisis(input(worsening, 150));
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT5_FOUR_MONTH);
    expect(result.explanation).toContain("trwała");
  });

  it("regres 8–10 mies.: 2–4 tygodnie, ponad miesiąc → lekarz", () => {
    const result = evaluateCat5RegressionsAndCrisis(input(worsening, 270));
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT5_TRANSIENT_REGRESSION);
    expect(result.explanation).toContain("2–4 tygodnie");
    expect(result.clinicalAction).toContain("ponad miesiąc");
  });
});

describe("CAT6: noworodek", () => {
  it("drzemki >2 h → budzenie po 2 godzinach", () => {
    const longNaps = [0, 1].map(
      (d): SleepLog => ({
        id: `ln-${d}`,
        childId: "c",
        physiologicalDate: "2026-04-14",
        type: "nap",
        status: "completed",
        putDownAt: addMinutes("2026-04-14T10:00:00.000Z", -d * 24 * 60),
        fellAsleepAt: addMinutes("2026-04-14T10:05:00.000Z", -d * 24 * 60),
        wokeUpAt: addMinutes("2026-04-14T12:45:00.000Z", -d * 24 * 60),
        interventions: [],
        nightWakings: [],
      }),
    );
    const result = evaluateCat6NewbornCare(60, longNaps);
    expect(result.clinicalAction).toContain("po 2 godzinach");
    expect(result.explanation).not.toMatch(/melatonin/i);
    expect(evaluateCat6NewbornCare(60).clinicalAction).not.toContain("po 2 godzinach");
  });
});

describe("CAT7: karmienie dla uspokojenia wg spec. v2.0", () => {
  it("rzadkie, długie karmienia to nie nawyk", () => {
    const logs = nights(3).map((n) => ({
      ...n,
      nightWakings: wakings(n.putDownAt, [
        { offsetMin: 240, durationMin: 20, fed: true },
        { offsetMin: 480, durationMin: 20, fed: true },
      ]),
    }));
    expect(evaluateCat7NightWeaning(input(logs, 300)).diagnosisCode).toBe(
      DIAGNOSIS_CODES.CAT7_BALANCED,
    );
  });

  it("karmienia co ≤60 min piersią: łagodne tempo i ostrzeżenie o laktacji", () => {
    const logs = nights(3).map((n) => ({
      ...n,
      nightWakings: wakings(n.putDownAt, [
        { offsetMin: 240, durationMin: 15, fed: true },
        { offsetMin: 285, durationMin: 15, fed: true },
      ]),
    }));
    const young = evaluateCat7NightWeaning(input(logs, 220));
    expect(young.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT7_HABITUAL_FEEDING);
    expect(young.severity).toBe("low");
    expect(young.clinicalAction).toContain("laktację");
    expect(evaluateCat7NightWeaning(input(logs, 300)).severity).toBe("medium");
  });

  it("butelka: bez ostrzeżenia o laktacji i bez podawania wody", () => {
    const logs = nights(3).map((n) => ({
      ...n,
      nightWakings: wakings(n.putDownAt, [
        { offsetMin: 240, durationMin: 5, fed: true, breast: false },
        { offsetMin: 400, durationMin: 5, fed: true, breast: false },
      ]),
    }));
    const result = evaluateCat7NightWeaning(input(logs, 300));
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT7_HABITUAL_FEEDING);
    expect(result.clinicalAction).not.toMatch(/laktac|wod/i);
  });
});

describe("Teksty drzew", () => {
  it("nie używają języka kortyzolu, diagnozy ani „klinicznego”", () => {
    const scenarios: DiagnosticEvaluationInput[] = [
      input(
        nights(5).map((n) => ({ ...n, nightWakings: THREE_WAKINGS(n.putDownAt) })),
        60,
      ),
      input(
        nights(5).map((n) => ({ ...n, nightWakings: THREE_WAKINGS(n.putDownAt) })),
        200,
      ),
      input(nights(10), 300, { todayContext: { tags: ["gorączka"] } }),
    ];
    for (const scenario of scenarios) {
      for (const r of evaluateAll7DiagnosticCategories(scenario)) {
        const text = `${r.title} ${r.explanation} ${r.clinicalAction}`;
        expect(text).not.toMatch(/kortyzol|diagnoz|klinicz/i);
      }
    }
  });
});
