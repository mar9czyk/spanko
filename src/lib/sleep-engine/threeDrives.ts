import { getMinutesFromMidnightInTimeZone } from "./physiologicalDay";
import type {
  AgeBracketConfig,
  ChronicDriveResult,
  CircadianCalculationParams,
  CircadianParametersResult,
  DayMode,
  NextSleepSlotParams,
  NextSleepSlotPrediction,
  SleepNeedsProfile,
  SleepRestednessLevel,
} from "./types";

export const PREMATURITY_THRESHOLD_DAYS = 21;
export const PREMATURITY_CORRECTION_MAX_AGE_DAYS = 730;
export const MILLISECONDS_PER_DAY = 86_400_000;
export const MILLISECONDS_PER_MINUTE = 60_000;
export const MINUTES_PER_DAY = 1440;

export const MIN_CALIBRATION_DAYS = 5;
export const MIN_FILTERED_CALIBRATION_DAYS = 4;
export const REBOUND_MEDIAN_BUFFER_MINUTES = 100;
export const CHRONIC_EXPONENTIAL_WEIGHTS = [0.28, 0.22, 0.16, 0.12, 0.09, 0.07, 0.06] as const;
export const CHRONIC_WEIGHT_FALLBACK = 0.05;
export const CHRONIC_DEBT_MULTIPLIER = 3.5;
export const SLEEP_BATTERY_MIN_PERCENT = 15;
export const SLEEP_BATTERY_MAX_PERCENT = 100;
export const SLEEP_BATTERY_DEBT_DIVISOR = 2.5;
export const SLEEP_NEEDS_PROFILE_DELTA_MINUTES = 45;

export const DEFAULT_MORNING_WAKE_MINUTES = 420;
export const MIN_NIGHT_SLEEP_MINUTES = 600;
export const MAX_NIGHT_SLEEP_MINUTES = 690;
export const NIGHT_SLEEP_BUFFER_MINUTES = 60;
export const WMZ_START_OFFSET_MINUTES = 90;
export const WMZ_END_OFFSET_MINUTES = 30;
export const WMZ_MIN_AGE_DAYS = 112;
export const WMZ_MAX_CHRONIC_DEBT_MINUTES = 150;

export const MICRO_NAP_THRESHOLD_MINUTES = 20;
export const MICRO_NAP_FACTOR = 0.65;
export const SHORT_CYCLE_NAP_THRESHOLD_MINUTES = 45;
export const SHORT_CYCLE_NAP_PENALTY_MINUTES = 20;
export const RESTORATIVE_NAP_THRESHOLD_MINUTES = 95;
export const RESTORATIVE_NAP_BONUS_MINUTES = 12;

export const CHRONIC_DEBT_THRESHOLD_MINUTES = 75;
export const CHRONIC_DEBT_WAKE_WINDOW_REDUCTION_MINUTES = 15;
export const ILLNESS_WAKE_WINDOW_FACTOR = 0.8;
export const COMPASS_WINDOW_OFFSET_MINUTES = 15;

/**
 * Oblicza wiek efektywny dziecka w dniach z uwzględnieniem wieku korygowanego.
 *
 * @param {string} birthDateIso - Data urodzenia dziecka w formacie ISO
 * @param {string | null | undefined} dueDateIso - Planowana data porodu w formacie ISO
 * @param {string} nowIso - Bieżący czas odniesienia w formacie ISO
 * @returns {number} Wiek efektywny dziecka w dniach
 */
export function calculateEffectiveAgeDays(
  birthDateIso: string,
  dueDateIso: string | null | undefined,
  nowIso: string,
): number {
  const birthTimestamp = new Date(birthDateIso).getTime();
  const currentTimestamp = new Date(nowIso).getTime();
  const chronologicalDays = Math.floor((currentTimestamp - birthTimestamp) / MILLISECONDS_PER_DAY);

  if (!dueDateIso) return Math.max(0, chronologicalDays);

  const dueTimestamp = new Date(dueDateIso).getTime();
  const prematurityDays = Math.floor((dueTimestamp - birthTimestamp) / MILLISECONDS_PER_DAY);
  const isCorrectionActive =
    prematurityDays >= PREMATURITY_THRESHOLD_DAYS &&
    chronologicalDays < PREMATURITY_CORRECTION_MAX_AGE_DAYS;

  return isCorrectionActive
    ? Math.max(0, chronologicalDays - prematurityDays)
    : Math.max(0, chronologicalDays);
}

