import { getMinutesFromMidnightInTimeZone } from "./physiologicalDay";
import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_MINUTE } from "./threeDrives";
import type { DiagnosticEvaluationInput, DiagnosticTreeResult, SleepLog } from "./types";

export const NEWBORN_MAX_AGE_DAYS = 112;
export const WEANING_MIN_AGE_DAYS = 180;
export const FOUR_MONTH_MIN_DAYS = 105;
export const FOUR_MONTH_MAX_DAYS = 135;
export const EXTINCTION_BURST_MIN_DAYS = 14;
export const EXTINCTION_BURST_MAX_DAYS = 28;
export const SPLIT_NIGHT_MIN_DURATION_MINUTES = 60;
export const BEDTIME_LATENCY_THRESHOLD_MINUTES = 30;
export const BEDTIME_FADING_STEP_MINUTES = 20;
export const HIGH_NIGHT_WAKINGS_THRESHOLD = 3;
export const SHORT_NAP_THRESHOLD_MINUTES = 45;
export const COMFORT_NURSING_MAX_ML = 30;
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
export const EARLY_WAKE_START_MINUTES = 240; // 04:00
export const EARLY_WAKE_END_MINUTES = 330; // 05:30

export const DIAGNOSIS_CODES = {
  CAT1_HIGH_INTERVENTION: "HIGH_INTERVENTION_SLEEP_ASSOCIATION",
  CAT1_HEALTHY: "HEALTHY_SLEEP_CONSOLIDATION",
  CAT2_OVERTIRED: "OVERTIRED_CORTISOL_SPIKE",
  CAT2_UNDERTIRED: "UNDERTIRED_WMZ_CONFLICT",
  CAT2_OPTIMAL: "OPTIMAL_BEDTIME_LATENCY",
  CAT2_UNCLEAR: "LONG_LATENCY_MOOD_UNKNOWN",
  CAT3_SPLIT_NIGHT: "SPLIT_NIGHT_EXCESS_DAY_SLEEP",
  CAT3_EARLY_WAKING: "EARLY_MORNING_WAKING_PHASE_ADVANCE",
  CAT3_NORMAL: "NORMAL_CIRCADIAN_WAKE",
  CAT4_SINGLE_CYCLE: "SINGLE_CYCLE_SHORT_NAPS",
  CAT4_TRANSITION_READY: "NAP_TRANSITION_READY",
  CAT4_DEVELOPMENTAL: "DEVELOPMENTAL_SHORT_NAPS",
  CAT4_STABLE: "NAP_STRUCTURE_STABLE",
  CAT5_FOUR_MONTH: "FOUR_MONTH_SLEEP_REGRESSION",
  CAT5_EXTINCTION_BURST: "EXTINCTION_BURST",
  CAT5_ILLNESS_OR_TEETHING: "ACUTE_ILLNESS_OR_TEETHING_DISRUPTION",
  CAT5_STABLE: "STABLE_DEVELOPMENT",
  CAT6_NEWBORN_GUARDRAIL: "NEWBORN_ACTIVE_SLEEP_GUARDRAIL",
  CAT6_DAY_NIGHT_CONFUSION: "DAY_NIGHT_CONFUSION",
  CAT6_MATURE: "MATURE_CIRCADIAN_RHYTHM",
  CAT7_HABITUAL_FEEDING: "HABITUAL_NIGHT_FEEDING_ASSOCIATION",
  CAT7_NUTRITIONAL_HUNGER: "NUTRITIONAL_NIGHT_HUNGER",
  CAT7_BALANCED: "BALANCED_NIGHT_NUTRITION",
} as const;

/**
 * Oblicza średnią liczbę nocnych wybudzeń z ostatnich zarejestrowanych nocy.
 *
 * @param {readonly SleepLog[]} logs - Dzienniki snu dziecka
 * @returns {number} Średnia liczba pobudek na noc
 */
