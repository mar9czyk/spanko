import { describe, expect, it } from "vitest";
import {
  calculateChronicDrive,
  calculateCircadianParameters,
  calculateEffectiveAgeDays,
  DEFAULT_SLEEP_MATRIX,
  DIAGNOSIS_CODES,
  evaluateAll7DiagnosticCategories,
  evaluateCat1SleepAssociations,
  evaluateCat2BedtimeResistance,
  evaluateCat3EarlyWakingAndSplitNight,
  evaluateCat4ShortNapsAndTransitions,
  evaluateCat5RegressionsAndCrisis,
  evaluateCat6NewbornCare,
  evaluateCat7NightWeaning,
  getAgeBracket,
  predictNextSleepSlot,
} from "../index";
import type { DiagnosticEvaluationInput, SleepLog } from "../types";

describe("Sleep Engine: 3 Napędy Snu", () => {
  it("posiada kompletną matrycę wiekową DEFAULT_SLEEP_MATRIX dla 0-36 miesięcy", () => {
    expect(DEFAULT_SLEEP_MATRIX).toHaveLength(12);
    expect(DEFAULT_SLEEP_MATRIX[0]?.minAgeDays).toBe(0);
    expect(DEFAULT_SLEEP_MATRIX[DEFAULT_SLEEP_MATRIX.length - 1]?.maxAgeDays).toBe(1095);
  });

  it("oblicza wiek efektywny bez korekty dla porodów o czasie i wcześniaków <21 dni", () => {
    const birth = "2026-01-01T00:00:00.000Z";
    const due10Days = "2026-01-11T00:00:00.000Z";
    const now = "2026-04-11T00:00:00.000Z"; // 100 dni

    const ageNormal = calculateEffectiveAgeDays(birth, null, now);
    expect(ageNormal).toBe(100);

    const ageMildPreterm = calculateEffectiveAgeDays(birth, due10Days, now);
    expect(ageMildPreterm).toBe(100);
  });

  it("koryguje wiek dla wcześniaków urodzonych >=21 dni przed terminem", () => {
    const birth = "2026-01-01T00:00:00.000Z";
    const due30Days = "2026-01-31T00:00:00.000Z";
    const now = "2026-04-11T00:00:00.000Z"; // 100 dni metrykalnych

    const effectiveAge = calculateEffectiveAgeDays(birth, due30Days, now);
    expect(effectiveAge).toBe(70);
  });

  it("znajduje odpowiedni przedział z matrycy wiekowej", () => {
    const bracketNewborn = getAgeBracket(20);
    expect(bracketNewborn.targetNapsCount).toBe(5);

    const bracketFourMonths = getAgeBracket(130);
    expect(bracketFourMonths.targetNapsCount).toBe(3);

    const bracketToddler = getAgeBracket(800);
    expect(bracketToddler.targetNapsCount).toBe(1);
  });

  it("filtruje noce odsypiania (Homeostatic Rebound) i wylicza baterię snu", () => {
    const bracket = getAgeBracket(180); // mediana 840 min
    const dailyTotals = [
      { physiologicalDate: "2026-04-01", totalSleepMin: 830, isIllOrIgnored: false },
      { physiologicalDate: "2026-04-02", totalSleepMin: 850, isIllOrIgnored: false },
      { physiologicalDate: "2026-04-03", totalSleepMin: 820, isIllOrIgnored: false },
      { physiologicalDate: "2026-04-04", totalSleepMin: 1100, isIllOrIgnored: false }, // Rebound (> 840 + 100)
      { physiologicalDate: "2026-04-05", totalSleepMin: 840, isIllOrIgnored: false },
      { physiologicalDate: "2026-04-06", totalSleepMin: 835, isIllOrIgnored: false },
      { physiologicalDate: "2026-04-07", totalSleepMin: 845, isIllOrIgnored: false },
    ];

    const result = calculateChronicDrive(dailyTotals, bracket);
    expect(result.individualSleepNeedMin).toBeLessThan(900);
    expect(result.sleepBatteryPercent).toBeGreaterThanOrEqual(80);
    expect(result.sleepNeedsProfile).toBe("average");
  });

  it("wylicza parametry okołodobowe i Strefę Zakazaną (WMZ)", () => {
    const bracket = getAgeBracket(200);
    const circadian = calculateCircadianParameters({
      morningWakeTimesLast5DaysMinutesFromMidnight: [420, 420, 420], // 07:00
      bracket,
    });

    expect(circadian.circadianAnchorWakeTime).toBe("07:00");
    expect(circadian.forbiddenZoneStart).toBeDefined();
    expect(circadian.forbiddenZoneEnd).toBeDefined();
    expect(circadian.latestLastNapEndAt).toBeDefined();
  });

  it("aplikuje kary za mikro-drzemkę i bonusy za długą drzemkę", () => {
    const bracket = getAgeBracket(200); // wwMin 135, wwMax 195
    const wakeUpIso = "2026-04-10T10:00:00.000Z";

    const microNapSlot = predictNextSleepSlot({
      lastWakeUpIso: wakeUpIso,
      previousNapDurationMin: 15,
      napIndexToday: 1,
      effectiveAgeDays: 200,
      bracket,
      chronicSleepDebtMin: 0,
      dayMode: "home",
      insightWwOffsetMin: 0,
      biologicalBedtimeMinFromMidnight: 1200,
    });
    expect(microNapSlot.reasonCode).toBe("MICRO_NAP_PENALTY_35PCT");

    const restorativeNapSlot = predictNextSleepSlot({
      lastWakeUpIso: wakeUpIso,
      previousNapDurationMin: 100,
      napIndexToday: 1,
      effectiveAgeDays: 200,
      bracket,
      chronicSleepDebtMin: 0,
      dayMode: "home",
      insightWwOffsetMin: 0,
      biologicalBedtimeMinFromMidnight: 1200,
    });
    expect(restorativeNapSlot.reasonCode).toBe("RESTORATIVE_NAP_BONUS");
  });

  it("tworzy miękki przedział Compass Window dla Anti-Orthosomnia Mode", () => {
    const bracket = getAgeBracket(150);
    const wakeUpIso = "2026-04-10T08:00:00.000Z";

    const slot = predictNextSleepSlot({
      lastWakeUpIso: wakeUpIso,
      previousNapDurationMin: 60,
      napIndexToday: 0,
      effectiveAgeDays: 150,
      bracket,
      chronicSleepDebtMin: 0,
      dayMode: "home",
      insightWwOffsetMin: 0,
      biologicalBedtimeMinFromMidnight: 1200,
    });

    const sweetSpotTime = new Date(slot.sweetSpotIso).getTime();
    const startTime = new Date(slot.compassWindowStartIso).getTime();
    const endTime = new Date(slot.compassWindowEndIso).getTime();

    expect(sweetSpotTime - startTime).toBe(15 * 60 * 1000);
    expect(endTime - sweetSpotTime).toBe(15 * 60 * 1000);
  });
});