/**
 * Wylicza indywidualną normę dobową snu z odrzuceniem nocy odsypiania (rebound).
 *
 * @param {readonly { totalSleepMin: number }[]} validDays - Dni bez chorób i anomalii
 * @param {number} populationMedian - Mediana populacyjna dla danego wieku
 * @returns {number} Indywidualne zapotrzebowanie na sen w minutach
 */
function calculateIndividualNeed(
  validDays: readonly { totalSleepMin: number }[],
  populationMedian: number,
): number {
  if (validDays.length < MIN_CALIBRATION_DAYS) return populationMedian;
  const reboundThreshold = populationMedian + REBOUND_MEDIAN_BUFFER_MINUTES;
  const filtered = validDays.filter((d) => d.totalSleepMin <= reboundThreshold);
  const sample = filtered.length >= MIN_FILTERED_CALIBRATION_DAYS ? filtered : validDays;
  const total = sample.reduce((sum, item) => sum + item.totalSleepMin, 0);
  return Math.round(total / sample.length);
}

/**
 * Wylicza ważony wykładniczo dług senny z ostatnich 7 dób.
 *
 * @param {readonly { totalSleepMin: number }[]} validDays - Dni bez chorób
 * @param {number} individualNeed - Indywidualna norma dobowego snu
 * @returns {number} Zaokrąglony dług senny w minutach
 */
function calculateWeightedDeficit(
  validDays: readonly { totalSleepMin: number }[],
  individualNeed: number,
): number {
  const last7Days = validDays.slice(0, 7);
  let totalWeightedDeficit = 0;

  for (let index = 0; index < last7Days.length; index += 1) {
    const day = last7Days[index];
    if (!day) continue;
    const weight = CHRONIC_EXPONENTIAL_WEIGHTS[index] ?? CHRONIC_WEIGHT_FALLBACK;
    const deficit = individualNeed - day.totalSleepMin;
    totalWeightedDeficit += deficit * weight * CHRONIC_DEBT_MULTIPLIER;
  }

  return Math.round(totalWeightedDeficit);
}

/**
 * Określa profil potrzeb snu dziecka w oparciu o odchylenie od normy populacji.
 *
 * @param {number} delta - Różnica między indywidualną normą a medianą populacji
 * @returns {SleepNeedsProfile} Profil zapotrzebowania na sen
 */
function resolveSleepNeedsProfile(delta: number): SleepNeedsProfile {
  if (delta <= -SLEEP_NEEDS_PROFILE_DELTA_MINUTES) return "low_sleep_needs";
  if (delta >= SLEEP_NEEDS_PROFILE_DELTA_MINUTES) return "high_sleep_needs";
  return "average";
}

/**
 * Wylicza wskaźnik naładowania baterii snu dziecka w procentach (15% - 100%).
 *
 * @param {number} chronicDebtMinutes - Chroniczny dług senny w minutach
 * @returns {number} Poziom naładowania baterii w procentach
 */
function calculateBatteryPercent(chronicDebtMinutes: number): number {
  const penalty = Math.max(0, chronicDebtMinutes) / SLEEP_BATTERY_DEBT_DIVISOR;
  const score = Math.round(SLEEP_BATTERY_MAX_PERCENT - penalty);
  return Math.max(SLEEP_BATTERY_MIN_PERCENT, Math.min(SLEEP_BATTERY_MAX_PERCENT, score));
}

/**
 * Wylicza parametry chronicznego napędu snu: indywidualną normę, dług i baterię.
 *
 * @param {readonly { totalSleepMin: number; isIllOrIgnored: boolean }[]} dailyTotals - Dane z 14 dób
 * @param {AgeBracketConfig} bracket - Przedział wiekowy dziecka
 * @returns {ChronicDriveResult} Wynik analizy chronicznego napędu snu
 */