function calculateAverageNightWakings(logs: readonly SleepLog[]): number {
  const nightLogs = logs.filter((l) => l.type === "night" && l.status === "completed");
  if (nightLogs.length === 0) return 0;
  const totalWakings = nightLogs.reduce((sum, item) => sum + item.nightWakings.length, 0);
  return totalWakings / nightLogs.length;
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
    .toSorted((a, b) => new Date(b.putDownAt).getTime() - new Date(a.putDownAt).getTime())
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
  const nowMs = new Date(nowIso).getTime();
  const fromMs = nowMs - DIAGNOSTIC_WINDOW_DAYS * MILLISECONDS_PER_DAY;
  return logs.filter((l) => {
    const startMs = new Date(l.putDownAt).getTime();
    return startMs >= fromMs && startMs <= nowMs;
  });
}

/**
 * Ocenia kategorię CAT1: Skojarzenia ze snem i pobudki nocne.
 *
 * @description
 * Spec. v2.0: od 16 tyg. wieku, ≥3 pobudki przez ≥5 z ostatnich 7 nocy
 * oraz przewaga interwencji wysokiego poziomu.
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
  const isHighAssoc = hasHighInterventionPreference(logs);

  if (
    effectiveAgeDays >= NEWBORN_MAX_AGE_DAYS &&
    frequentWakingNights >= ASSOCIATION_MIN_NIGHTS &&
    isHighAssoc
  ) {
    return {
      category: "CAT1_ASSOCIATIONS_NIGHT_WAKINGS",
      diagnosisCode: DIAGNOSIS_CODES.CAT1_HIGH_INTERVENTION,
      severity: "high",
      confidenceScore: 0.85,
      isTriggered: true,
      title: "Silne asocjacje zasypiania i częste wybudzenia nocne",
      explanation:
        "Dziecko budzi się wielokrotnie w nocy i potrzebuje intensywnej pomocy, aby przejść między cyklami snu.",
      clinicalAction:
        "Stopniowe obniżanie drabiny interwencji: odkładanie sennego, ale jeszcze czuwającego malucha.",
    };
  }

  return {
    category: "CAT1_ASSOCIATIONS_NIGHT_WAKINGS",
    diagnosisCode: DIAGNOSIS_CODES.CAT1_HEALTHY,
    severity: "info",
    confidenceScore: 0.9,
    isTriggered: false,
    title: "Prawidłowa konsolidacja snu nocnego",
    explanation: "Liczba nocnych wybudzeń mieści się w fizjologicznej normie dla wieku.",
    clinicalAction: "Utrzymuj dotychczasową rutynę wyciszającą przed snem.",
  };
}

/**
 * Oblicza średni czas latencji zasypiania wieczornego w minutach.
 *
 * @param {readonly SleepLog[]} logs - Dzienniki snu
 * @returns {number} Średnia latencja zasypiania
 */
function calculateAverageBedtimeLatency(logs: readonly SleepLog[]): number {
  const nightLogs = logs.filter((l) => l.type === "night" && l.fellAsleepAt && l.putDownAt);
  if (nightLogs.length === 0) return 0;
  const totalMinutes = nightLogs.reduce((sum, item) => {
    const latencyMs = new Date(item.fellAsleepAt).getTime() - new Date(item.putDownAt).getTime();
    return sum + Math.max(0, latencyMs / MILLISECONDS_PER_MINUTE);
  }, 0);
  return Math.round(totalMinutes / nightLogs.length);
}

/**
 * Tworzy wynik diagnozy dla oporu przed snem z przemęczenia (kortyzol).
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
    title: "Przemęczenie wieczorne (Wyrzut kortyzolu)",
    explanation:
      "Dziecko zasypia w płaczu z powodu przekroczenia okna czuwania i podwyższonego poziomu kortyzolu.",
    clinicalAction: "Skróć ostatnie okno czuwania o 15-20 minut przed snem nocnym.",
    algorithmOverride: { wakeWindowOffsetMinutes: -20 },
  };
}

/**
 * Tworzy wynik diagnozy dla oporu przed snem z niedomęczenia (Bedtime Fading).
 *
 * @returns {DiagnosticTreeResult} Wynik diagnozy undertired
 */
