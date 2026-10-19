import { describe, expect, it } from "vitest";
import { aggregateDailySleepSummaries } from "@/lib/sleep-summary";
import type { SleepLogRecord } from "@/lib/types/database";
import {
  applyObservedNapsCount,
  calculateChronicDrive,
  calculateCircadianParameters,
  calculateEffectiveAgeDays,
  DEFAULT_SLEEP_MATRIX,
  getAgeBracket,
  predictNextSleepSlot,
  resolveCircadianWeight,
  resolveInsightDayAdjustments,
  suggestNapWakeTime,
  validateSleepMatrix,
} from "../index";
import type { AgeBracketConfig, NextSleepSlotParams } from "../types";

/** Doby kalibracyjne (najnowsza pierwsza) z samych sum snu. */
function days(...totals: number[]) {
  return totals.map((totalSleepMin) => ({ totalSleepMin, isIllOrIgnored: false }));
}

/** Parametry prognozy snu nocnego dla dziecka ok. 6,5 mies. (pora snu 19:30 UTC). */
function bedtimeParams(overrides: Partial<NextSleepSlotParams> = {}): NextSleepSlotParams {
  const bracket = getAgeBracket(200);
  return {
    lastWakeUpIso: "2026-04-10T17:00:00.000Z",
    previousNapDurationMin: 60,
    napIndexToday: bracket.targetNapsCount,
    effectiveAgeDays: 200,
    bracket,
    chronicSleepDebtMin: 0,
    dayMode: "home",
    insightWwOffsetMin: 0,
    biologicalBedtimeMinFromMidnight: 1170,
    timeZone: "UTC",
    ...overrides,
  };
}

describe("Etap A: matryca wiekowa", () => {
  it("jest ciągła i przechodzi walidację panelu admina", () => {
    expect(validateSleepMatrix(DEFAULT_SLEEP_MATRIX).ok).toBe(true);
  });

  it("przechodzi z 2 na 1 drzemkę dopiero po ok. 15. miesiącu (450. dzień)", () => {
    expect(getAgeBracket(420).targetNapsCount).toBe(2);
    expect(getAgeBracket(450).targetNapsCount).toBe(2);
    expect(getAgeBracket(451).targetNapsCount).toBe(1);
    expect(getAgeBracket(420).minNapsCount).toBe(1);
  });

  it("nie ma twardego limitu drzemki 90 min, a limity po 1. roku nie maleją", () => {
    expect(DEFAULT_SLEEP_MATRIX.every((b) => b.maxSingleNapMin >= 120)).toBe(true);
    const toddlers = DEFAULT_SLEEP_MATRIX.filter((b) => b.minAgeDays >= 391);
    for (let i = 1; i < toddlers.length; i += 1) {
      expect(toddlers[i]?.maxSingleNapMin).toBeGreaterThanOrEqual(
        toddlers[i - 1]?.maxSingleNapMin ?? 0,
      );
    }
  });

  it("opisuje liczbę drzemek zakresem: 3–5 u noworodka, 2–3 od 4. mies., 0–1 w 3. roku", () => {
    expect(getAgeBracket(10).minNapsCount).toBe(3);
    expect(getAgeBracket(80).minNapsCount).toBe(3);
    expect(getAgeBracket(130).minNapsCount).toBe(2);
    expect(getAgeBracket(130).targetNapsCount).toBe(3);
    expect(getAgeBracket(900).minNapsCount).toBe(0);
  });

  it("zawiera normy pobudek nocnych (Galland 2012) dla każdego przedziału", () => {
    for (const bracket of DEFAULT_SLEEP_MATRIX) {
      expect(bracket.nightWakingsMean).toBeGreaterThan(0);
      expect(bracket.nightWakingsMean).toBeLessThanOrEqual(bracket.nightWakingsUpperNorm ?? 0);
    }
    expect(getAgeBracket(30).nightWakingsUpperNorm).toBe(3.4);
    expect(getAgeBracket(600).nightWakingsUpperNorm).toBe(2.5);
  });

  it("odrzuca nadpisanie, w którym minimum drzemek przekracza docelową liczbę", () => {
    const broken = DEFAULT_SLEEP_MATRIX.map((b, index) =>
      index === 0 ? { ...b, minNapsCount: b.targetNapsCount + 1 } : b,
    );
    expect(validateSleepMatrix(broken).ok).toBe(false);
  });

  it("koryguje wiek dopiero powyżej 21 dni przed terminem (37+0 tc. to poród o czasie)", () => {
    const birth = "2026-01-01T00:00:00.000Z";
    const now = "2026-04-11T00:00:00.000Z"; // 100 dni
    expect(calculateEffectiveAgeDays(birth, "2026-01-22T00:00:00.000Z", now)).toBe(100);
    expect(calculateEffectiveAgeDays(birth, "2026-01-23T00:00:00.000Z", now)).toBe(78);
  });
});