export function calculateChronicDrive(
  dailyTotals: readonly { totalSleepMin: number; isIllOrIgnored: boolean }[],
  bracket: AgeBracketConfig,
): ChronicDriveResult {
  const validDays = dailyTotals.filter((day) => !day.isIllOrIgnored);
  const individualSleepNeedMin = calculateIndividualNeed(validDays, bracket.medianTotalSleepMin);
  const chronicSleepDebtMin = calculateWeightedDeficit(validDays, individualSleepNeedMin);
  const sleepBatteryPercent = calculateBatteryPercent(chronicSleepDebtMin);
  const diffFromPopulation = individualSleepNeedMin - bracket.medianTotalSleepMin;
  const sleepNeedsProfile = resolveSleepNeedsProfile(diffFromPopulation);

  return {
    individualSleepNeedMin,
    chronicSleepDebtMin,
    sleepBatteryPercent,
    sleepNeedsProfile,
  };
}

/**
 * Przekłada chroniczny dług senny na słowny stan wyspania dla rodzica.
 * Progi pokrywają się z korektami silnika: powyżej CHRONIC_DEBT_THRESHOLD_MINUTES
 * okna czuwania są skracane, od WMZ_MAX_CHRONIC_DEBT_MINUTES wyłączane jest omijanie WMZ.
 *
 * @param {number} chronicSleepDebtMin - Chroniczny dług senny w minutach
 * @returns {SleepRestednessLevel} Stan wyspania dziecka
 */
export function resolveSleepRestedness(chronicSleepDebtMin: number): SleepRestednessLevel {
  if (chronicSleepDebtMin >= WMZ_MAX_CHRONIC_DEBT_MINUTES) return "very_tired";
  if (chronicSleepDebtMin > CHRONIC_DEBT_THRESHOLD_MINUTES) return "slightly_tired";
  return "rested";
}

/**
 * Formatuje liczbę minut od północy na format HH:mm.
 *
 * @param {number} totalMinutes - Minuty od północy
 * @returns {string} Godzina w formacie HH:mm
 */