function buildUndertiredResistanceResult(): DiagnosticTreeResult {
  return {
    category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
    diagnosisCode: DIAGNOSIS_CODES.CAT2_UNDERTIRED,
    severity: "medium",
    confidenceScore: 0.85,
    isTriggered: true,
    title: "Niedomęczenie wieczorne (Technika Bedtime Fading)",
    explanation:
      "Dziecko spędza ponad 30 minut na próbach uśpienia bez silnego płaczu, kładzione w Strefie Zakazanej (WMZ).",
    clinicalAction:
      "Przesuń tymczasowo porę snu o 20 minut później, aż dziecko zacznie zasypiać w <15 minut.",
    algorithmOverride: { bedtimeFadingMinutes: BEDTIME_FADING_STEP_MINUTES },
  };
}

/**
 * Ocenia kategorię CAT2: Opór przed snem i długa latencja zasypiania (Bedtime Fading).
 *
 * @param {readonly SleepLog[]} logs - Dzienniki snu
 * @param {number} chronicDebtMinutes - Chroniczny dług senny
 * @returns {DiagnosticTreeResult} Wynik diagnozy CAT2
 */
export function evaluateCat2BedtimeResistance(
  logs: readonly SleepLog[],
  chronicDebtMinutes: number,
): DiagnosticTreeResult {
  const averageLatency = calculateAverageBedtimeLatency(logs);
  const nightLogs = logs.filter((l) => l.type === "night");
  const isCrying = nightLogs.some((l) => l.mood === "crying");
  const isCalm = nightLogs.some((l) => l.mood === "easy");

  if (averageLatency >= BEDTIME_LATENCY_THRESHOLD_MINUTES) {
    if (isCrying || chronicDebtMinutes > 45) return buildOvertiredResistanceResult();
    // Niedomęczenie tylko przy zapisanym spokojnym nastroju — brak danych to nie „spokój”
    if (isCalm) return buildUndertiredResistanceResult();
    return {
      category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
      diagnosisCode: DIAGNOSIS_CODES.CAT2_UNCLEAR,
      severity: "info",
      confidenceScore: 0.5,
      isTriggered: false,
      title: "Długie zasypianie bez informacji o nastroju",
      explanation:
        "Zasypianie trwa ponad 30 minut, ale bez zapisanego nastroju nie da się odróżnić przemęczenia od niedomęczenia.",
      clinicalAction: "Zapisuj nastrój przy usypianiu przez kilka wieczorów.",
    };
  }

  return {
    category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
    diagnosisCode: DIAGNOSIS_CODES.CAT2_OPTIMAL,
    severity: "info",
    confidenceScore: 0.9,
    isTriggered: false,
    title: "Prawidłowa latencja zasypiania wieczornego",
    explanation: "Dziecko zasypia w optymalnym oknie czasowym bez nadmiernego oporu.",
    clinicalAction: "Kontynuuj stałe godziny i rytuał przedsenny.",
  };
}

/**
 * Wykrywa powtarzalne Split Nights (wybudzenie >= 60 min w ≥3 z ostatnich 7 nocy).
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
 * Wykrywa powtarzalne wczesne pobudki (04:00–05:30 czasu dziecka w ≥3 z ostatnich 7 nocy).
 *
 * @param {readonly SleepLog[]} logs - Dzienniki snu
 * @param {string} timeZone - Strefa IANA dziecka
 * @returns {boolean} True jeśli wzorzec się powtarza
 */
function detectEarlyMorningWaking(logs: readonly SleepLog[], timeZone: string): boolean {
  const earlyNights = selectRecentNights(logs).filter((l) => {
    if (!l.wokeUpAt) return false;
    const wakeMin = getMinutesFromMidnightInTimeZone(l.wokeUpAt, timeZone);
    return wakeMin >= EARLY_WAKE_START_MINUTES && wakeMin <= EARLY_WAKE_END_MINUTES;
  });
  return earlyNights.length >= REPEAT_MIN_NIGHTS;
}

