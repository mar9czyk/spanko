import { isIllnessDay } from "./dayModes";
import {
  getMinutesFromMidnightInTimeZone,
  hasUtcOffsetChangedWithinDays,
} from "./physiologicalDay";

import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_MINUTE } from "./threeDrives";
import type {
  DiagnosticEvaluationInput,
  DiagnosticTreeResult,
  ProblemCategory,
  SleepLog,
  SleepMood,
} from "./types";

/*
 * Progi drzew. Liczby bez źródła w badaniach są oznaczone `// heurystyka`
 * (praktyka konsultantów snu lub spec. Spanko v2.0), nie jako fakty fizjologiczne.
 * Źródła: raport „Ocena silnika snu Spanko” (badania/reports), plan etapu C.
 */

export const NEWBORN_MAX_AGE_DAYS = 112;
export const WEANING_MIN_AGE_DAYS = 180;
/** CAT7: do 9. mies. odstawianie nocnych karmień to wybór rodziny, nie problem. */ // heurystyka (spec. v2.0: 6–9 mies.)
export const WEANING_FULL_AGE_DAYS = 270;
/** CAT1: diagnoza od 6 mies. (próg konsultacji ≥3 pobudek; spec. v2.0 podaje 16 tyg.). */
export const CAT1_MIN_AGE_DAYS = 180;
/** CAT1: 4–6 mies. — częste pobudki opisujemy tylko jako normę wieku. */
export const CAT1_INFO_MIN_AGE_DAYS = 120;
export const SPLIT_NIGHT_MIN_DURATION_MINUTES = 60; // heurystyka
/** CAT2: długie zasypianie (niedomęczenie). */
export const BEDTIME_LATENCY_THRESHOLD_MINUTES = 30; // heurystyka
/** CAT2: przemęczenie wg spec. v2.0 — latencja >20 min + płacz + dług. */
export const OVERTIRED_LATENCY_THRESHOLD_MINUTES = 20; // heurystyka (spec. v2.0)
/** Średni dzienny niedobór snu z 3 dób (skala po etapie B, bez ×3,5); ok. 1 SD u malucha. */
export const OVERTIRED_DEBT_THRESHOLD_MINUTES = 60; // heurystyka
/** CAT2: wcześniejsze kładzenie przy przemęczeniu (tekst: 20–30 min). */
export const OVERTIRED_BEDTIME_ADVANCE_MINUTES = 20; // heurystyka (spec. v2.0)
/** Bedtime fading: +15 min co 3 dni (Piazza i Fisher 1991 — metoda; liczby ze spec. v2.0). */
export const BEDTIME_FADING_STEP_MINUTES = 15; // heurystyka
export const BEDTIME_FADING_INTERVAL_DAYS = 3; // heurystyka
export const HIGH_NIGHT_WAKINGS_THRESHOLD = 3;
export const SHORT_NAP_THRESHOLD_MINUTES = 45; // heurystyka
export const COMFORT_NURSING_MAX_ML = 30; // heurystyka
/** Okno analizy drzew: logi z tylu ostatnich dni przed `nowIso`. */
export const DIAGNOSTIC_WINDOW_DAYS = 14;
/** Powtarzalność: liczba ostatnich nocy branych pod uwagę. */
export const REPEAT_WINDOW_NIGHTS = 7;
/** Powtarzalność: minimalna liczba nocy z danym wzorcem (CAT3, CAT7). */
export const REPEAT_MIN_NIGHTS = 3;
/** Spec. v2.0: ≥3 pobudki przez ≥5 nocy w tygodniu (CAT1). */
export const ASSOCIATION_MIN_NIGHTS = 5;
/** Karmienia mlekiem w nocy, od których noc liczy się jako nawykowa (CAT7). */
export const HABITUAL_NIGHT_FEEDS_PER_NIGHT = 2;
/**
 * CAT7: krótkie karmienie. Spec. v2.0 mówi o ssaniu <3 min, ale dziennik zapisuje czas
 * całej pobudki (najkrótsza opcja to 5 min), więc próg to ≤5 min.
 */
export const COMFORT_FEED_MAX_MINUTES = 5; // heurystyka (spec. v2.0)
/** CAT7: karmienia co ≤60 min (spec. v2.0). */
export const COMFORT_FEED_MAX_INTERVAL_MINUTES = 60; // heurystyka (spec. v2.0)
export const EARLY_WAKE_START_MINUTES = 240; // 04:00
export const EARLY_WAKE_END_MINUTES = 330; // 05:30
/** CAT3: długa noc → przesunięcie rytmu (spec. v2.0, protokół Flynn-Evans — opinia ekspercka). */
export const EARLY_WAKE_LONG_NIGHT_MINUTES = 630; // heurystyka (10,5 h)
/** CAT3: krótka noc → „lock-in” (spec. v2.0, protokół Flynn-Evans — opinia ekspercka). */
export const EARLY_WAKE_SHORT_NIGHT_MINUTES = 570; // heurystyka (9,5 h)
export const PHASE_SHIFT_STEP_MINUTES = 15; // heurystyka
export const PHASE_SHIFT_INTERVAL_DAYS = 2; // heurystyka
/**
 * CAT3: przez tyle dni po zmianie czasu pobudki o tej samej porze biologicznej wypadają
 * godzinę wcześniej na zegarze, więc nie liczą się jako wczesne pobudki.
 */
export const CLOCK_CHANGE_ADJUSTMENT_DAYS = 7; // heurystyka
/** CAT4: opór przed ostatnią drzemką. */
export const NAP_RESISTANCE_LATENCY_MINUTES = 20; // heurystyka
/** CAT4: przejście drzemkowe dopiero po ≥5 dniach sygnałów z rzędu. */
export const NAP_READINESS_MIN_DAYS = 5; // heurystyka (spec. v2.0)
/** CAT4: 3→2 drzemki od 4. mies. (Mindell 2016). */
export const THREE_TO_TWO_MIN_AGE_DAYS = 120;
export const THREE_TO_TWO_MAX_AGE_DAYS = 300; // heurystyka
/** CAT4: 2→1 drzemka w 12–18 mies. */
export const TWO_TO_ONE_MIN_AGE_DAYS = 365;
export const TWO_TO_ONE_MAX_AGE_DAYS = 548;
export const NAP_SHIFT_STEP_MINUTES = 15; // heurystyka (spec. v2.0)
export const NAP_SHIFT_INTERVAL_DAYS = 3; // heurystyka (spec. v2.0)
/** CAT5: wybuch wygaszania w nocach 2–5 od startu planu (France i in., PMC4934563). */
export const EXTINCTION_BURST_FIRST_NIGHT = 2;
export const EXTINCTION_BURST_LAST_NIGHT = 5;
/** CAT5: spontaniczny nawrót oceniamy dopiero po tylu nocach planu. */
export const SPONTANEOUS_RELAPSE_MIN_NIGHTS = 7; // heurystyka
/** CAT5: wzrost pobudek — ostatnie noce vs wcześniejsze noce z okna. */
export const WAKING_INCREASE_RECENT_NIGHTS = 5;
export const WAKING_INCREASE_MIN_EARLIER_NIGHTS = 3;
export const WAKING_INCREASE_MIN_DELTA = 1; // heurystyka
export const WAKING_INCREASE_MIN_AVERAGE = 2; // heurystyka
/** CAT5: zmiana architektury snu ok. 3–7 mies. (bez okna 105–135 dni; PubMed 36586054). */
export const FOUR_MONTH_CHANGE_MIN_DAYS = 84; // heurystyka
export const FOUR_MONTH_CHANGE_MAX_DAYS = 210; // heurystyka
/** CAT5: przejściowe regresje 8–10 i 18–24 mies. (opinia kliniczna, Phoenix Children's). */
export const REGRESSION_8_10_MIN_DAYS = 240;
export const REGRESSION_8_10_MAX_DAYS = 330;
export const REGRESSION_18_24_MIN_DAYS = 540;
export const REGRESSION_18_24_MAX_DAYS = 730;
/** CAT5: tagi doby włączające tryb choroby. Ząbkowanie ≠ choroba (Azevedo 2015). */
export const TEETHING_DAY_TAG = "ząbkowanie";
/** CAT6: budzenie z drzemki dziennej noworodka po 2 h. */
export const NEWBORN_MAX_NAP_MINUTES = 120; // heurystyka
export const NEWBORN_LONG_NAP_MIN_COUNT = 2;