export function formatMinutesToHoursMinutesString(totalMinutes: number): string {
  const normalized = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (normalized % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Wylicza parametry Zegara Okołodobowego: kotwicę poranną, porę snu, WMZ i capping.
 *
 * @param {CircadianCalculationParams} params - Czasy pobudek i konfiguracja wieku
 * @returns {CircadianParametersResult} Parametry rytmu okołodobowego
 */
export function calculateCircadianParameters(
  params: CircadianCalculationParams,
): CircadianParametersResult {
  const { morningWakeTimesLast5DaysMinutesFromMidnight, bracket } = params;
  const count = morningWakeTimesLast5DaysMinutesFromMidnight.length;
  const sum = morningWakeTimesLast5DaysMinutesFromMidnight.reduce((a, b) => a + b, 0);
  const avgWake = count > 0 ? Math.round(sum / count) : DEFAULT_MORNING_WAKE_MINUTES;

  const rawNight =
    bracket.medianTotalSleepMin - bracket.maxDaytimeSleepMin + NIGHT_SLEEP_BUFFER_MINUTES;
  const expectedNight = Math.min(
    MAX_NIGHT_SLEEP_MINUTES,
    Math.max(MIN_NIGHT_SLEEP_MINUTES, rawNight),
  );
  const bioBedtime = (avgWake + (MINUTES_PER_DAY - expectedNight)) % MINUTES_PER_DAY;
  const wmzStart = (bioBedtime - WMZ_START_OFFSET_MINUTES + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const wmzEnd = (bioBedtime - WMZ_END_OFFSET_MINUTES + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const latestNapEnd = (bioBedtime - bracket.wwMaxEvening + MINUTES_PER_DAY) % MINUTES_PER_DAY;

  return {
    circadianAnchorWakeTime: formatMinutesToHoursMinutesString(avgWake),
    biologicalBedtime: formatMinutesToHoursMinutesString(bioBedtime),
    forbiddenZoneStart: formatMinutesToHoursMinutesString(wmzStart),
    forbiddenZoneEnd: formatMinutesToHoursMinutesString(wmzEnd),
    latestLastNapEndAt: formatMinutesToHoursMinutesString(latestNapEnd),
    biologicalBedtimeMinFromMidnight: bioBedtime,
  };
}

/**
 * Aplikuje modyfikatory długości okna czuwania po poprzedniej drzemce.
 *
 * @param {number} baseMinutes - Bazowe okno czuwania
 * @param {number | null} durationMinutes - Czas trwania poprzedniej drzemki
 * @param {number} minMorningMinutes - Minimalne dopuszczalne poranne okno
 * @returns {{ adjustedMinutes: number; reasonCode: string }} Zmodyfikowany czas i powód
 */
function applyNapAdjustment(
  baseMinutes: number,
  durationMinutes: number | null,
  minMorningMinutes: number,
): { adjustedMinutes: number; reasonCode: string } {
  if (durationMinutes === null)
    return { adjustedMinutes: baseMinutes, reasonCode: "BASE_AGE_INTERPOLATION" };
  if (durationMinutes < MICRO_NAP_THRESHOLD_MINUTES) {
    return {
      adjustedMinutes: Math.round(baseMinutes * MICRO_NAP_FACTOR),
      reasonCode: "MICRO_NAP_PENALTY_35PCT",
    };
  }
  if (durationMinutes < SHORT_CYCLE_NAP_THRESHOLD_MINUTES) {
    return {
      adjustedMinutes: Math.max(minMorningMinutes, baseMinutes - SHORT_CYCLE_NAP_PENALTY_MINUTES),
      reasonCode: "SHORT_CYCLE_NAP_PENALTY_20M",
    };
  }
  if (durationMinutes > RESTORATIVE_NAP_THRESHOLD_MINUTES) {
    return {
      adjustedMinutes: baseMinutes + RESTORATIVE_NAP_BONUS_MINUTES,
      reasonCode: "RESTORATIVE_NAP_BONUS",
    };
  }
  return { adjustedMinutes: baseMinutes, reasonCode: "BASE_AGE_INTERPOLATION" };
}

/**
 * Koryguje okno czuwania o dług senny i tryb dnia.
 *
 * @param {number} currentMinutes - Dotychczasowe okno czuwania
 * @param {number} debtMinutes - Chroniczny dług senny
 * @param {DayMode} dayMode - Bieżący tryb dnia dziecka
 * @returns {{ windowMinutes: number; reasonCode?: string }} Skorygowane okno czuwania
 */
function applyDebtAndModeAdjustment(
  currentMinutes: number,
  debtMinutes: number,
  dayMode: DayMode,
): { windowMinutes: number; reasonCode?: string } {
  let minutes = currentMinutes;
  let code: string | undefined;

  if (debtMinutes > CHRONIC_DEBT_THRESHOLD_MINUTES) {
    minutes -= CHRONIC_DEBT_WAKE_WINDOW_REDUCTION_MINUTES;
    code = "CHRONIC_SLEEP_DEBT_COMPENSATION";
  }

  if (dayMode === "illness_regression") {
    minutes = Math.round(minutes * ILLNESS_WAKE_WINDOW_FACTOR);
    code = "ILLNESS_PROTECTIVE_MODE";
  }

  return { windowMinutes: minutes, reasonCode: code };
}

/**
 * Sprawdza i koryguje SweetSpot o przesunięcie poza Strefę Zakazaną (WMZ).
 *
 * @param {number} candidateMinutesFromMidnight - Kandydat na godzinę snu
 * @param {number} bioBedtime - Biologiczny czas snu
 * @param {number} chronicDebt - Chroniczny dług senny
 * @returns {number} Minuty przesunięcia
 */
function resolveWmzShiftMinutes(
  candidateMinutesFromMidnight: number,
  bioBedtime: number,
  chronicDebt: number,
): number {
  if (chronicDebt >= WMZ_MAX_CHRONIC_DEBT_MINUTES) return 0;
  const wmzStart = (bioBedtime - WMZ_START_OFFSET_MINUTES + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const wmzEnd = (bioBedtime - WMZ_END_OFFSET_MINUTES + MINUTES_PER_DAY) % MINUTES_PER_DAY;

  const isInWmz =
    wmzStart <= wmzEnd
      ? candidateMinutesFromMidnight >= wmzStart && candidateMinutesFromMidnight <= wmzEnd
      : candidateMinutesFromMidnight >= wmzStart || candidateMinutesFromMidnight <= wmzEnd;

  return isInWmz
    ? (bioBedtime - candidateMinutesFromMidnight + MINUTES_PER_DAY) % MINUTES_PER_DAY
    : 0;
}

/**
 * Oblicza docelową długość okna czuwania przed uwzględnieniem Zegara Biologicznego.
 *
 * @param {NextSleepSlotParams} params - Parametry obliczenia okna
 * @returns {{ targetMinutes: number; reasonCode: string }} Obliczone okno i powód
 */
function calculateTargetWindow(params: NextSleepSlotParams): {
  targetMinutes: number;
  reasonCode: string;
} {
  const { previousNapDurationMin, napIndexToday, bracket } = params;
  const progressRatio = Math.min(1, napIndexToday / Math.max(1, bracket.targetNapsCount));
  const baseMinutes = Math.round(
    bracket.wwMinMorning + progressRatio * (bracket.wwMaxEvening - bracket.wwMinMorning),
  );

  const napAdj = applyNapAdjustment(baseMinutes, previousNapDurationMin, bracket.wwMinMorning);
  const modeAdj = applyDebtAndModeAdjustment(
    napAdj.adjustedMinutes,
    params.chronicSleepDebtMin,
    params.dayMode,
  );
  const reasonCode = modeAdj.reasonCode ?? napAdj.reasonCode;
  const targetMinutes = modeAdj.windowMinutes + params.insightWwOffsetMin;

  return { targetMinutes, reasonCode };
}

/**
 * Koryguje moment snu o Strefę Zakazaną (WMZ) dla pory wieczornej.
 *
 * @param {number} initialMs - Początkowy timestamp snu
 * @param {number} targetMinutes - Wyliczone okno czuwania
 * @param {NextSleepSlotParams} params - Parametry wejściowe
 * @returns {{ adjustedMs: number; finalMinutes: number; reasonCode?: string }} Skorygowany czas
 */
function applyWmzAdjustment(
  initialMs: number,
  targetMinutes: number,
  params: NextSleepSlotParams,
): { adjustedMs: number; finalMinutes: number; reasonCode?: string } {
  const isBedtime = params.napIndexToday >= params.bracket.targetNapsCount;
  if (
    !isBedtime ||
    params.effectiveAgeDays < WMZ_MIN_AGE_DAYS ||
    params.dayMode === "illness_regression"
  ) {
    return { adjustedMs: initialMs, finalMinutes: targetMinutes };
  }

  // Kotwica poranna i biologiczna pora snu są w czasie lokalnym dziecka, więc kandydat też
  const candidateMin = getMinutesFromMidnightInTimeZone(initialMs, params.timeZone);
  const shift = resolveWmzShiftMinutes(
    candidateMin,
    params.biologicalBedtimeMinFromMidnight,
    params.chronicSleepDebtMin,
  );

  if (shift > 0) {
    return {
      adjustedMs: initialMs + shift * MILLISECONDS_PER_MINUTE,
      finalMinutes: targetMinutes + shift,
      reasonCode: "CIRCADIAN_WMZ_AVOIDANCE_SHIFT",
    };
  }
  return { adjustedMs: initialMs, finalMinutes: targetMinutes };
}

/**
 * Wyznacza kolejne okno snu (SweetSpot) oraz przedział Compass Window.
 *
 * @param {NextSleepSlotParams} params - Parametry ostatniej pobudki, długu i zegara
 * @returns {NextSleepSlotPrediction} Wyliczone okno snu wraz z uzasadnieniem
 */
export function predictNextSleepSlot(params: NextSleepSlotParams): NextSleepSlotPrediction {
  const { targetMinutes, reasonCode } = calculateTargetWindow(params);
  const initialMs =
    new Date(params.lastWakeUpIso).getTime() + targetMinutes * MILLISECONDS_PER_MINUTE;
  const wmz = applyWmzAdjustment(initialMs, targetMinutes, params);
  const offsetMs = COMPASS_WINDOW_OFFSET_MINUTES * MILLISECONDS_PER_MINUTE;

  return {
    sweetSpotIso: new Date(wmz.adjustedMs).toISOString(),
    compassWindowStartIso: new Date(wmz.adjustedMs - offsetMs).toISOString(),
    compassWindowEndIso: new Date(wmz.adjustedMs + offsetMs).toISOString(),
    targetWakeWindowMin: wmz.finalMinutes,
    reasonCode: wmz.reasonCode ?? reasonCode,
  };
}