describe("Etap A: liczba drzemek z danych dziecka", () => {
  const toddler = getAgeBracket(900);

  it("przechodzi w tryb bez drzemki po ≥5 z 7 dób bez drzemki", () => {
    const observed = [0, 0, 1, 0, 0, 1, 0].map((napCount) => ({ napCount }));
    const adjusted = applyObservedNapsCount(toddler, observed);
    expect(adjusted.targetNapsCount).toBe(0);
    expect(adjusted.maxDaytimeSleepMin).toBe(0);
  });

  it("zostaje przy matrycy, gdy dni bez drzemki są tylko 4 albo brak danych", () => {
    const observed = [0, 0, 1, 0, 1, 1, 0].map((napCount) => ({ napCount }));
    expect(applyObservedNapsCount(toddler, observed)).toBe(toddler);
    expect(applyObservedNapsCount(toddler, [])).toBe(toddler);
  });

  it("dopuszcza 2 drzemki od 4. miesiąca, gdy dziecko samo tak śpi", () => {
    const observed = [2, 2, 2, 3, 2, 2, 3].map((napCount) => ({ napCount }));
    expect(applyObservedNapsCount(getAgeBracket(130), observed).targetNapsCount).toBe(2);
  });

  it("nie zmienia przedziału bez zakresu drzemek (np. starsze nadpisanie admina)", () => {
    const { minNapsCount: _ignored, ...legacy } = toddler;
    const observed = [0, 0, 0, 0, 0, 0, 0].map((napCount) => ({ napCount }));
    expect(applyObservedNapsCount(legacy as AgeBracketConfig, observed).targetNapsCount).toBe(1);
  });

  it("w dniu bez drzemki prognozuje od razu sen nocny o przewidywanej porze", () => {
    const bracket = applyObservedNapsCount(
      toddler,
      [0, 0, 0, 0, 0, 0, 0].map((napCount) => ({ napCount })),
    );
    const circadian = calculateCircadianParameters({
      morningWakeTimesLast5DaysMinutesFromMidnight: [420],
      bracket,
    });
    const slot = predictNextSleepSlot({
      lastWakeUpIso: "2026-04-10T07:00:00.000Z",
      previousNapDurationMin: null,
      napIndexToday: 0,
      effectiveAgeDays: 900,
      bracket,
      chronicSleepDebtMin: 0,
      dayMode: "home",
      insightWwOffsetMin: 0,
      biologicalBedtimeMinFromMidnight: circadian.biologicalBedtimeMinFromMidnight,
      timeZone: "UTC",
    });
    expect(circadian.biologicalBedtime).toBe("19:30");
    expect(slot.sweetSpotIso).toBe("2026-04-10T19:30:00.000Z");
    expect(slot.reasonCode).toBe("NO_NAP_DAY_BEDTIME");
  });
});