describe("Sleep Engine: 7 Deterministycznych Drzew Diagnostycznych", () => {
  const dummyNightLog: SleepLog = {
    id: "log-1",
    childId: "child-1",
    physiologicalDate: "2026-04-10",
    type: "night",
    status: "completed",
    putDownAt: "2026-04-10T19:30:00.000Z",
    fellAsleepAt: "2026-04-10T19:45:00.000Z",
    wokeUpAt: "2026-04-11T07:00:00.000Z",
    interventions: ["independent"],
    mood: "easy",
    nightWakings: [],
  };

  it("CAT1: wykrywa silne asocjacje zasypiania przy częstych pobudkach i karmieniu/bujaniu", () => {
    const logWithHighAssoc: SleepLog = {
      ...dummyNightLog,
      nightWakings: [
        { wokeAt: "23:00", estimatedDurationMin: 15, fedMilk: true, interventions: ["breast"] },
        { wokeAt: "02:00", estimatedDurationMin: 20, fedMilk: true, interventions: ["bouncing"] },
        { wokeAt: "04:30", estimatedDurationMin: 15, fedMilk: true, interventions: ["breast"] },
      ],
    };

    const result = evaluateCat1SleepAssociations([logWithHighAssoc]);
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT1_HIGH_INTERVENTION);
    expect(result.isTriggered).toBe(true);
    expect(result.severity).toBe("high");
  });

  it("CAT2: różnicuje przemęczenie od niedomęczenia z Bedtime Fading", () => {
    const overtiredLog: SleepLog = {
      ...dummyNightLog,
      putDownAt: "2026-04-10T19:00:00.000Z",
      fellAsleepAt: "2026-04-10T19:40:00.000Z",
      mood: "crying",
    };
    const overtiredResult = evaluateCat2BedtimeResistance([overtiredLog], 50);
    expect(overtiredResult.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT2_OVERTIRED);

    const undertiredLog: SleepLog = {
      ...dummyNightLog,
      putDownAt: "2026-04-10T19:00:00.000Z",
      fellAsleepAt: "2026-04-10T19:45:00.000Z",
      mood: "easy",
    };
    const undertiredResult = evaluateCat2BedtimeResistance([undertiredLog], 10);
    expect(undertiredResult.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT2_UNDERTIRED);
    expect(undertiredResult.algorithmOverride?.bedtimeFadingMinutes).toBe(20);
  });

  it("CAT3: wykrywa zjawisko Split Night (wybudzenie w nocy >=60 min)", () => {
    const splitNightLog: SleepLog = {
      ...dummyNightLog,
      nightWakings: [
        {
          wokeAt: "01:30",
          estimatedDurationMin: 75,
          fedMilk: false,
          interventions: ["room_presence"],
        },
      ],
    };

    const mockInput: DiagnosticEvaluationInput = {
      child: { birthDateIso: "2025-06-01", activeDayMode: "home" },
      recentSleepLogs: [splitNightLog],
      dailyTotalsLast14DaysMin: [],
      currentMetrics: {
        effectiveAgeDays: 300,
        chronicSleepDebtMin: 0,
        sleepBatteryPercent: 100,
        sleepNeedsProfile: "average",
        biologicalBedtimeMinFromMidnight: 1200,
      },
    };

    const result = evaluateCat3EarlyWakingAndSplitNight(mockInput);
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT3_SPLIT_NIGHT);
    expect(result.algorithmOverride?.maxDaytimeSleepCapMinutes).toBe(-30);
  });

  it("CAT3: rozpoznaje wczesną pobudkę z przemęczenia w drzewie Flynn-Evans", () => {
    const earlyWakeLog: SleepLog = {
      ...dummyNightLog,
      wokeUpAt: "2026-04-11T04:45:00.000Z",
    };

    const mockInput: DiagnosticEvaluationInput = {
      child: { birthDateIso: "2025-06-01", activeDayMode: "home" },
      recentSleepLogs: [earlyWakeLog],
      dailyTotalsLast14DaysMin: [],
      currentMetrics: {
        effectiveAgeDays: 200,
        chronicSleepDebtMin: 80,
        sleepBatteryPercent: 65,
        sleepNeedsProfile: "average",
        biologicalBedtimeMinFromMidnight: 1200,
      },
    };

    const result = evaluateCat3EarlyWakingAndSplitNight(mockInput);
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT2_OVERTIRED);
  });

  it("CAT4: klasyfikuje krótkie drzemki jako rozwojowe u dzieci <6 miesięcy", () => {
    const shortNap: SleepLog = {
      id: "nap-1",
      childId: "c1",
      physiologicalDate: "2026-04-10",
      type: "nap",
      status: "completed",
      putDownAt: "2026-04-10T09:00:00.000Z",
      fellAsleepAt: "2026-04-10T09:05:00.000Z",
      wokeUpAt: "2026-04-10T09:40:00.000Z", // 35 min
      interventions: [],
      mood: "easy",
      nightWakings: [],
    };

    const mockInput: DiagnosticEvaluationInput = {
      child: { birthDateIso: "2026-01-01", activeDayMode: "home" },
      recentSleepLogs: [shortNap, shortNap, shortNap],
      dailyTotalsLast14DaysMin: [],
      currentMetrics: {
        effectiveAgeDays: 100,
        chronicSleepDebtMin: 0,
        sleepBatteryPercent: 100,
        sleepNeedsProfile: "average",
        biologicalBedtimeMinFromMidnight: 1200,
      },
    };

    const result = evaluateCat4ShortNapsAndTransitions(mockInput);
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT4_DEVELOPMENTAL);
    expect(result.severity).toBe("info");
  });

  it("CAT5: aktywuje detektor Extinction Burst w oknie 14-28 dni po wdrożeniu planu", () => {
    const twentyDaysAgo = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const mockInput: DiagnosticEvaluationInput = {
      child: {
        birthDateIso: "2025-06-01",
        activeDayMode: "home",
        currentPlanStartDateIso: twentyDaysAgo,
      },
      recentSleepLogs: [dummyNightLog],
      dailyTotalsLast14DaysMin: [],
      currentMetrics: {
        effectiveAgeDays: 300,
        chronicSleepDebtMin: 0,
        sleepBatteryPercent: 100,
        sleepNeedsProfile: "average",
        biologicalBedtimeMinFromMidnight: 1200,
      },
    };

    const result = evaluateCat5RegressionsAndCrisis(mockInput);
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT5_EXTINCTION_BURST);
    expect(result.severity).toBe("high");
  });

  it("CAT5: wykrywa ząbkowanie lub chorobę i sugeruje tryb ochronny", () => {
    const mockInput: DiagnosticEvaluationInput = {
      child: { birthDateIso: "2025-06-01", activeDayMode: "home" },
      todayContext: { tags: ["ząbkowanie", "gorączka"] },
      recentSleepLogs: [dummyNightLog],
      dailyTotalsLast14DaysMin: [],
      currentMetrics: {
        effectiveAgeDays: 300,
        chronicSleepDebtMin: 0,
        sleepBatteryPercent: 100,
        sleepNeedsProfile: "average",
        biologicalBedtimeMinFromMidnight: 1200,
      },
    };

    const result = evaluateCat5RegressionsAndCrisis(mockInput);
    expect(result.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT5_ILLNESS_OR_TEETHING);
    expect(result.algorithmOverride?.recommendedDayMode).toBe("illness_regression");
  });

  it("CAT6: nakłada bezwzględny guardrail kliniczny i regułę 60s dla noworodków <16 tyg.", () => {
    const resultNewborn = evaluateCat6NewbornCare(70);
    expect(resultNewborn.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT6_NEWBORN_GUARDRAIL);
    expect(resultNewborn.severity).toBe("high");

    const resultOlder = evaluateCat6NewbornCare(140);
    expect(resultOlder.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT6_MATURE);
  });

  it("CAT7: różnicuje fizjologiczny głód u maluchów <6 msc od asocjacji Comfort Nursing", () => {
    const mockInputYoung: DiagnosticEvaluationInput = {
      child: { birthDateIso: "2026-02-01", activeDayMode: "home" },
      recentSleepLogs: [dummyNightLog],
      dailyTotalsLast14DaysMin: [],
      currentMetrics: {
        effectiveAgeDays: 90,
        chronicSleepDebtMin: 0,
        sleepBatteryPercent: 100,
        sleepNeedsProfile: "average",
        biologicalBedtimeMinFromMidnight: 1200,
      },
    };
    const resultYoung = evaluateCat7NightWeaning(mockInputYoung);
    expect(resultYoung.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT7_NUTRITIONAL_HUNGER);

    const nursingNightLog: SleepLog = {
      ...dummyNightLog,
      nightWakings: [
        { wokeAt: "01:00", estimatedDurationMin: 5, fedMilk: true, interventions: ["breast"] },
        { wokeAt: "03:00", estimatedDurationMin: 5, fedMilk: true, interventions: ["breast"] },
        { wokeAt: "05:00", estimatedDurationMin: 5, fedMilk: true, interventions: ["breast"] },
      ],
    };
    const mockInputOlder: DiagnosticEvaluationInput = {
      ...mockInputYoung,
      recentSleepLogs: [nursingNightLog],
      currentMetrics: {
        ...mockInputYoung.currentMetrics,
        effectiveAgeDays: 240,
      },
    };
    const resultOlder = evaluateCat7NightWeaning(mockInputOlder);
    expect(resultOlder.diagnosisCode).toBe(DIAGNOSIS_CODES.CAT7_HABITUAL_FEEDING);
  });

  it("evaluateAll7DiagnosticCategories: zwraca kompletny zestaw 7 kategorii diagnostycznych", () => {
    const mockInput: DiagnosticEvaluationInput = {
      child: { birthDateIso: "2025-06-01", activeDayMode: "home" },
      recentSleepLogs: [dummyNightLog],
      dailyTotalsLast14DaysMin: [],
      currentMetrics: {
        effectiveAgeDays: 240,
        chronicSleepDebtMin: 20,
        sleepBatteryPercent: 90,
        sleepNeedsProfile: "average",
        biologicalBedtimeMinFromMidnight: 1200,
      },
    };

    const allResults = evaluateAll7DiagnosticCategories(mockInput);
    expect(allResults).toHaveLength(7);

    const categories = allResults.map((r) => r.category);
    expect(categories).toContain("CAT1_ASSOCIATIONS_NIGHT_WAKINGS");
    expect(categories).toContain("CAT2_BEDTIME_RESISTANCE_LATENCY");
    expect(categories).toContain("CAT3_EARLY_WAKING_SPLIT_NIGHT");
    expect(categories).toContain("CAT4_SHORT_NAPS_TRANSITIONS");
    expect(categories).toContain("CAT5_REGRESSION_ILLNESS_CRISIS");
    expect(categories).toContain("CAT6_NEWBORN_DAY_NIGHT_ACTIVE_SLEEP");
    expect(categories).toContain("CAT7_NIGHT_WEANING_FEEDING");
  });
});
