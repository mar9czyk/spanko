import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_MINUTE } from "./threeDrives";
import type { DiagnosticEvaluationInput, DiagnosticTreeResult, SleepLog } from "./types";

export const NEWBORN_MAX_AGE_DAYS = 112;
export const WEANING_MIN_AGE_DAYS = 180;
export const FOUR_MONTH_MIN_DAYS = 110;
export const FOUR_MONTH_MAX_DAYS = 150;
export const EXTINCTION_BURST_MIN_DAYS = 14;
export const EXTINCTION_BURST_MAX_DAYS = 28;
export const SPLIT_NIGHT_MIN_DURATION_MINUTES = 60;
export const BEDTIME_LATENCY_THRESHOLD_MINUTES = 30;
export const BEDTIME_FADING_STEP_MINUTES = 20;
export const HIGH_NIGHT_WAKINGS_THRESHOLD = 3;
export const SHORT_NAP_THRESHOLD_MINUTES = 45;
export const COMFORT_NURSING_MAX_ML = 30;

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
 * Ocenia kategorię CAT1: Skojarzenia ze snem i pobudki nocne.
 *
 * @param {readonly SleepLog[]} logs - Dzienniki snu
 * @returns {DiagnosticTreeResult} Wynik diagnozy CAT1
 */
export function evaluateCat1SleepAssociations(logs: readonly SleepLog[]): DiagnosticTreeResult {
  const averageWakings = calculateAverageNightWakings(logs);
  const isHighAssoc = hasHighInterventionPreference(logs);

  if (averageWakings >= HIGH_NIGHT_WAKINGS_THRESHOLD && isHighAssoc) {
    return {
      category: "CAT1_ASSOCIATIONS_NIGHT_WAKINGS",
      diagnosisCode: "CAT1_STRONG_SLEEP_ASSOCIATION",
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
    diagnosisCode: "CAT1_HEALTHY_SLEEP_CONSOLIDATION",
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
    diagnosisCode: "CAT2_OVERTIRED_RESISTANCE",
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
    diagnosisCode: "CAT2_UNDERTIRED_BEDTIME_FADING",
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

  if (averageLatency >= BEDTIME_LATENCY_THRESHOLD_MINUTES) {
    return isCrying || chronicDebtMinutes > 45
      ? buildOvertiredResistanceResult()
      : buildUndertiredResistanceResult();
  }

  return {
    category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
    diagnosisCode: "CAT2_OPTIMAL_BEDTIME_LATENCY",
    severity: "info",
    confidenceScore: 0.9,
    isTriggered: false,
    title: "Prawidłowa latencja zasypiania wieczornego",
    explanation: "Dziecko zasypia w optymalnym oknie czasowym bez nadmiernego oporu.",
    clinicalAction: "Kontynuuj stałe godziny i rytuał przedsenny.",
  };
}

/**
 * Wykrywa zjawisko Split Night (wybudzenie w nocy trwające >= 60 minut).
 *
 * @param {readonly SleepLog[]} logs - Dzienniki snu
 * @returns {boolean} True jeśli wykryto Split Night
 */
function detectSplitNight(logs: readonly SleepLog[]): boolean {
  return logs.some((log) => {
    if (log.type !== "night") return false;
    return log.nightWakings.some((w) => w.estimatedDurationMin >= SPLIT_NIGHT_MIN_DURATION_MINUTES);
  });
}

/**
 * Wyciąga godzinę i minutę w UTC z timestampu ISO.
 *
 * @param {string} isoString - Data ISO
 * @returns {{ hour: number; minute: number }} Godzina i minuta w UTC
 */
function extractHourAndMinute(isoString: string): { hour: number; minute: number } {
  const match = isoString.match(/T(\d{2}):(\d{2})/);
  if (match?.[1] && match?.[2]) {
    return { hour: Number.parseInt(match[1], 10), minute: Number.parseInt(match[2], 10) };
  }
  const date = new Date(isoString);
  return { hour: date.getUTCHours(), minute: date.getUTCMinutes() };
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
      diagnosisCode: "CAT3_OVERTIRED_EARLY_WAKE",
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
    diagnosisCode: "CAT3_CIRCADIAN_EARLY_WAKE",
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
  const earlyNight = recentSleepLogs.find((l) => {
    if (l.type !== "night" || !l.wokeUpAt) return false;
    const { hour, minute } = extractHourAndMinute(l.wokeUpAt);
    return hour === 4 || (hour === 5 && minute <= 30);
  });

  if (earlyNight) {
    return resolveEarlyMorningWakeResult(currentMetrics.chronicSleepDebtMin);
  }

  return {
    category: "CAT3_EARLY_WAKING_SPLIT_NIGHT",
    diagnosisCode: "CAT3_NORMAL_CIRCADIAN_WAKE",
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
      diagnosisCode: "CAT3_SPLIT_NIGHT_PRESSURE_DEPLETED",
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
      diagnosisCode: "CAT4_DEVELOPMENTAL_SHORT_NAPS",
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
    diagnosisCode: "CAT4_CATNAPPING_CYCLE_CONNECTING",
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
    diagnosisCode: "CAT4_NAP_STRUCTURE_STABLE",
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
 * @returns {boolean} True jeśli mieści się w oknie 14-28 dni
 */
function isInsideExtinctionBurstWindow(planStartIso: string | null | undefined): boolean {
  if (!planStartIso) return false;
  const startMs = new Date(planStartIso).getTime();
  const diffDays = Math.floor((Date.now() - startMs) / MILLISECONDS_PER_DAY);
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
    diagnosisCode: "CAT5_ILLNESS_OR_TEETHING",
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
      diagnosisCode: "CAT5_FOUR_MONTH_REGRESSION",
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

  if (isInsideExtinctionBurstWindow(input.child.currentPlanStartDateIso)) {
    return {
      category: "CAT5_REGRESSION_ILLNESS_CRISIS",
      diagnosisCode: "CAT5_EXTINCTION_BURST_DETECTED",
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
    diagnosisCode: "CAT5_STABLE_DEVELOPMENT",
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
      diagnosisCode: "CAT6_CLINICAL_GUARDRAIL_NEWBORN",
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
    diagnosisCode: "CAT6_MATURE_CIRCADIAN_RHYTHM",
    severity: "info",
    confidenceScore: 0.95,
    isTriggered: false,
    title: "Dojrzały rytm okołodobowy niemowlęcia",
    explanation: "Dziecko ukończyło 16. tydzień życia i posiada dojrzałą produkcję melatoniny.",
    clinicalAction: "Można bezpiecznie wprowadzać samodzielne nawyki zasypiania.",
  };
}

/**
 * Wykrywa asocjację ssania dla uspokojenia (Comfort Nursing) u starszych niemowląt.
 *
 * @param {readonly SleepLog[]} logs - Dzienniki snu dziecka
 * @returns {boolean} True jeśli nocne karmienia to małe porcje
 */
function isComfortNursingPattern(logs: readonly SleepLog[]): boolean {
  const nightLogs = logs.filter((l) => l.type === "night");
  let fedCount = 0;
  for (const log of nightLogs) {
    for (const waking of log.nightWakings) {
      if (waking.fedMilk) fedCount += 1;
    }
  }
  return fedCount >= HIGH_NIGHT_WAKINGS_THRESHOLD;
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
      diagnosisCode: "CAT7_NUTRITIONAL_NIGHT_HUNGER",
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
      diagnosisCode: "CAT7_COMFORT_NURSING_ASSOCIATION",
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
    diagnosisCode: "CAT7_BALANCED_NIGHT_NUTRITION",
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
  return [
    evaluateCat1SleepAssociations(input.recentSleepLogs),
    evaluateCat2BedtimeResistance(input.recentSleepLogs, input.currentMetrics.chronicSleepDebtMin),
    evaluateCat3EarlyWakingAndSplitNight(input),
    evaluateCat4ShortNapsAndTransitions(input),
    evaluateCat5RegressionsAndCrisis(input),
    evaluateCat6NewbornCare(input.currentMetrics.effectiveAgeDays),
    evaluateCat7NightWeaning(input),
  ];
}