describe("Etap B: dług snu i norma indywidualna", () => {
  const infant = getAgeBracket(200); // mediana 825 min

  it("liczy dług jako średni niedobór z 3 dób, bez mnożnika ×3,5", () => {
    const result = calculateChronicDrive(
      days(780, 780, 780, 840, 840, 840, 840, 840, 840, 840),
      infant,
    );
    expect(result.individualSleepNeedMin).toBe(840);
    expect(result.chronicSleepDebtMin).toBe(60);
  });

  it("niedobór sprzed 4 i więcej dób nie zwiększa długu (kompensacja w ok. 24 h)", () => {
    const result = calculateChronicDrive(
      days(840, 840, 840, 600, 600, 840, 840, 840, 840, 840),
      infant,
    );
    expect(result.chronicSleepDebtMin).toBe(0);
  });

  it("przy mniej niż 7 dobach używa mediany wieku", () => {
    const result = calculateChronicDrive(days(700, 700, 700, 700, 700, 700), infant);
    expect(result.individualSleepNeedMin).toBe(825);
    expect(result.sleepNeedsProfile).toBe("average");
  });

  it("odrzuca z normy dzień odbicia: drzemka >150 min po długu >120 min", () => {
    const base = [900, 900, 650, 650, 650, 900, 900, 650];
    const withRebound = base.map((totalSleepMin, index) => ({
      totalSleepMin,
      isIllOrIgnored: false,
      nightSleepMin: 600, // noc w normie, więc liczy się tylko długa drzemka
      longestNapMin: index === 1 ? 160 : 90,
    }));
    const withoutRebound = withRebound.map((day) => ({ ...day, longestNapMin: 90 }));
    expect(calculateChronicDrive(withRebound, infant).individualSleepNeedMin).toBe(650);
    expect(calculateChronicDrive(withoutRebound, infant).individualSleepNeedMin).toBe(775);
  });

  it("odrzuca z normy dzień oznaczony przez rodzica jako odsypianie", () => {
    const totals = [800, 900, 800, 900, 800, 900, 800, 900];
    const flagged = totals.map((totalSleepMin, index) => ({
      totalSleepMin,
      isIllOrIgnored: false,
      isRebound: index === 1,
    }));
    expect(calculateChronicDrive(flagged, infant).individualSleepNeedMin).toBe(800);
    expect(calculateChronicDrive(days(...totals), infant).individualSleepNeedMin).toBe(850);
  });

  it("nadaje profil potrzeb dopiero poza ±1 SD wieku (90 min niemowlę, 60 min maluch)", () => {
    expect(calculateChronicDrive(days(...Array(7).fill(905)), infant).sleepNeedsProfile).toBe(
      "average",
    );
    expect(calculateChronicDrive(days(...Array(7).fill(915)), infant).sleepNeedsProfile).toBe(
      "high_sleep_needs",
    );
    const toddler = getAgeBracket(600); // mediana 765 min
    expect(calculateChronicDrive(days(...Array(7).fill(830)), toddler).sleepNeedsProfile).toBe(
      "high_sleep_needs",
    );
  });
});

describe("Etap B: rytm dobowy", () => {
  it("włącza rytm dobowy rampą od 10. do 16. tygodnia", () => {
    expect(resolveCircadianWeight(60)).toBe(0);
    expect(resolveCircadianWeight(91)).toBeCloseTo(0.5, 2);
    expect(resolveCircadianWeight(112)).toBe(1);
  });

  it("w 13. tygodniu przesuwa sen z WMZ tylko częściowo", () => {
    const bracket = getAgeBracket(91);
    const base = {
      lastWakeUpIso: "2026-04-10T16:20:00.000Z",
      previousNapDurationMin: 60,
      napIndexToday: bracket.targetNapsCount,
      bracket,
      chronicSleepDebtMin: 0,
      dayMode: "home" as const,
      insightWwOffsetMin: 0,
      biologicalBedtimeMinFromMidnight: 1170,
      timeZone: "UTC",
    };
    // Okno 120 min → 18:20, w WMZ 18:00–19:00; pełne przesunięcie to 70 min
    const partial = predictNextSleepSlot({ ...base, effectiveAgeDays: 91 });
    const full = predictNextSleepSlot({ ...base, effectiveAgeDays: 112 });
    const none = predictNextSleepSlot({ ...base, effectiveAgeDays: 70 });
    expect(full.sweetSpotIso).toBe("2026-04-10T19:30:00.000Z");
    expect(partial.sweetSpotIso).toBe("2026-04-10T18:55:00.000Z");
    expect(none.sweetSpotIso).toBe("2026-04-10T18:20:00.000Z");
  });

  it("od 16. tygodnia nie planuje snu nocnego później niż 30 min po przewidywanej porze", () => {
    const slot = predictNextSleepSlot(bedtimeParams()); // 17:00 + 195 min = 20:15
    expect(slot.sweetSpotIso).toBe("2026-04-10T20:00:00.000Z");
    expect(slot.reasonCode).toBe("CIRCADIAN_BEDTIME_LATE_CAP");
  });

  it("nie skraca wieczornego okna poniżej porannego minimum", () => {
    const slot = predictNextSleepSlot(bedtimeParams({ lastWakeUpIso: "2026-04-10T19:00:00.000Z" }));
    expect(slot.targetWakeWindowMin).toBe(getAgeBracket(200).wwMinMorning);
  });

  it("miesza porę z kotwicy porannej z faktycznymi porami zaśnięcia (≥3 noce)", () => {
    const bracket = getAgeBracket(200);
    const wakes = [420, 420, 420, 420, 420];
    const formulaOnly = calculateCircadianParameters({
      morningWakeTimesLast5DaysMinutesFromMidnight: wakes,
      bracket,
    });
    const withBedtimes = calculateCircadianParameters({
      morningWakeTimesLast5DaysMinutesFromMidnight: wakes,
      bedtimesLast5DaysMinutesFromMidnight: [1230, 1230, 1230],
      bracket,
    });
    const tooFew = calculateCircadianParameters({
      morningWakeTimesLast5DaysMinutesFromMidnight: wakes,
      bedtimesLast5DaysMinutesFromMidnight: [1230, 1230],
      bracket,
    });
    expect(formulaOnly.biologicalBedtime).toBe("19:30");
    expect(withBedtimes.biologicalBedtime).toBe("20:00");
    expect(tooFew.biologicalBedtime).toBe("19:30");
  });

  it("stosuje bedtime fading i nap capping z drzew w granicach limitów", () => {
    const bracket = getAgeBracket(200); // wwMaxEvening 195
    const params = { morningWakeTimesLast5DaysMinutesFromMidnight: [420], bracket };
    expect(calculateCircadianParameters({ ...params, bedtimeShiftMin: 15 }).biologicalBedtime).toBe(
      "19:45",
    );
    expect(calculateCircadianParameters({ ...params, bedtimeShiftMin: 90 }).biologicalBedtime).toBe(
      "20:00",
    );
    expect(calculateCircadianParameters(params).latestLastNapEndAt).toBe("16:15");
    expect(
      calculateCircadianParameters({ ...params, daytimeSleepCapOffsetMin: -30 }).latestLastNapEndAt,
    ).toBe("15:45");
    expect(
      calculateCircadianParameters({ ...params, daytimeSleepCapOffsetMin: -200 })
        .latestLastNapEndAt,
    ).toBe("15:15");
  });
});