/**
 * Tworzy wynik wczesnej pobudki porannej w oparciu o stan długu sennego.
 *
 * @param {number} chronicDebtMinutes - Chroniczny dług senny dziecka
 * @returns {DiagnosticTreeResult} Wynik diagnozy porannej
 */
function resolveEarlyMorningWakeResult(chronicDebtMinutes: number): DiagnosticTreeResult {
  if (chronicDebtMinutes > 60) {
    return {
      category: "CAT3_EARLY_WAKING_SPLIT_NIGHT",
      diagnosisCode: DIAGNOSIS_CODES.CAT2_OVERTIRED,
      severity: "medium",
      confidenceScore: 0.75,
      isTriggered: true,
      title: "Wczesna pobudka z przemęczenia (Kortyzol o świcie)",
      explanation:
        "Chroniczny dług senny powoduje przedwczesny wyrzut hormonów wybudzających nad ranem.",
      clinicalAction: "Przyspiesz wieczorny sen o 20 minut, by zapobiec porannemu wybudzeniu.",
      algorithmOverride: { wakeWindowOffsetMinutes: -20 },
    };
  }
  return {
    category: "CAT3_EARLY_WAKING_SPLIT_NIGHT",
    diagnosisCode: DIAGNOSIS_CODES.CAT3_EARLY_WAKING,
    severity: "medium",
    confidenceScore: 0.8,
    isTriggered: true,
    title: "Wyprzedzenie fazy dobowej (Wczesna pobudka)",
    explanation: "Zegar biologiczny dziecka przestawił się na zbyt wczesny świt.",
    clinicalAction:
      "Przesuń porę wieczornego snu o 15-30 minut później i zaciemnij sypialnię roletami blackout.",
  };
}

/**
 * Ocenia wczesne pobudki poranne w drzewie Flynn-Evans (głód, wyprzedzenie fazy lub kortyzol).
 *
 * @param {DiagnosticEvaluationInput} input - Komplet danych diagnostycznych
 * @returns {DiagnosticTreeResult} Wynik diagnozy porannej
 */
function evaluateFlynnEvansTree(input: DiagnosticEvaluationInput): DiagnosticTreeResult {
  const { currentMetrics, recentSleepLogs } = input;

  if (detectEarlyMorningWaking(recentSleepLogs, input.timeZone)) {
    return resolveEarlyMorningWakeResult(currentMetrics.chronicSleepDebtMin);
  }

  return {
    category: "CAT3_EARLY_WAKING_SPLIT_NIGHT",
    diagnosisCode: DIAGNOSIS_CODES.CAT3_NORMAL,
    severity: "info",
    confidenceScore: 0.9,
    isTriggered: false,
    title: "Prawidłowa poranna pobudka",
    explanation: "Poranny czas pobudki jest zgodny z fizjologiczną normą okołodobową.",
    clinicalAction: "Utrzymuj stabilną poranną kotwicę czasową.",
  };
}