export const DIAGNOSIS_CODES = {
  CAT1_HIGH_INTERVENTION: "HIGH_INTERVENTION_SLEEP_ASSOCIATION",
  CAT1_AGE_NORMAL: "NIGHT_WAKINGS_NORMAL_FOR_AGE",
  CAT1_HEALTHY: "HEALTHY_SLEEP_CONSOLIDATION",
  CAT2_OVERTIRED: "OVERTIRED_BEDTIME_RESISTANCE",
  CAT2_UNDERTIRED: "UNDERTIRED_BEDTIME_FADING",
  CAT2_OPTIMAL: "OPTIMAL_BEDTIME_LATENCY",
  CAT2_UNCLEAR: "LONG_LATENCY_MOOD_UNKNOWN",
  CAT3_SPLIT_NIGHT: "SPLIT_NIGHT_EXCESS_DAY_SLEEP",
  CAT3_EARLY_WAKING: "EARLY_MORNING_WAKING_PHASE_ADVANCE",
  CAT3_EARLY_WAKING_SHORT_NIGHT: "EARLY_MORNING_WAKING_SHORT_NIGHT",
  CAT3_EARLY_WAKING_UNCLEAR: "EARLY_MORNING_WAKING",
  CAT3_NORMAL: "NORMAL_CIRCADIAN_WAKE",
  CAT3_CLOCK_CHANGE: "CLOCK_CHANGE_ADJUSTMENT",
  CAT4_SINGLE_CYCLE: "SINGLE_CYCLE_SHORT_NAPS",
  CAT4_TRANSITION_READY: "NAP_TRANSITION_READY",
  CAT4_DEVELOPMENTAL: "DEVELOPMENTAL_SHORT_NAPS",
  CAT4_STABLE: "NAP_STRUCTURE_STABLE",
  CAT5_FOUR_MONTH: "FOUR_MONTH_SLEEP_REGRESSION",
  CAT5_TRANSIENT_REGRESSION: "TRANSIENT_DEVELOPMENTAL_REGRESSION",
  CAT5_EXTINCTION_BURST: "EXTINCTION_BURST",
  CAT5_SPONTANEOUS_RELAPSE: "SPONTANEOUS_RELAPSE",
  CAT5_ILLNESS: "ACUTE_ILLNESS_DISRUPTION",
  CAT5_TEETHING: "TEETHING_DISCOMFORT",
  CAT5_STABLE: "STABLE_DEVELOPMENT",
  CAT6_NEWBORN_GUARDRAIL: "NEWBORN_ACTIVE_SLEEP_GUARDRAIL",
  CAT6_DAY_NIGHT_CONFUSION: "DAY_NIGHT_CONFUSION",
  CAT6_MATURE: "MATURE_CIRCADIAN_RHYTHM",
  CAT7_HABITUAL_FEEDING: "HABITUAL_NIGHT_FEEDING_ASSOCIATION",
  CAT7_NUTRITIONAL_HUNGER: "NUTRITIONAL_NIGHT_HUNGER",
  CAT7_BALANCED: "BALANCED_NIGHT_NUTRITION",
} as const;

/**
 * Zamienia ISO na milisekundy.
 *
 * @param {string} iso - Znacznik czasu
 * @returns {number} Milisekundy od epoki
 */