describe("Etap B: korekty z wniosku i sugestia skrócenia drzemki", () => {
  it("czyta tylko klucze drzew diagnostycznych", () => {
    expect(resolveInsightDayAdjustments(null)).toEqual({
      bedtimeShiftMin: 0,
      daytimeSleepCapOffsetMin: 0,
    });
    expect(
      resolveInsightDayAdjustments({
        algorithm_override_json: {
          bedtimeFadingMinutes: 15,
          maxDaytimeSleepCapMinutes: -30,
          wwOffsetMin: -90,
        },
      }),
    ).toEqual({ bedtimeShiftMin: 15, daytimeSleepCapOffsetMin: -30 });
  });

  it("proponuje pobudkę z drzemki tylko przy zaleceniu drzewa, z minimum 30 min", () => {
    const bracket = getAgeBracket(200); // sen dzienny 195, drzemka 120
    const base = { napStartIso: "2026-04-10T13:00:00.000Z", bracket };
    expect(
      suggestNapWakeTime({ ...base, daytimeSleepBeforeNapMin: 120, daytimeSleepCapOffsetMin: 0 }),
    ).toBeNull();
    expect(
      suggestNapWakeTime({ ...base, daytimeSleepBeforeNapMin: 120, daytimeSleepCapOffsetMin: -30 }),
    ).toBe("2026-04-10T13:45:00.000Z");
    expect(
      suggestNapWakeTime({ ...base, daytimeSleepBeforeNapMin: 200, daytimeSleepCapOffsetMin: -30 }),
    ).toBe("2026-04-10T13:30:00.000Z");
  });
});

describe("Podsumowania dobowe", () => {
  it("liczą drzemki, najdłuższą drzemkę, sen dzienny i nocny oraz odsypianie", () => {
    const log = (
      type: "nap" | "night",
      date: string,
      start: string,
      end: string,
      rebound = false,
    ): SleepLogRecord => ({
      id: `${type}-${start}`,
      child_id: "c1",
      physiological_date: date,
      type,
      status: "completed",
      put_down_at: start,
      fell_asleep_at: start,
      woke_up_at: end,
      is_rebound_sleep: rebound,
      ignore_in_calibration: false,
      created: start,
      updated: end,
    });
    const [day] = aggregateDailySleepSummaries([
      log("nap", "2026-04-10", "2026-04-10T09:00:00.000Z", "2026-04-10T10:00:00.000Z"),
      log("nap", "2026-04-10", "2026-04-10T13:00:00.000Z", "2026-04-10T14:30:00.000Z", true),
      log("night", "2026-04-10", "2026-04-10T19:00:00.000Z", "2026-04-11T06:00:00.000Z"),
    ]);
    expect(day).toMatchObject({
      totalSleepMin: 810,
      daytimeSleepMin: 150,
      nightSleepMin: 660,
      napCount: 2,
      longestNapMin: 90,
      isRebound: true,
    });
  });
});