/**
 * Ocenia kategorię CAT3: Wczesne pobudki poranne i Split Nights.
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
      confidenceScore: 0.9,
      isTriggered: true,
      title: "Rozbita noc (Split Night) – wyczerpane ciśnienie snu",
      explanation:
        "Dziecko czuwa w nocy przez ponad godzinę z powodu zbyt dużej ilości snu w dzień.",
      clinicalAction:
        "Wprowadź limit drzemek w dzień (Nap Capping) i wydłuż ostatnie okno czuwania.",
      algorithmOverride: { maxDaytimeSleepCapMinutes: -30 },
    };
  }

  return evaluateFlynnEvansTree(input);
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
      title: "Rozwojowe krótkie drzemki (1 cykl snu)",
      explanation:
        "Pojedyncze cykle 30-45 minut są fizjologiczną normą u dzieci poniżej 6 miesięcy.",
      clinicalAction: "Nie przedłużaj drzemek na siłę; dostosuj długość kolejnego okna czuwania.",
    };
  }
  return {
    category: "CAT4_SHORT_NAPS_TRANSITIONS",
    diagnosisCode: DIAGNOSIS_CODES.CAT4_SINGLE_CYCLE,
    severity: "medium",
    confidenceScore: 0.8,
    isTriggered: true,
    title: "Trudność z samodzielnym łączeniem cykli w dzień",
    explanation:
      "Dziecko wybudza się po 40 minutach i potrzebuje wsparcia w przejściu w kolejny cykl.",
    clinicalAction:
      "Zastosuj technikę Wake-to-Sleep lub delikatne podanie smoczka/dotyk w 35. minucie drzemki.",
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
  const naps = input.recentSleepLogs.filter((l) => l.type === "nap" && l.status === "completed");
  const shortNaps = naps.filter((n) => {
    if (!n.wokeUpAt || !n.fellAsleepAt) return false;
    const dur =
      (new Date(n.wokeUpAt).getTime() - new Date(n.fellAsleepAt).getTime()) /
      MILLISECONDS_PER_MINUTE;
    return dur <= SHORT_NAP_THRESHOLD_MINUTES;
  });

  const isShortNapDominant = naps.length >= 3 && shortNaps.length / naps.length >= 0.5;
  if (isShortNapDominant) {
    return resolveShortNapResult(input.currentMetrics.effectiveAgeDays);
  }

  return {
    category: "CAT4_SHORT_NAPS_TRANSITIONS",
    diagnosisCode: DIAGNOSIS_CODES.CAT4_STABLE,
    severity: "info",
    confidenceScore: 0.9,
    isTriggered: false,
    title: "Stabilna struktura drzemek dziennych",
    explanation: "Długości drzemek i łączenie cykli są prawidłowe.",
    clinicalAction: "Kontynuuj dotychczasowy rytm dnia.",
  };
}

/**
 * Sprawdza, czy dziecko znajduje się w oknie Extinction Burst (14-28 dni od planu).
 *
 * @param {string | null | undefined} planStartIso - Data wdrożenia planu w ISO
 * @param {string} nowIso - Czas odniesienia (funkcja czysta, bez Date.now())
 * @returns {boolean} True jeśli mieści się w oknie 14-28 dni
 */
function isInsideExtinctionBurstWindow(
  planStartIso: string | null | undefined,
  nowIso: string,
): boolean {
  if (!planStartIso) return false;
  const startMs = new Date(planStartIso).getTime();
  const diffDays = Math.floor((new Date(nowIso).getTime() - startMs) / MILLISECONDS_PER_DAY);
  return diffDays >= EXTINCTION_BURST_MIN_DAYS && diffDays <= EXTINCTION_BURST_MAX_DAYS;
}

/**
 * Sprawdza obecność infekcji, ząbkowania lub trybu chorobowego.
 *
 * @param {DiagnosticEvaluationInput} input - Dane diagnostyczne dziecka
 * @returns {DiagnosticTreeResult | null} Wynik diagnozy infekcji lub null
 */
function checkIllnessOrTeething(input: DiagnosticEvaluationInput): DiagnosticTreeResult | null {
  const tags = input.todayContext?.tags ?? [];
  const isIllOrTeething =
    tags.some((t) => ["gorączka", "ząbkowanie", "infekcja_ucha"].includes(t)) ||
    input.child.activeDayMode === "illness_regression";

  if (!isIllOrTeething) return null;

  return {
    category: "CAT5_REGRESSION_ILLNESS_CRISIS",
    diagnosisCode: DIAGNOSIS_CODES.CAT5_ILLNESS_OR_TEETHING,
    severity: "medium",
    confidenceScore: 0.95,
    isTriggered: true,
    title: "Okres infekcji, bólu lub ząbkowania",
    explanation: "Dolegliwości fizyczne zakłócają sen dziecka.",
    clinicalAction: "Skróć okna czuwania o 20% i zawieś jakiekolwiek zmiany w nawykach snu.",
    algorithmOverride: { recommendedDayMode: "illness_regression" },
  };
}