function toMs(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * Latencja zasypiania (odłożenie → zaśnięcie) w minutach, nie mniej niż 0.
 *
 * @param {SleepLog} log - Log snu
 * @returns {number} Latencja w minutach
 */
function latencyMinutes(log: SleepLog): number {
  if (!log.fellAsleepAt || !log.putDownAt) return 0;
  return Math.max(0, (toMs(log.fellAsleepAt) - toMs(log.putDownAt)) / MILLISECONDS_PER_MINUTE);
}

/**
 * Średnia z liczb (0 dla pustej listy).
 *
 * @param {readonly number[]} values - Wartości
 * @returns {number} Średnia
 */
function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Sprawdza, czy większość nocnych interwencji wymaga intensywnej pomocy (poziom 4-5).
 *
 * @param {readonly SleepLog[]} logs - Dzienniki snu dziecka
 * @returns {boolean} True jeśli dominują silne asocjacje
 */
function hasHighInterventionPreference(logs: readonly SleepLog[]): boolean {
  const nightLogs = logs.filter((l) => l.type === "night");
  let highInterventionCount = 0;
  let totalInterventions = 0;

  for (const log of nightLogs) {
    for (const waking of log.nightWakings) {
      for (const intervention of waking.interventions) {
        totalInterventions += 1;
        if (["breast", "bottle", "bouncing", "carrying"].includes(intervention)) {
          highInterventionCount += 1;
        }
      }
    }
  }

  return totalInterventions > 0 && highInterventionCount / totalInterventions >= 0.5;
}

/**
 * Wybiera ostatnie zakończone noce (najnowsze pierwsze).
 *
 * @param {readonly SleepLog[]} logs - Dzienniki snu
 * @param {number} [limit=REPEAT_WINDOW_NIGHTS] - Maksymalna liczba nocy
 * @returns {readonly SleepLog[]} Ostatnie noce
 */
function selectRecentNights(
  logs: readonly SleepLog[],
  limit: number = REPEAT_WINDOW_NIGHTS,
): readonly SleepLog[] {
  return logs
    .filter((l) => l.type === "night" && l.status === "completed")
    .toSorted((a, b) => toMs(b.putDownAt) - toMs(a.putDownAt))
    .slice(0, limit);
}

/**
 * Zostawia logi z okna analizy (ostatnie DIAGNOSTIC_WINDOW_DAYS dni przed `nowIso`).
 *
 * @param {readonly SleepLog[]} logs - Dzienniki snu
 * @param {string} nowIso - Czas odniesienia
 * @returns {readonly SleepLog[]} Logi z okna
 */
export function selectLogsInDiagnosticWindow(
  logs: readonly SleepLog[],
  nowIso: string,
): readonly SleepLog[] {
  const nowMs = toMs(nowIso);
  const fromMs = nowMs - DIAGNOSTIC_WINDOW_DAYS * MILLISECONDS_PER_DAY;
  return logs.filter((l) => {
    const startMs = toMs(l.putDownAt);
    return startMs >= fromMs && startMs <= nowMs;
  });
}

/**
 * Ocenia kategorię CAT1: Skojarzenia ze snem i pobudki nocne.
 *
 * @description
 * ≥3 pobudki przez ≥5 z ostatnich 7 nocy. Od 6 mies. z przewagą interwencji wysokiego
 * poziomu to wzorzec skojarzeń; w 4.–6. mies. tylko informacja, że to jeszcze norma.
 *
 * @param {readonly SleepLog[]} logs - Dzienniki snu
 * @param {number} effectiveAgeDays - Wiek efektywny dziecka w dniach
 * @returns {DiagnosticTreeResult} Wynik diagnozy CAT1
 */
export function evaluateCat1SleepAssociations(
  logs: readonly SleepLog[],
  effectiveAgeDays: number,
): DiagnosticTreeResult {
  const frequentWakingNights = selectRecentNights(logs).filter(
    (l) => l.nightWakings.length >= HIGH_NIGHT_WAKINGS_THRESHOLD,
  ).length;
  const isFrequentWaking = frequentWakingNights >= ASSOCIATION_MIN_NIGHTS;

  if (
    effectiveAgeDays >= CAT1_MIN_AGE_DAYS &&
    isFrequentWaking &&
    hasHighInterventionPreference(logs)
  ) {
    return {
      category: "CAT1_ASSOCIATIONS_NIGHT_WAKINGS",
      diagnosisCode: DIAGNOSIS_CODES.CAT1_HIGH_INTERVENTION,
      severity: "high",
      confidenceScore: 0.85,
      isTriggered: true,
      title: "Częste pobudki i usypianie z dużą pomocą",
      explanation:
        "Dziecko budzi się kilka razy w nocy i za każdym razem potrzebuje dużej pomocy, żeby znów zasnąć. Taki wzorzec często oznacza, że zasypia przy karmieniu lub bujaniu i szuka go przy każdym wybudzeniu.",
      clinicalAction:
        "Stopniowo zmniejszaj pomoc przy zasypianiu: odkładaj dziecko senne, ale jeszcze nieśpiące.",
    };
  }

  if (
    effectiveAgeDays >= CAT1_INFO_MIN_AGE_DAYS &&
    effectiveAgeDays < CAT1_MIN_AGE_DAYS &&
    isFrequentWaking
  ) {
    return {
      category: "CAT1_ASSOCIATIONS_NIGHT_WAKINGS",
      diagnosisCode: DIAGNOSIS_CODES.CAT1_AGE_NORMAL,
      severity: "info",
      confidenceScore: 0.8,
      isTriggered: true,
      title: "Częste pobudki w tym wieku to jeszcze norma",
      explanation:
        "Między 4. a 6. miesiącem wiele dzieci budzi się kilka razy w nocy. To jeszcze nie jest wzorzec do zmiany.",
      clinicalAction:
        "Odpowiadaj na potrzeby dziecka. Jeśli pobudek wciąż będzie dużo po 6. miesiącu, warto przyjrzeć się sposobom usypiania.",
    };
  }

  return {
    category: "CAT1_ASSOCIATIONS_NIGHT_WAKINGS",
    diagnosisCode: DIAGNOSIS_CODES.CAT1_HEALTHY,
    severity: "info",
    confidenceScore: 0.9,
    isTriggered: false,
    title: "Noce bez wyraźnego problemu z pobudkami",
    explanation: "Liczba nocnych pobudek mieści się w zwykłym zakresie dla wieku.",
    clinicalAction: "Utrzymuj dotychczasową rutynę wyciszającą przed snem.",
  };
}

/**
 * Dominujący zapisany nastrój przy usypianiu na noc (płacz vs spokój); brak = brak danych.
 *
 * @param {readonly SleepLog[]} nightLogs - Noce
 * @returns {SleepMood | undefined} „crying”, „easy” albo undefined przy remisie lub braku danych
 */
function resolveDominantBedtimeMood(nightLogs: readonly SleepLog[]): SleepMood | undefined {
  const crying = nightLogs.filter((l) => l.mood === "crying").length;
  const easy = nightLogs.filter((l) => l.mood === "easy").length;
  if (crying > easy) return "crying";
  if (easy > crying) return "easy";
  return undefined;
}

/**
 * Tworzy wynik dla przemęczenia wieczornego.
 *
 * @returns {DiagnosticTreeResult} Wynik diagnozy overtired
 */
function buildOvertiredResistanceResult(): DiagnosticTreeResult {
  return {
    category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
    diagnosisCode: DIAGNOSIS_CODES.CAT2_OVERTIRED,
    severity: "medium",
    confidenceScore: 0.8,
    isTriggered: true,
    title: "Wieczorne zasypianie z płaczem przy zmęczeniu",
    explanation:
      "Dziecko długo zasypia i płacze, a ostatnie dni były krótsze w sen. Przemęczone dziecko często trudniej zasypia.",
    clinicalAction:
      "Połóż dziecko na noc 20–30 minut wcześniej przez kilka najbliższych wieczorów.",
    algorithmOverride: { wakeWindowOffsetMinutes: -OVERTIRED_BEDTIME_ADVANCE_MINUTES },
  };
}

/**
 * Tworzy wynik dla niedomęczenia wieczornego (bedtime fading).
 *
 * @returns {DiagnosticTreeResult} Wynik diagnozy undertired
 */
function buildUndertiredResistanceResult(): DiagnosticTreeResult {
  return {
    category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
    diagnosisCode: DIAGNOSIS_CODES.CAT2_UNDERTIRED,
    severity: "medium",
    confidenceScore: 0.8,
    isTriggered: true,
    title: "Długie, spokojne zasypianie wieczorem",
    explanation:
      "Dziecko zasypia ponad 30 minut, ale bez płaczu. Taki wzorzec często oznacza, że o tej porze nie jest jeszcze wystarczająco zmęczone.",
    clinicalAction:
      "Przesuwaj porę kładzenia o 15 minut później co 3 dni, aż dziecko zacznie zasypiać w około 15 minut.",
    algorithmOverride: {
      bedtimeFadingMinutes: BEDTIME_FADING_STEP_MINUTES,
      shiftEveryDays: BEDTIME_FADING_INTERVAL_DAYS,
    },
  };
}

/**
 * Ocenia kategorię CAT2: Opór przed snem i długa latencja zasypiania.
 *
 * @description
 * Przemęczenie (spec. v2.0): latencja >20 min + przewaga płaczu + dług snu.
 * Niedomęczenie: latencja ≥30 min przy przewadze spokojnego nastroju → bedtime fading.
 *
 * @param {readonly SleepLog[]} logs - Dzienniki snu
 * @param {number} chronicDebtMinutes - Chroniczny dług senny
 * @returns {DiagnosticTreeResult} Wynik diagnozy CAT2
 */
export function evaluateCat2BedtimeResistance(
  logs: readonly SleepLog[],
  chronicDebtMinutes: number,
): DiagnosticTreeResult {
  const nightLogs = logs.filter((l) => l.type === "night" && l.fellAsleepAt && l.putDownAt);
  const averageLatency = average(nightLogs.map(latencyMinutes));
  // Brak zapisanego nastroju to brak danych, nie „spokój”
  const mood = resolveDominantBedtimeMood(nightLogs);

  if (
    averageLatency > OVERTIRED_LATENCY_THRESHOLD_MINUTES &&
    mood === "crying" &&
    chronicDebtMinutes > OVERTIRED_DEBT_THRESHOLD_MINUTES
  ) {
    return buildOvertiredResistanceResult();
  }

  if (averageLatency >= BEDTIME_LATENCY_THRESHOLD_MINUTES) {
    if (mood === "easy") return buildUndertiredResistanceResult();
    return {
      category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
      diagnosisCode: DIAGNOSIS_CODES.CAT2_UNCLEAR,
      severity: "info",
      confidenceScore: 0.5,
      isTriggered: false,
      title: "Długie zasypianie bez jasnej przyczyny",
      explanation:
        "Zasypianie trwa ponad 30 minut, ale z zapisanych danych nie da się odróżnić zmęczenia od niedomęczenia.",
      clinicalAction: "Zapisuj nastrój przy usypianiu przez kilka wieczorów.",
    };
  }

  return {
    category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
    diagnosisCode: DIAGNOSIS_CODES.CAT2_OPTIMAL,
    severity: "info",
    confidenceScore: 0.9,
    isTriggered: false,
    title: "Zasypianie wieczorem bez trudności",
    explanation: "Dziecko zasypia w rozsądnym czasie, bez dużego oporu.",
    clinicalAction: "Kontynuuj stałe godziny i rytuał przedsenny.",
  };
}

/**
 * Wykrywa powtarzalne rozbite noce (wybudzenie >= 60 min w ≥3 z ostatnich 7 nocy).
 *
 * @param {readonly SleepLog[]} logs - Dzienniki snu
 * @returns {boolean} True jeśli wzorzec się powtarza
 */
function detectSplitNight(logs: readonly SleepLog[]): boolean {
  const splitNights = selectRecentNights(logs).filter((log) =>
    log.nightWakings.some((w) => w.estimatedDurationMin >= SPLIT_NIGHT_MIN_DURATION_MINUTES),
  );
  return splitNights.length >= REPEAT_MIN_NIGHTS;
}

/**
 * Wybiera noce z wczesną pobudką (04:00–05:30 czasu dziecka) spośród ostatnich 7 nocy.
 *
 * @param {readonly SleepLog[]} logs - Dzienniki snu
 * @param {string} timeZone - Strefa IANA dziecka
 * @returns {readonly SleepLog[]} Noce z wczesną pobudką
 */
function selectEarlyWakingNights(logs: readonly SleepLog[], timeZone: string): readonly SleepLog[] {
  return selectRecentNights(logs).filter((l) => {
    if (!l.wokeUpAt) return false;
    const wakeMin = getMinutesFromMidnightInTimeZone(l.wokeUpAt, timeZone);
    return wakeMin >= EARLY_WAKE_START_MINUTES && wakeMin <= EARLY_WAKE_END_MINUTES;
  });
}

/**
 * Sen nocny w minutach: od zaśnięcia do pobudki, bez czasu nocnych wybudzeń.
 *
 * @param {SleepLog} log - Noc
 * @returns {number} Minuty snu nocnego
 */
function nightSleepMinutes(log: SleepLog): number {
  if (!log.wokeUpAt || !log.fellAsleepAt) return 0;
  const spanMin = (toMs(log.wokeUpAt) - toMs(log.fellAsleepAt)) / MILLISECONDS_PER_MINUTE;
  const awakeMin = log.nightWakings.reduce((sum, w) => sum + w.estimatedDurationMin, 0);
  return Math.max(0, spanMin - awakeMin);
}

/**
 * Wynik wczesnych pobudek wg długości nocy (spec. v2.0, protokół Flynn-Evans).
 *
 * @param {number} averageNightMin - Średni sen nocny w nocach z wczesną pobudką
 * @returns {DiagnosticTreeResult} Wynik diagnozy porannej
 */
function resolveEarlyMorningWakeResult(averageNightMin: number): DiagnosticTreeResult {
  if (averageNightMin >= EARLY_WAKE_LONG_NIGHT_MINUTES) {
    return {
      category: "CAT3_EARLY_WAKING_SPLIT_NIGHT",
      diagnosisCode: DIAGNOSIS_CODES.CAT3_EARLY_WAKING,
      severity: "medium",
      confidenceScore: 0.75,
      isTriggered: true,
      title: "Wczesne pobudki po długiej nocy",
      explanation:
        "Dziecko śpi w nocy wystarczająco długo, ale budzi się bardzo wcześnie. Taki wzorzec często oznacza, że cały rytm dnia przesunął się na wcześniej.",
      clinicalAction:
        "Przesuwaj porę kładzenia na noc o 15 minut później co 2 dni, aż pobudka wypadnie o docelowej godzinie. Wieczorem daj więcej światła, rano trzymaj sypialnię zaciemnioną.",
      algorithmOverride: {
        bedtimeFadingMinutes: PHASE_SHIFT_STEP_MINUTES,
        shiftEveryDays: PHASE_SHIFT_INTERVAL_DAYS,
      },
    };
  }
  if (averageNightMin < EARLY_WAKE_SHORT_NIGHT_MINUTES) {
    return {
      category: "CAT3_EARLY_WAKING_SPLIT_NIGHT",
      diagnosisCode: DIAGNOSIS_CODES.CAT3_EARLY_WAKING_SHORT_NIGHT,
      severity: "medium",
      confidenceScore: 0.75,
      isTriggered: true,
      title: "Wczesne pobudki po krótkiej nocy",
      explanation:
        "Noc jest krótka, a pobudka wypada bardzo wcześnie. Taki wzorzec częściej oznacza nawyk lub zmęczenie niż przesunięty rytm dnia.",
      clinicalAction:
        "Do docelowej godziny pobudki traktuj czas jak noc: ciemno, cicho, bez zabawy. Dzień zaczynaj o docelowej godzinie i od niej licz pierwszą drzemkę.",
    };
  }
  return {
    category: "CAT3_EARLY_WAKING_SPLIT_NIGHT",
    diagnosisCode: DIAGNOSIS_CODES.CAT3_EARLY_WAKING_UNCLEAR,
    severity: "low",
    confidenceScore: 0.6,
    isTriggered: true,
    title: "Powtarzające się wczesne pobudki",
    explanation: "Dziecko kilka razy w tygodniu budzi się między 4:00 a 5:30.",
    clinicalAction:
      "Trzymaj sypialnię zaciemnioną do docelowej godziny pobudki i nie kładź dziecka na pierwszą drzemkę zbyt wcześnie.",
  };
}

/**
 * Ocenia wczesne pobudki poranne (spec. v2.0 i protokół E. Flynn-Evans z Baby Sleep Science —
 * opinia ekspercka, nie badanie).
 *
 * @param {DiagnosticEvaluationInput} input - Komplet danych diagnostycznych
 * @returns {DiagnosticTreeResult} Wynik diagnozy porannej
 */
function evaluateEarlyWakingTree(input: DiagnosticEvaluationInput): DiagnosticTreeResult {
  const earlyNights = selectEarlyWakingNights(input.recentSleepLogs, input.timeZone);
  const settledEarlyNights = earlyNights.filter(
    (l) =>
      !hasUtcOffsetChangedWithinDays(
        l.wokeUpAt as string,
        CLOCK_CHANGE_ADJUSTMENT_DAYS,
        input.timeZone,
      ),
  );

  if (settledEarlyNights.length >= REPEAT_MIN_NIGHTS) {
    return resolveEarlyMorningWakeResult(average(settledEarlyNights.map(nightSleepMinutes)));
  }

  if (earlyNights.length >= REPEAT_MIN_NIGHTS) {
    return {
      category: "CAT3_EARLY_WAKING_SPLIT_NIGHT",
      diagnosisCode: DIAGNOSIS_CODES.CAT3_CLOCK_CHANGE,
      severity: "info",
      confidenceScore: 0.8,
      isTriggered: false,
      title: "Przestawianie się po zmianie czasu",
      explanation:
        "Po zmianie czasu dziecko budzi się o tej samej porze co zwykle, ale zegar pokazuje inną godzinę. Przestawienie trwa zwykle kilka dni do tygodnia.",
      clinicalAction:
        "Przesuwaj drzemki i porę snu o 10–15 minut dziennie w stronę nowych godzin. Rano trzymaj sypialnię zaciemnioną, a w dzień dawaj dużo światła.",
    };
  }

  return {
    category: "CAT3_EARLY_WAKING_SPLIT_NIGHT",
    diagnosisCode: DIAGNOSIS_CODES.CAT3_NORMAL,
    severity: "info",
    confidenceScore: 0.9,
    isTriggered: false,
    title: "Poranne pobudki o zwykłej porze",
    explanation: "Poranne pobudki nie wypadają regularnie przed 5:30.",
    clinicalAction: "Utrzymuj stałą godzinę porannej pobudki.",
  };
}

/**
 * Ocenia kategorię CAT3: Wczesne pobudki poranne i rozbite noce.
 *
 * @param {DiagnosticEvaluationInput} input - Dane diagnostyczne dziecka
 * @returns {DiagnosticTreeResult} Wynik diagnozy CAT3
 */
export function evaluateCat3EarlyWakingAndSplitNight(
  input: DiagnosticEvaluationInput,
): DiagnosticTreeResult {
  if (detectSplitNight(input.recentSleepLogs)) {
    return {
      category: "CAT3_EARLY_WAKING_SPLIT_NIGHT",
      diagnosisCode: DIAGNOSIS_CODES.CAT3_SPLIT_NIGHT,
      severity: "high",
      confidenceScore: 0.85,
      isTriggered: true,
      title: "Rozbite noce z długim czuwaniem",
      explanation:
        "Dziecko kilka razy w tygodniu czuwa w nocy ponad godzinę. Taki wzorzec często oznacza za dużo snu w ciągu dnia.",
      clinicalAction: "Skróć łączny sen w dzień i wydłuż ostatnie okno czuwania przed nocą.",
      algorithmOverride: { maxDaytimeSleepCapMinutes: -30 },
    };
  }

  return evaluateEarlyWakingTree(input);
}

/**
 * Tworzy wynik diagnozy dla krótkich drzemek w oparciu o wiek dziecka.
 *
 * @param {number} effectiveAgeDays - Wiek efektywny dziecka w dniach
 * @returns {DiagnosticTreeResult} Wynik diagnozy krótkich drzemek
 */
function resolveShortNapResult(effectiveAgeDays: number): DiagnosticTreeResult {
  if (effectiveAgeDays < WEANING_MIN_AGE_DAYS) {
    return {
      category: "CAT4_SHORT_NAPS_TRANSITIONS",
      diagnosisCode: DIAGNOSIS_CODES.CAT4_DEVELOPMENTAL,
      severity: "info",
      confidenceScore: 0.85,
      isTriggered: true,
      title: "Krótkie drzemki typowe dla wieku",
      explanation: "Drzemki po 30–45 minut są częste i normalne u dzieci poniżej 6 miesięcy.",
      clinicalAction: "Nie przedłużaj drzemek na siłę; dostosuj długość kolejnego okna czuwania.",
    };
  }
  return {
    category: "CAT4_SHORT_NAPS_TRANSITIONS",
    diagnosisCode: DIAGNOSIS_CODES.CAT4_SINGLE_CYCLE,
    severity: "medium",
    confidenceScore: 0.8,
    isTriggered: true,
    title: "Krótkie drzemki w ciągu dnia",
    explanation:
      "Dziecko często budzi się po około 40 minutach drzemki. Taki wzorzec często oznacza, że potrzebuje pomocy, żeby przejść w kolejny cykl snu.",
    clinicalAction:
      "Spróbuj delikatnie pomóc tuż przed końcem pierwszego cyklu (smoczek, dotyk około 35. minuty drzemki).",
  };
}

/** Dzień z drzemkami i sygnałem gotowości do mniejszej liczby drzemek. */
interface NapDaySignal {
  readonly date: string;
  readonly napCount: number;
  readonly hasResistance: boolean;
}

/**
 * Zbiera dla każdej doby fizjologicznej liczbę drzemek i sygnał oporu:
 * długie zasypianie na ostatnią drzemkę albo długie zasypianie na noc tej doby.
 *
 * @param {readonly SleepLog[]} logs - Logi snu
 * @returns {readonly NapDaySignal[]} Doby od najnowszej
 */
function collectNapDaySignals(logs: readonly SleepLog[]): readonly NapDaySignal[] {
  const naps = logs.filter((l) => l.type === "nap" && l.status === "completed");
  const dates = [...new Set(naps.map((n) => n.physiologicalDate))].toSorted().reverse();
  return dates.map((date) => {
    const dayNaps = naps
      .filter((n) => n.physiologicalDate === date)
      .toSorted((a, b) => toMs(a.putDownAt) - toMs(b.putDownAt));
    const lastNap = dayNaps[dayNaps.length - 1];
    const night = logs.find((l) => l.type === "night" && l.physiologicalDate === date);
    const hasResistance =
      (lastNap !== undefined && latencyMinutes(lastNap) >= NAP_RESISTANCE_LATENCY_MINUTES) ||
      (night !== undefined && latencyMinutes(night) >= BEDTIME_LATENCY_THRESHOLD_MINUTES);
    return { date, napCount: dayNaps.length, hasResistance };
  });
}

/**
 * Sprawdza, czy daty (od najnowszej) to kolejne dni kalendarzowe.
 *
 * @param {readonly string[]} dates - Daty YYYY-MM-DD od najnowszej
 * @returns {boolean} True dla dni z rzędu
 */
function areConsecutiveDates(dates: readonly string[]): boolean {
  return dates.every((date, index) => {
    const previous = dates[index - 1];
    if (previous === undefined) return true;
    return toMs(`${previous}T00:00:00Z`) - toMs(`${date}T00:00:00Z`) === MILLISECONDS_PER_DAY;
  });
}

/**
 * Wykrywa gotowość do przejścia drzemkowego: sygnał oporu przez ≥5 dni z rzędu
 * w wieku typowym dla 3→2 lub 2→1.
 *
 * @param {readonly SleepLog[]} logs - Logi snu
 * @param {number} effectiveAgeDays - Wiek efektywny
 * @returns {"3to2" | "2to1" | null} Rodzaj przejścia lub null
 */
function detectNapTransition(
  logs: readonly SleepLog[],
  effectiveAgeDays: number,
): "3to2" | "2to1" | null {
  const days = collectNapDaySignals(logs).slice(0, NAP_READINESS_MIN_DAYS);
  if (days.length < NAP_READINESS_MIN_DAYS) return null;
  if (!areConsecutiveDates(days.map((d) => d.date))) return null;
  if (!days.every((d) => d.hasResistance)) return null;

  const counts = days.map((d) => d.napCount).toSorted((a, b) => a - b);
  const typicalNapCount = counts[Math.floor(counts.length / 2)] ?? 0;
  if (
    typicalNapCount >= 3 &&
    effectiveAgeDays >= THREE_TO_TWO_MIN_AGE_DAYS &&
    effectiveAgeDays <= THREE_TO_TWO_MAX_AGE_DAYS
  ) {
    return "3to2";
  }
  if (
    typicalNapCount === 2 &&
    effectiveAgeDays >= TWO_TO_ONE_MIN_AGE_DAYS &&
    effectiveAgeDays <= TWO_TO_ONE_MAX_AGE_DAYS
  ) {
    return "2to1";
  }
  return null;
}

/**
 * Tworzy wynik gotowości do przejścia drzemkowego.
 *
 * @param {"3to2" | "2to1"} transition - Rodzaj przejścia
 * @returns {DiagnosticTreeResult} Wynik NAP_TRANSITION_READY
 */
function buildNapTransitionResult(transition: "3to2" | "2to1"): DiagnosticTreeResult {
  const base = {
    category: "CAT4_SHORT_NAPS_TRANSITIONS",
    diagnosisCode: DIAGNOSIS_CODES.CAT4_TRANSITION_READY,
    severity: "medium",
    confidenceScore: 0.8,
    isTriggered: true,
    explanation:
      "Od co najmniej 5 dni z rzędu dziecko długo zasypia na ostatnią drzemkę albo na noc. Taki wzorzec często oznacza gotowość do mniejszej liczby drzemek.",
  } as const;
  if (transition === "2to1") {
    return {
      ...base,
      title: "Gotowość do przejścia na jedną drzemkę",
      clinicalAction:
        "Przesuwaj poranną drzemkę o 15 minut później co 3 dni, aż zacznie się około 12:00–12:30. W okresie przejściowym kładź dziecko na noc nieco wcześniej.",
      algorithmOverride: {
        wakeWindowOffsetMinutes: NAP_SHIFT_STEP_MINUTES,
        shiftEveryDays: NAP_SHIFT_INTERVAL_DAYS,
      },
    };
  }
  return {
    ...base,
    title: "Gotowość do przejścia z trzech na dwie drzemki",
    clinicalAction:
      "Zrezygnuj z trzeciej drzemki i wydłuż okna czuwania. W okresie przejściowym kładź dziecko na noc nieco wcześniej.",
  };
}

/**
 * Ocenia kategorię CAT4: Krótkie drzemki i przejścia drzemkowe.
 *
 * @param {DiagnosticEvaluationInput} input - Dane diagnostyczne dziecka
 * @returns {DiagnosticTreeResult} Wynik diagnozy CAT4
 */
export function evaluateCat4ShortNapsAndTransitions(
  input: DiagnosticEvaluationInput,
): DiagnosticTreeResult {
  const { effectiveAgeDays } = input.currentMetrics;
  const transition = detectNapTransition(input.recentSleepLogs, effectiveAgeDays);
  if (transition) return buildNapTransitionResult(transition);

  const naps = input.recentSleepLogs.filter((l) => l.type === "nap" && l.status === "completed");
  const shortNaps = naps.filter((n) => {
    if (!n.wokeUpAt || !n.fellAsleepAt) return false;
    const dur = (toMs(n.wokeUpAt) - toMs(n.fellAsleepAt)) / MILLISECONDS_PER_MINUTE;
    return dur <= SHORT_NAP_THRESHOLD_MINUTES;
  });

  const isShortNapDominant = naps.length >= 3 && shortNaps.length / naps.length >= 0.5;
  if (isShortNapDominant) {
    return resolveShortNapResult(effectiveAgeDays);
  }

  return {
    category: "CAT4_SHORT_NAPS_TRANSITIONS",
    diagnosisCode: DIAGNOSIS_CODES.CAT4_STABLE,
    severity: "info",
    confidenceScore: 0.9,
    isTriggered: false,
    title: "Stabilne drzemki w ciągu dnia",
    explanation: "Długość drzemek nie wskazuje na problem.",
    clinicalAction: "Kontynuuj dotychczasowy rytm dnia.",
  };
}

/**
 * Noce zakończone od startu planu (najnowsze pierwsze).
 *
 * @param {readonly SleepLog[]} logs - Logi snu
 * @param {string | null | undefined} planStartIso - Start planu
 * @returns {readonly SleepLog[]} Noce planu
 */
function selectPlanNights(
  logs: readonly SleepLog[],
  planStartIso: string | null | undefined,
): readonly SleepLog[] {
  if (!planStartIso) return [];
  const startMs = toMs(planStartIso);
  if (Number.isNaN(startMs)) return [];
  return selectRecentNights(logs, Number.POSITIVE_INFINITY).filter(
    (l) => toMs(l.putDownAt) >= startMs,
  );
}

/**
 * Czy noc ma oznaki protestu: pobudki, płacz albo długie zasypianie.
 *
 * @param {SleepLog} night - Noc
 * @returns {boolean} True przy oznakach protestu
 */
function hasProtestSigns(night: SleepLog): boolean {
  return (
    night.nightWakings.length > 0 ||
    night.mood === "crying" ||
    latencyMinutes(night) >= OVERTIRED_LATENCY_THRESHOLD_MINUTES
  );
}

/**
 * Wybuch wygaszania: noce 2–5 od startu planu z oznakami protestu.
 *
 * @param {readonly SleepLog[]} planNights - Noce planu (najnowsze pierwsze)
 * @returns {boolean} True w trakcie wybuchu
 */
function isExtinctionBurst(planNights: readonly SleepLog[]): boolean {
  const latest = planNights[0];
  return (
    latest !== undefined &&
    planNights.length >= EXTINCTION_BURST_FIRST_NIGHT &&
    planNights.length <= EXTINCTION_BURST_LAST_NIGHT &&
    hasProtestSigns(latest)
  );
}

/**
 * Wzrost pobudek: ostatnie noce mają średnio o ≥1 pobudkę więcej niż wcześniejsze.
 *
 * @param {readonly SleepLog[]} nightsNewestFirst - Noce od najnowszej
 * @returns {boolean} True przy wyraźnym wzroście
 */
function hasWakingIncrease(nightsNewestFirst: readonly SleepLog[]): boolean {
  const recent = nightsNewestFirst.slice(0, WAKING_INCREASE_RECENT_NIGHTS);
  const earlier = nightsNewestFirst.slice(WAKING_INCREASE_RECENT_NIGHTS);
  if (recent.length < WAKING_INCREASE_RECENT_NIGHTS) return false;
  if (earlier.length < WAKING_INCREASE_MIN_EARLIER_NIGHTS) return false;
  const recentAvg = average(recent.map((n) => n.nightWakings.length));
  const earlierAvg = average(earlier.map((n) => n.nightWakings.length));
  return (
    recentAvg >= WAKING_INCREASE_MIN_AVERAGE && recentAvg - earlierAvg >= WAKING_INCREASE_MIN_DELTA
  );
}

/**
 * Spontaniczny nawrót: po ≥7 nocach planu ostatnie noce wyraźnie gorsze od poprzednich.
 *
 * @param {readonly SleepLog[]} planNights - Noce planu (najnowsze pierwsze)
 * @returns {boolean} True przy nawrocie
 */
function isSpontaneousRelapse(planNights: readonly SleepLog[]): boolean {
  if (planNights.length < SPONTANEOUS_RELAPSE_MIN_NIGHTS) return false;
  const recent = planNights.slice(0, 2);
  const earlier = planNights.slice(2, SPONTANEOUS_RELAPSE_MIN_NIGHTS);
  const recentAvg = average(recent.map((n) => n.nightWakings.length));
  const earlierAvg = average(earlier.map((n) => n.nightWakings.length));
  return (
    recentAvg >= WAKING_INCREASE_MIN_AVERAGE && recentAvg - earlierAvg >= WAKING_INCREASE_MIN_DELTA
  );
}

/**
 * Sprawdza chorobę (tagi choroby z `ILLNESS_DAY_TAGS` lub tryb „Choroba”).
 * Ząbkowanie nie włącza trybu choroby (Azevedo 2015).
 *
 * @param {DiagnosticEvaluationInput} input - Dane diagnostyczne dziecka
 * @returns {DiagnosticTreeResult | null} Wynik choroby lub null
 */
function checkIllness(input: DiagnosticEvaluationInput): DiagnosticTreeResult | null {
  if (!isIllnessDay(input.child.activeDayMode, input.todayContext?.tags ?? [])) return null;

  return {
    category: "CAT5_REGRESSION_ILLNESS_CRISIS",
    diagnosisCode: DIAGNOSIS_CODES.CAT5_ILLNESS,
    severity: "medium",
    confidenceScore: 0.95,
    isTriggered: true,
    title: "Choroba zaburza sen",
    explanation: "W czasie choroby sen często się pogarsza i to jest w porządku.",
    clinicalAction:
      "Pozwól na więcej snu i pomagaj w zasypianiu tak, jak dziecko potrzebuje, a zmiany nawyków wstrzymaj. Do planu wróć po ok. 2 dobach bez gorączki i ostrych objawów, o krok wstecz (praktyka, nie wynik badań).",
    algorithmOverride: { recommendedDayMode: "illness_regression" },
  };
}

/**
 * Tworzy wynik dla ząbkowania (bez trybu choroby).
 *
 * @returns {DiagnosticTreeResult} Wynik TEETHING_DISCOMFORT
 */
function buildTeethingResult(): DiagnosticTreeResult {
  return {
    category: "CAT5_REGRESSION_ILLNESS_CRISIS",
    diagnosisCode: DIAGNOSIS_CODES.CAT5_TEETHING,
    severity: "low",
    confidenceScore: 0.7,
    isTriggered: true,
    title: "Ząbkowanie",
    explanation:
      "Ząbkowanie pogarsza sen tylko u części dzieci i zwykle przez kilka dni. Wysoka gorączka nie jest objawem ząbkowania.",
    clinicalAction:
      "Utrzymaj zwykły rytm i rytuał, pocieszaj dziecko, gdy tego potrzebuje. Przy gorączce skontaktuj się z lekarzem i oznacz chorobę.",
  };
}

/**
 * Wynik dla wzrostu pobudek zależnie od wieku: zmiana snu ok. 4. mies. albo
 * przejściowe regresje 8–10 i 18–24 mies.
 *
 * @param {DiagnosticEvaluationInput} input - Dane diagnostyczne dziecka
 * @returns {DiagnosticTreeResult | null} Wynik regresji lub null
 */
function checkDevelopmentalRegression(
  input: DiagnosticEvaluationInput,
): DiagnosticTreeResult | null {
  const age = input.currentMetrics.effectiveAgeDays;
  const nights = selectRecentNights(input.recentSleepLogs, Number.POSITIVE_INFINITY);
  if (!hasWakingIncrease(nights)) return null;

  if (age >= FOUR_MONTH_CHANGE_MIN_DAYS && age <= FOUR_MONTH_CHANGE_MAX_DAYS) {
    return {
      category: "CAT5_REGRESSION_ILLNESS_CRISIS",
      diagnosisCode: DIAGNOSIS_CODES.CAT5_FOUR_MONTH,
      severity: "medium",
      confidenceScore: 0.7,
      isTriggered: true,
      title: "Zmiana snu w okolicach 4. miesiąca",
      explanation:
        "W tym wieku sen dojrzewa: cykle snu stają się podobne do dorosłych i między nimi łatwiej o wybudzenie. To trwała zmiana, a nie etap, który sam minie po kilku tygodniach.",
      clinicalAction:
        "Wprowadź stałą sekwencję wyciszenia i daj dziecku chwilę na samodzielny powrót do snu, zanim pomożesz.",
    };
  }

  const isTransientBand =
    (age >= REGRESSION_8_10_MIN_DAYS && age <= REGRESSION_8_10_MAX_DAYS) ||
    (age >= REGRESSION_18_24_MIN_DAYS && age <= REGRESSION_18_24_MAX_DAYS);
  if (!isTransientBand) return null;

  return {
    category: "CAT5_REGRESSION_ILLNESS_CRISIS",
    diagnosisCode: DIAGNOSIS_CODES.CAT5_TRANSIENT_REGRESSION,
    severity: "medium",
    confidenceScore: 0.65,
    isTriggered: true,
    title: "Przejściowe pogorszenie snu",
    explanation:
      "W tym wieku pogorszenie snu często towarzyszy nowym umiejętnościom albo lękowi separacyjnemu i zwykle mija w 2–4 tygodnie.",
    clinicalAction:
      "Trzymaj stały rytm i rytuał. Jeśli pogorszenie trwa ponad miesiąc, porozmawiaj z lekarzem.",
  };
}

/**
 * Ocenia kategorię CAT5: Regresje, kryzysy i skoki rozwojowe.
 *
 * @description
 * Kolejność: choroba → wybuch wygaszania (noce 2–5 planu) → spontaniczny nawrót
 * (po ≥7 nocach planu) → ząbkowanie → wzrost pobudek zależny od wieku.
 *
 * @param {DiagnosticEvaluationInput} input - Dane diagnostyczne dziecka
 * @returns {DiagnosticTreeResult} Wynik diagnozy CAT5
 */
export function evaluateCat5RegressionsAndCrisis(
  input: DiagnosticEvaluationInput,
): DiagnosticTreeResult {
  const illnessResult = checkIllness(input);
  if (illnessResult) return illnessResult;

  const planNights = selectPlanNights(input.recentSleepLogs, input.child.currentPlanStartDateIso);
  if (isExtinctionBurst(planNights)) {
    return {
      category: "CAT5_REGRESSION_ILLNESS_CRISIS",
      diagnosisCode: DIAGNOSIS_CODES.CAT5_EXTINCTION_BURST,
      severity: "medium",
      confidenceScore: 0.8,
      isTriggered: true,
      title: "Chwilowo więcej protestu po zmianie nawyków",
      explanation:
        "Nasilenie płaczu lub pobudek w 2.–5. nocy po zmianie to częsty, przejściowy etap (tzw. wybuch wygaszania). Zwykle oznacza, że dziecko zauważyło zmianę.",
      clinicalAction:
        "Jeśli plan jest dla Was w porządku, trzymaj się go konsekwentnie przez kolejne noce. Gdy dziecko wygląda na chore, wstrzymaj plan.",
    };
  }

  if (isSpontaneousRelapse(planNights)) {
    return {
      category: "CAT5_REGRESSION_ILLNESS_CRISIS",
      diagnosisCode: DIAGNOSIS_CODES.CAT5_SPONTANEOUS_RELAPSE,
      severity: "medium",
      confidenceScore: 0.7,
      isTriggered: true,
      title: "Nawrót pobudek po okresie poprawy",
      explanation:
        "Powrót pobudek po kilku lepszych nocach zdarza się często, zwłaszcza po chorobie, podróży lub zmianie otoczenia. Zwykle szybko mija, jeśli reakcje dorosłych pozostają takie same.",
      clinicalAction: "Reaguj tak samo jak w planie i nie wracaj do dawnych sposobów usypiania.",
    };
  }

  if ((input.todayContext?.tags ?? []).includes(TEETHING_DAY_TAG)) return buildTeethingResult();

  const regressionResult = checkDevelopmentalRegression(input);
  if (regressionResult) return regressionResult;

  return {
    category: "CAT5_REGRESSION_ILLNESS_CRISIS",
    diagnosisCode: DIAGNOSIS_CODES.CAT5_STABLE,
    severity: "info",
    confidenceScore: 0.9,
    isTriggered: false,
    title: "Stabilny okres",
    explanation: "Nic nie wskazuje na nagłe pogorszenie snu.",
    clinicalAction: "Kontynuuj bieżący rytm i plan.",
  };
}

/**
 * Liczy drzemki dłuższe niż 2 h w ostatnich 7 dobach.
 *
 * @param {readonly SleepLog[]} logs - Logi snu
 * @returns {number} Liczba długich drzemek
 */
function countLongNewbornNaps(logs: readonly SleepLog[]): number {
  const latestMs = Math.max(...logs.map((l) => toMs(l.putDownAt)));
  const fromMs = latestMs - REPEAT_WINDOW_NIGHTS * MILLISECONDS_PER_DAY;
  return logs.filter((l) => {
    if (l.type !== "nap" || l.status !== "completed" || !l.wokeUpAt) return false;
    if (toMs(l.putDownAt) < fromMs) return false;
    const durationMin = (toMs(l.wokeUpAt) - toMs(l.fellAsleepAt)) / MILLISECONDS_PER_MINUTE;
    return durationMin > NEWBORN_MAX_NAP_MINUTES;
  }).length;
}

/**
 * Ocenia kategorię CAT6: Noworodek (<16 tyg.) – ochrona i sen aktywny.
 *
 * @param {number} effectiveAgeDays - Wiek efektywny dziecka w dniach
 * @param {readonly SleepLog[]} [logs=[]] - Logi snu (do wykrycia długich drzemek)
 * @returns {DiagnosticTreeResult} Wynik diagnozy CAT6
 */
export function evaluateCat6NewbornCare(
  effectiveAgeDays: number,
  logs: readonly SleepLog[] = [],
): DiagnosticTreeResult {
  if (effectiveAgeDays < NEWBORN_MAX_AGE_DAYS) {
    const hasLongNaps = logs.length > 0 && countLongNewbornNaps(logs) >= NEWBORN_LONG_NAP_MIN_COUNT;
    const baseAction =
      "Karm na żądanie i reaguj na płacz. Przy kwileniu we śnie odczekaj chwilę (ok. 60 sekund), bo to może być sen aktywny.";
    return {
      category: "CAT6_NEWBORN_DAY_NIGHT_ACTIVE_SLEEP",
      diagnosisCode: DIAGNOSIS_CODES.CAT6_NEWBORN_GUARDRAIL,
      severity: "high",
      confidenceScore: 1.0,
      isTriggered: true,
      title: "Ochrona snu noworodka (poniżej 16 tygodni)",
      explanation:
        "Rytm dobowy dopiero się kształtuje (zwykle między 8. a 16. tygodniem), więc to nie jest czas na naukę samodzielnego zasypiania.",
      clinicalAction: hasLongNaps
        ? `${baseAction} Budź dziecko z drzemki dziennej po 2 godzinach, żeby więcej snu przypadało na noc.`
        : baseAction,
    };
  }

  return {
    category: "CAT6_NEWBORN_DAY_NIGHT_ACTIVE_SLEEP",
    diagnosisCode: DIAGNOSIS_CODES.CAT6_MATURE,
    severity: "info",
    confidenceScore: 0.95,
    isTriggered: false,
    title: "Rytm dobowy jest już wyraźny",
    explanation: "Dziecko skończyło 16 tygodni; rytm dnia i nocy jest zwykle już ustalony.",
    clinicalAction: "Jeśli chcesz, możesz stopniowo uczyć samodzielnego zasypiania.",
  };
}

/**
 * Czy noc ma wzorzec karmienia dla uspokojenia (spec. v2.0): ≥2 karmienia mlekiem,
 * w tym krótkie (≤5 min) albo co ≤60 min.
 *
 * @param {SleepLog} night - Noc
 * @returns {boolean} True przy wzorcu
 */
function isComfortFeedingNight(night: SleepLog): boolean {
  const feeds = night.nightWakings
    .filter((w) => w.fedMilk)
    .toSorted((a, b) => toMs(a.wokeAt) - toMs(b.wokeAt));
  if (feeds.length < HABITUAL_NIGHT_FEEDS_PER_NIGHT) return false;
  const shortFeeds = feeds.filter((w) => w.estimatedDurationMin <= COMFORT_FEED_MAX_MINUTES);
  const hasFrequentFeeds = feeds.some((w, index) => {
    const previous = feeds[index - 1];
    if (!previous) return false;
    const gapMin = (toMs(w.wokeAt) - toMs(previous.wokeAt)) / MILLISECONDS_PER_MINUTE;
    return gapMin > 0 && gapMin <= COMFORT_FEED_MAX_INTERVAL_MINUTES;
  });
  return shortFeeds.length >= HABITUAL_NIGHT_FEEDS_PER_NIGHT || hasFrequentFeeds;
}

/**
 * Czy nocne karmienia to głównie pierś.
 *
 * @param {readonly SleepLog[]} nights - Noce
 * @returns {boolean} True przy przewadze karmienia piersią
 */
function isMostlyBreastfed(nights: readonly SleepLog[]): boolean {
  const feeds = nights.flatMap((n) => n.nightWakings.filter((w) => w.fedMilk));
  const breast = feeds.filter((w) => w.interventions.includes("breast")).length;
  return feeds.length > 0 && breast / feeds.length >= 0.5;
}

/**
 * Tworzy wynik karmienia dla uspokojenia, łagodniejszy dla piersi i dla 6–9 mies.
 *
 * @param {number} effectiveAgeDays - Wiek efektywny
 * @param {boolean} isBreastfed - Przewaga karmienia piersią
 * @returns {DiagnosticTreeResult} Wynik HABITUAL_NIGHT_FEEDING_ASSOCIATION
 */
function buildComfortFeedingResult(
  effectiveAgeDays: number,
  isBreastfed: boolean,
): DiagnosticTreeResult {
  const isYoung = effectiveAgeDays < WEANING_FULL_AGE_DAYS;
  const explanation =
    "Dziecko budzi się na krótkie albo bardzo częste karmienia. Taki wzorzec często oznacza, że karmienie pomaga zasnąć, a nie zaspokaja głód.";
  const action = isBreastfed
    ? "Jeśli chcesz to zmienić, skracaj nocne karmienia powoli, np. co 3–4 noce, a uspokajanie powierz drugiemu rodzicowi. Szybkie ograniczenie nocnych karmień może zmniejszyć laktację, więc w razie wątpliwości porozmawiaj z doradczynią laktacyjną."
    : "Jeśli chcesz to zmienić, zmniejszaj nocną porcję mleka stopniowo co 2 noce, a uspokajanie powierz drugiemu rodzicowi.";
  return {
    category: "CAT7_NIGHT_WEANING_FEEDING",
    diagnosisCode: DIAGNOSIS_CODES.CAT7_HABITUAL_FEEDING,
    severity: isYoung ? "low" : "medium",
    confidenceScore: 0.8,
    isTriggered: true,
    title: "Karmienie w nocy dla uspokojenia",
    explanation: isYoung
      ? `${explanation} Między 6. a 9. miesiącem część dzieci nadal potrzebuje jeść w nocy, więc zmiana to wybór rodziny.`
      : explanation,
    clinicalAction: action,
  };
}

/**
 * Ocenia kategorię CAT7: Ograniczanie karmień nocnych.
 *
 * @param {DiagnosticEvaluationInput} input - Dane diagnostyczne dziecka
 * @returns {DiagnosticTreeResult} Wynik diagnozy CAT7
 */
export function evaluateCat7NightWeaning(input: DiagnosticEvaluationInput): DiagnosticTreeResult {
  const { currentMetrics, recentSleepLogs } = input;

  if (currentMetrics.effectiveAgeDays < WEANING_MIN_AGE_DAYS) {
    return {
      category: "CAT7_NIGHT_WEANING_FEEDING",
      diagnosisCode: DIAGNOSIS_CODES.CAT7_NUTRITIONAL_HUNGER,
      severity: "info",
      confidenceScore: 0.95,
      isTriggered: false,
      title: "Nocne karmienia są w tym wieku potrzebne",
      explanation: "Dzieci poniżej 6. miesiąca zwykle potrzebują jeść także w nocy.",
      clinicalAction: "Karm według potrzeb, bez prób ograniczania nocnych karmień.",
    };
  }

  const comfortNights = selectRecentNights(recentSleepLogs).filter(isComfortFeedingNight);
  if (comfortNights.length >= REPEAT_MIN_NIGHTS) {
    return buildComfortFeedingResult(
      currentMetrics.effectiveAgeDays,
      isMostlyBreastfed(comfortNights),
    );
  }

  return {
    category: "CAT7_NIGHT_WEANING_FEEDING",
    diagnosisCode: DIAGNOSIS_CODES.CAT7_BALANCED,
    severity: "info",
    confidenceScore: 0.9,
    isTriggered: false,
    title: "Nocne karmienia bez wyraźnego wzorca uspokajania",
    explanation: "Nocne karmienia nie wyglądają na nawykowe.",
    clinicalAction: "Dbaj o sycące posiłki w ciągu dnia.",
  };
}

/**
 * Ocenia wszystkie 7 kategorii problemów snu dziecka w deterministycznych drzewach.
 *
 * @param {DiagnosticEvaluationInput} input - Kompletny kontekst logów i metryk dziecka
 * @returns {readonly DiagnosticTreeResult[]} Tablica wyników dla wszystkich 7 kategorii
 */
export function evaluateAll7DiagnosticCategories(
  input: DiagnosticEvaluationInput,
): readonly DiagnosticTreeResult[] {
  const windowed: DiagnosticEvaluationInput = {
    ...input,
    recentSleepLogs: selectLogsInDiagnosticWindow(input.recentSleepLogs, input.nowIso),
  };
  const logs = windowed.recentSleepLogs;
  const results = [
    evaluateCat1SleepAssociations(logs, input.currentMetrics.effectiveAgeDays),
    evaluateCat2BedtimeResistance(logs, input.currentMetrics.chronicSleepDebtMin),
    evaluateCat3EarlyWakingAndSplitNight(windowed),
    evaluateCat4ShortNapsAndTransitions(windowed),
    evaluateCat5RegressionsAndCrisis(windowed),
    evaluateCat6NewbornCare(input.currentMetrics.effectiveAgeDays, logs),
    evaluateCat7NightWeaning(windowed),
  ];
  const paused = resolvePausedCategories(input);
  return results.map((result) =>
    paused.includes(result.category) ? { ...result, isTriggered: false } : result,
  );
}

/** W chorobie zostaje tylko diagnoza choroby i ochrona noworodka; reszta to nietypowe dni. */
const ILLNESS_PAUSED_CATEGORIES: readonly ProblemCategory[] = [
  "CAT1_ASSOCIATIONS_NIGHT_WAKINGS",
  "CAT2_BEDTIME_RESISTANCE_LATENCY",
  "CAT3_EARLY_WAKING_SPLIT_NIGHT",
  "CAT4_SHORT_NAPS_TRANSITIONS",
  "CAT7_NIGHT_WEANING_FEEDING",
];
/** W drodze krótkie drzemki i przesunięta pora snu są oczekiwane, więc nie są problemem. */
const ON_THE_GO_PAUSED_CATEGORIES: readonly ProblemCategory[] = [
  "CAT2_BEDTIME_RESISTANCE_LATENCY",
  "CAT4_SHORT_NAPS_TRANSITIONS",
];

/**
 * Kategorie wstrzymane przez tryb dnia (heurystyka Spanko na bazie raportu „Sen w chorobie i w drodze”).
 *
 * @param {DiagnosticEvaluationInput} input - Dane diagnostyczne dziecka
 * @returns {readonly ProblemCategory[]} Kategorie, które nie zgłaszają problemu
 */
function resolvePausedCategories(input: DiagnosticEvaluationInput): readonly ProblemCategory[] {
  if (isIllnessDay(input.child.activeDayMode, input.todayContext?.tags ?? [])) {
    return ILLNESS_PAUSED_CATEGORIES;
  }
  return input.child.activeDayMode === "on_the_go" ? ON_THE_GO_PAUSED_CATEGORIES : [];
}