/**
 * Sprawdza wystąpienie regresji 4. miesiąca życia.
 *
 * @param {DiagnosticEvaluationInput} input - Dane diagnostyczne dziecka
 * @returns {DiagnosticTreeResult | null} Wynik diagnozy regresji 4. miesiąca lub null
 */
function checkFourMonthRegression(input: DiagnosticEvaluationInput): DiagnosticTreeResult | null {
  const isFourMonthWindow =
    input.currentMetrics.effectiveAgeDays >= FOUR_MONTH_MIN_DAYS &&
    input.currentMetrics.effectiveAgeDays <= FOUR_MONTH_MAX_DAYS;

  if (isFourMonthWindow && calculateAverageNightWakings(input.recentSleepLogs) >= 3) {
    return {
      category: "CAT5_REGRESSION_ILLNESS_CRISIS",
      diagnosisCode: DIAGNOSIS_CODES.CAT5_FOUR_MONTH,
      severity: "high",
      confidenceScore: 0.85,
      isTriggered: true,
      title: "Regresja snu 4. miesiąca (Przebudowa architektury)",
      explanation: "Dojrzewanie faz snu NREM/REM skutkuje wybudzaniem po każdym cyklu.",
      clinicalAction: "Wprowadź stałą sekwencję wyciszenia i unikaj tworzenia nowych asocjacji.",
    };
  }
  return null;
}

/**
 * Ocenia kategorię CAT5: Regresje, kryzysy i skoki rozwojowe.
 *
 * @param {DiagnosticEvaluationInput} input - Dane diagnostyczne dziecka
 * @returns {DiagnosticTreeResult} Wynik diagnozy CAT5
 */
export function evaluateCat5RegressionsAndCrisis(
  input: DiagnosticEvaluationInput,
): DiagnosticTreeResult {
  const illnessResult = checkIllnessOrTeething(input);
  if (illnessResult) return illnessResult;

  if (isInsideExtinctionBurstWindow(input.child.currentPlanStartDateIso, input.nowIso)) {
    return {
      category: "CAT5_REGRESSION_ILLNESS_CRISIS",
      diagnosisCode: DIAGNOSIS_CODES.CAT5_EXTINCTION_BURST,
      severity: "high",
      confidenceScore: 0.9,
      isTriggered: true,
      title: "Detekcja Extinction Burst (Szczyt wygaszania)",
      explanation:
        "Nagły nawrót protestów w 14-28 dniu to fizjologiczna próba powrotu do starych nawyków.",
      clinicalAction:
        "Zachowaj żelazną konsekwencję. Objawy ustąpią samoistnie w ciągu 48-72 godzin.",
    };
  }

  const fourMonthResult = checkFourMonthRegression(input);
  if (fourMonthResult) return fourMonthResult;

  return {
    category: "CAT5_REGRESSION_ILLNESS_CRISIS",
    diagnosisCode: DIAGNOSIS_CODES.CAT5_STABLE,
    severity: "info",
    confidenceScore: 0.9,
    isTriggered: false,
    title: "Stabilny etap rozwojowy",
    explanation: "Brak cech ostrych regresji lub kryzysów w zachowaniu sennym.",
    clinicalAction: "Kontynuuj bieżący plan pielęgnacji snu.",
  };
}

/**
 * Ocenia kategorię CAT6: Noworodek (<16 tyg.) – ochrona kliniczna i sen aktywny.
 *
 * @param {number} effectiveAgeDays - Wiek efektywny dziecka w dniach
 * @returns {DiagnosticTreeResult} Wynik diagnozy CAT6
 */
export function evaluateCat6NewbornCare(effectiveAgeDays: number): DiagnosticTreeResult {
  if (effectiveAgeDays < NEWBORN_MAX_AGE_DAYS) {
    return {
      category: "CAT6_NEWBORN_DAY_NIGHT_ACTIVE_SLEEP",
      diagnosisCode: DIAGNOSIS_CODES.CAT6_NEWBORN_GUARDRAIL,
      severity: "high",
      confidenceScore: 1.0,
      isTriggered: true,
      title: "Kliniczna ochrona noworodka (<16 tygodni życia)",
      explanation:
        "Układ nerwowy niemowlęcia nie produkuje dojrzałej melatoniny. Wszelki trening snu jest zakazany.",
      clinicalAction:
        "Karm na żądanie, odpowiadaj natychmiast na płacz i stosuj regułę 60 sekund pauzy w śnie aktywnym.",
    };
  }

  return {
    category: "CAT6_NEWBORN_DAY_NIGHT_ACTIVE_SLEEP",
    diagnosisCode: DIAGNOSIS_CODES.CAT6_MATURE,
    severity: "info",
    confidenceScore: 0.95,
    isTriggered: false,
    title: "Dojrzały rytm okołodobowy niemowlęcia",
    explanation: "Dziecko ukończyło 16. tydzień życia i posiada dojrzałą produkcję melatoniny.",
    clinicalAction: "Można bezpiecznie wprowadzać samodzielne nawyki zasypiania.",
  };
}

/**
 * Wykrywa wzorzec nawykowych karmień nocnych: ≥2 karmienia mlekiem w nocy
 * przez ≥3 z ostatnich 7 nocy.
 *
 * @param {readonly SleepLog[]} logs - Dzienniki snu dziecka
 * @returns {boolean} True jeśli wzorzec się powtarza
 */
function isComfortNursingPattern(logs: readonly SleepLog[]): boolean {
  const feedingNights = selectRecentNights(logs).filter(
    (log) => log.nightWakings.filter((w) => w.fedMilk).length >= HABITUAL_NIGHT_FEEDS_PER_NIGHT,
  );
  return feedingNights.length >= REPEAT_MIN_NIGHTS;
}

/**
 * Ocenia kategorię CAT7: Ograniczanie karmień nocnych (Night Weaning).
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
      title: "Fizjologiczne nocne zapotrzebowanie kaloryczne",
      explanation: "U dzieci poniżej 6. miesiąca życia nocne karmienia są niezbędne metabolicznie.",
      clinicalAction: "Karm według potrzeb głodu bez prób redukcji porcji nocnych.",
    };
  }

  if (isComfortNursingPattern(recentSleepLogs)) {
    return {
      category: "CAT7_NIGHT_WEANING_FEEDING",
      diagnosisCode: DIAGNOSIS_CODES.CAT7_HABITUAL_FEEDING,
      severity: "medium",
      confidenceScore: 0.85,
      isTriggered: true,
      title: "Ssanie jako asocjacja uspokojenia (Comfort Nursing)",
      explanation:
        "Dziecko wybudza się wielokrotnie na krótkie ssanie bez realnego głodu kalorycznego.",
      clinicalAction:
        "Stopniowo skracaj czas nocnych karmień lub podawaj wodę/smoczek, angażując drugiego rodzica.",
    };
  }

  return {
    category: "CAT7_NIGHT_WEANING_FEEDING",
    diagnosisCode: DIAGNOSIS_CODES.CAT7_BALANCED,
    severity: "info",
    confidenceScore: 0.9,
    isTriggered: false,
    title: "Zrównoważony rytm nocnego odżywiania",
    explanation: "Częstotliwość nocnych karmień jest odpowiednia dla etapu rozwoju.",
    clinicalAction: "Dbaj o sycące posiłki stałe w ciągu dnia.",
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
  return [
    evaluateCat1SleepAssociations(logs, input.currentMetrics.effectiveAgeDays),
    evaluateCat2BedtimeResistance(logs, input.currentMetrics.chronicSleepDebtMin),
    evaluateCat3EarlyWakingAndSplitNight(windowed),
    evaluateCat4ShortNapsAndTransitions(windowed),
    evaluateCat5RegressionsAndCrisis(windowed),
    evaluateCat6NewbornCare(input.currentMetrics.effectiveAgeDays),
    evaluateCat7NightWeaning(windowed),
  ];
}
