import { resolveOnTheGoBedtimeAdvance } from "./dayModes";
import { getMinutesFromMidnightInTimeZone } from "./physiologicalDay";
import type {
  AgeBracketConfig,
  ChronicDriveResult,
  CircadianCalculationParams,
  CircadianParametersResult,
  DailySleepSummary,
  DayMode,
  NextSleepSlotParams,
  NextSleepSlotPrediction,
  SleepNeedsProfile,
  SleepRestednessLevel,
} from "./types";

/** Korekta wieku od >21 dni przed terminem, czyli poród <37+0 tc. (NICE NG72, WHO). */
export const PREMATURITY_THRESHOLD_DAYS = 21;
export const PREMATURITY_CORRECTION_MAX_AGE_DAYS = 730;
export const MILLISECONDS_PER_DAY = 86_400_000;
export const MILLISECONDS_PER_MINUTE = 60_000;
export const MINUTES_PER_DAY = 1440;

// Norma indywidualna: mediana z ≥7 pełnych dób (typowo 7 nocy w badaniach, Sadeh 1995)
export const MIN_CALIBRATION_DAYS = 7;
export const MIN_FILTERED_CALIBRATION_DAYS = 5;
// Dni odbicia wg spec v2.0: noc +90 min albo drzemka >150 min po długu >120 min (heurystyka)
export const REBOUND_NIGHT_EXCESS_MINUTES = 90;
export const REBOUND_NAP_MINUTES = 150;
export const REBOUND_PRIOR_DEBT_MINUTES = 120;
// Dług: ważona średnia odchylenia od normy z 3 ostatnich dób, bo kompensacja następuje
// w ok. 24 h (Lassonde 2016); wagi to heurystyka Spanko
export const CHRONIC_DEBT_WEIGHTS = [0.5, 0.3, 0.2] as const;
export const SLEEP_BATTERY_MIN_PERCENT = 15;
export const SLEEP_BATTERY_MAX_PERCENT = 100;
export const SLEEP_BATTERY_DEBT_DIVISOR = 2.5;
// Profil potrzeb snu: ±1 SD sumy doby (Galland 2012: ok. 1,6 h u niemowląt, ok. 1 h u maluchów)
export const SLEEP_NEEDS_SD_INFANT_MINUTES = 90;
export const SLEEP_NEEDS_SD_TODDLER_MINUTES = 60;
export const TODDLER_MIN_AGE_DAYS = 365;

export const DEFAULT_MORNING_WAKE_MINUTES = 420;
export const MIN_NIGHT_SLEEP_MINUTES = 600;
export const MAX_NIGHT_SLEEP_MINUTES = 690;
export const NIGHT_SLEEP_BUFFER_MINUTES = 60;
// Kotwica: pora kładzenia lepiej przewiduje DLMO niż pobudka (Akacem 2016), więc mieszamy obie
export const MIN_OBSERVED_BEDTIMES = 3;
export const OBSERVED_BEDTIME_WEIGHT = 0.5;
export const MAX_OBSERVED_BEDTIME_DEVIATION_MINUTES = 120;
export const MAX_BEDTIME_SHIFT_MINUTES = 30;
export const MAX_DAYTIME_CAP_OFFSET_MINUTES = 60;
export const MIN_SUGGESTED_NAP_MINUTES = 30;
// WMZ 90–30 min przed snem: heurystyka (strefa istnieje, Giganti 2001; okno bez źródła)
export const WMZ_START_OFFSET_MINUTES = 90;
export const WMZ_END_OFFSET_MINUTES = 30;
// Rytm dobowy rampą: start od 10 tyg. (spec v2.0; Joseph 2015, Kennaway 1996), pełny od 16 tyg.
export const CIRCADIAN_RAMP_START_DAYS = 70;
export const WMZ_MIN_AGE_DAYS = 112;
export const WMZ_MAX_CHRONIC_DEBT_MINUTES = 150;
// Od 16 tyg. pora snu nocnego najwyżej 30 min po przewidywanej
export const BEDTIME_LATE_TOLERANCE_MINUTES = 30;

// Korekty po drzemce: kierunek zgodny z Lassonde 2016, wartości to heurystyka
export const MICRO_NAP_THRESHOLD_MINUTES = 20;
export const MICRO_NAP_FACTOR = 0.65;
export const SHORT_CYCLE_NAP_THRESHOLD_MINUTES = 45;
export const SHORT_CYCLE_NAP_PENALTY_MINUTES = 20;
export const RESTORATIVE_NAP_THRESHOLD_MINUTES = 95;
export const RESTORATIVE_NAP_BONUS_MINUTES = 12;

// Progi długu (średni dobowy niedobór względem własnej normy): heurystyka
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
    prematurityDays > PREMATURITY_THRESHOLD_DAYS &&
    chronologicalDays < PREMATURITY_CORRECTION_MAX_AGE_DAYS;

  return isCorrectionActive
    ? Math.max(0, chronologicalDays - prematurityDays)
    : Math.max(0, chronologicalDays);
}

/** Doba używana do kalibracji normy i długu (data nie jest potrzebna). */
type CalibrationDay = Omit<DailySleepSummary, "physiologicalDate">;

/**
 * Mediana zaokrąglona do pełnych minut.
 *
 * @param {readonly number[]} values - Niepusta lista wartości
 * @returns {number} Mediana
 */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0
      ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
      : (sorted[middle] ?? 0);
  return Math.round(value);
}

/**
 * Wylicza dług jako ważoną średnią niedoboru snu względem normy z ostatnich 3 dób.
 *
 * @param {readonly { totalSleepMin: number }[]} days - Doby, najnowsza pierwsza
 * @param {number} norm - Norma dobowego snu
 * @returns {number} Średni ważony niedobór w minutach (ujemny = nadwyżka)
 */
function calculateWeightedDeficit(
  days: readonly { totalSleepMin: number }[],
  norm: number,
): number {
  const horizon = days.slice(0, CHRONIC_DEBT_WEIGHTS.length);
  let weighted = 0;
  let weightSum = 0;
  horizon.forEach((day, index) => {
    const weight = CHRONIC_DEBT_WEIGHTS[index] ?? 0;
    weighted += (norm - day.totalSleepMin) * weight;
    weightSum += weight;
  });
  return weightSum > 0 ? Math.round(weighted / weightSum) : 0;
}

/**
 * Sprawdza, czy doba jest odsypianiem (rebound) wg spec v2.0.
 *
 * @param {readonly DailySleepSummary[]} days - Doby, najnowsza pierwsza
 * @param {number} index - Indeks sprawdzanej doby
 * @param {number} provisionalNeed - Wstępna norma doby
 * @param {number | null} provisionalNight - Wstępna norma nocy (null = brak danych o nocach)
 * @returns {boolean} Czy doba jest odsypianiem
 */
function isReboundDay(
  days: readonly CalibrationDay[],
  index: number,
  provisionalNeed: number,
  provisionalNight: number | null,
): boolean {
  const day = days[index];
  if (!day) return false;
  if (day.isRebound) return true;
  const priorDebt = calculateWeightedDeficit(days.slice(index + 1), provisionalNeed);
  if (priorDebt <= REBOUND_PRIOR_DEBT_MINUTES) return false;
  const nightExcess =
    provisionalNight !== null && day.nightSleepMin !== undefined
      ? day.nightSleepMin - provisionalNight
      : day.totalSleepMin - provisionalNeed;
  return (
    nightExcess > REBOUND_NIGHT_EXCESS_MINUTES || (day.longestNapMin ?? 0) > REBOUND_NAP_MINUTES
  );
}

/**
 * Wylicza indywidualną normę dobową snu: mediana z ≥7 pełnych dób bez dni odsypiania.
 *
 * @param {readonly DailySleepSummary[]} validDays - Doby bez chorób i anomalii, najnowsza pierwsza
 * @param {number} populationMedian - Mediana populacyjna dla danego wieku (gdy danych za mało)
 * @returns {number} Indywidualne zapotrzebowanie na sen w minutach
 */
function calculateIndividualNeed(
  validDays: readonly CalibrationDay[],
  populationMedian: number,
): number {
  if (validDays.length < MIN_CALIBRATION_DAYS) return populationMedian;
  const provisionalNeed = median(validDays.map((d) => d.totalSleepMin));
  const nights = validDays.flatMap((d) => (d.nightSleepMin === undefined ? [] : [d.nightSleepMin]));
  const provisionalNight = nights.length > 0 ? median(nights) : null;
  const filtered = validDays.filter(
    (_, index) => !isReboundDay(validDays, index, provisionalNeed, provisionalNight),
  );
  return filtered.length >= MIN_FILTERED_CALIBRATION_DAYS
    ? median(filtered.map((d) => d.totalSleepMin))
    : provisionalNeed;
}

/**
 * Zwraca 1 SD sumy snu doby dla wieku (próg profilu potrzeb snu).
 *
 * @param {AgeBracketConfig} bracket - Przedział wiekowy
 * @returns {number} Odchylenie standardowe w minutach
 */
function resolveSleepNeedsSdMinutes(bracket: AgeBracketConfig): number {
  return bracket.minAgeDays >= TODDLER_MIN_AGE_DAYS
    ? SLEEP_NEEDS_SD_TODDLER_MINUTES
    : SLEEP_NEEDS_SD_INFANT_MINUTES;
}

/**
 * Określa profil potrzeb snu dziecka: poza ±1 SD populacji dla wieku.
 *
 * @param {number} delta - Różnica między indywidualną normą a medianą populacji
 * @param {number} sdMinutes - 1 SD sumy snu doby dla wieku
 * @returns {SleepNeedsProfile} Profil zapotrzebowania na sen
 */
function resolveSleepNeedsProfile(delta: number, sdMinutes: number): SleepNeedsProfile {
  if (delta <= -sdMinutes) return "low_sleep_needs";
  if (delta >= sdMinutes) return "high_sleep_needs";
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
 * Wylicza parametry chronicznego napędu snu: indywidualną normę, dług i wskaźnik wyspania.
 *
 * @description
 * Dług to ważona średnia niedoboru snu względem własnej normy dziecka z ostatnich 3 pełnych dób
 * (wskaźnik orientacyjny, nie miara fizjologiczna). Norma to mediana z ≥7 dób bez odsypiania,
 * a przy mniejszej liczbie dób mediana populacyjna dla wieku.
 *
 * @param {readonly CalibrationDay[]} dailyTotals - Pełne doby (do 14), najnowsza pierwsza
 * @param {AgeBracketConfig} bracket - Przedział wiekowy dziecka
 * @returns {ChronicDriveResult} Wynik analizy chronicznego napędu snu
 */
export function calculateChronicDrive(
  dailyTotals: readonly CalibrationDay[],
  bracket: AgeBracketConfig,
): ChronicDriveResult {
  const validDays = dailyTotals.filter((day) => !day.isIllOrIgnored);
  const individualSleepNeedMin = calculateIndividualNeed(validDays, bracket.medianTotalSleepMin);
  const chronicSleepDebtMin = calculateWeightedDeficit(validDays, individualSleepNeedMin);
  const sleepBatteryPercent = calculateBatteryPercent(chronicSleepDebtMin);
  const diffFromPopulation = individualSleepNeedMin - bracket.medianTotalSleepMin;
  const sleepNeedsProfile = resolveSleepNeedsProfile(
    diffFromPopulation,
    resolveSleepNeedsSdMinutes(bracket),
  );

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
 * Zwraca różnicę `from − to` w minutach znormalizowaną do zakresu (−720, 720].
 *
 * @param {number} from - Minuty od północy
 * @param {number} to - Minuty od północy
 * @returns {number} Różnica ze znakiem (+ = `from` później niż `to`)
 */
export function signedMinutesDifference(from: number, to: number): number {
  const diff = (((from - to) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return diff > MINUTES_PER_DAY / 2 ? diff - MINUTES_PER_DAY : diff;
}

/**
 * Ogranicza wartość do zakresu i zaokrągla do pełnych minut (niepoprawna = 0).
 *
 * @param {number | undefined} value - Wartość wejściowa
 * @param {number} min - Dolna granica
 * @param {number} max - Górna granica
 * @returns {number} Wartość w zakresie
 */
function clampMinutes(value: number | undefined, min: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * Średnie odchylenie faktycznych pór zaśnięcia od pory wyliczonej z pobudki (z limitem).
 *
 * @param {readonly number[] | undefined} bedtimes - Pory zaśnięcia na noc (minuty od północy)
 * @param {number} formulaBedtime - Pora wyliczona z kotwicy porannej
 * @returns {number} Odchylenie w minutach (0, gdy za mało obserwacji)
 */
function observedBedtimeDeviation(
  bedtimes: readonly number[] | undefined,
  formulaBedtime: number,
): number {
  if (!bedtimes || bedtimes.length < MIN_OBSERVED_BEDTIMES) return 0;
  const deviations = bedtimes.map((bedtime) =>
    clampMinutes(
      signedMinutesDifference(bedtime, formulaBedtime),
      -MAX_OBSERVED_BEDTIME_DEVIATION_MINUTES,
      MAX_OBSERVED_BEDTIME_DEVIATION_MINUTES,
    ),
  );
  return deviations.reduce((sum, value) => sum + value, 0) / deviations.length;
}

/**
 * Wylicza parametry Zegara Okołodobowego: kotwicę poranną, przewidywaną porę snu, WMZ i capping.
 *
 * @description
 * Przewidywana pora snu nocnego to heurystyka: pobudka + (24 h − oczekiwany sen nocny), wymieszana
 * pół na pół z faktycznymi porami zaśnięcia z 5 dób (Akacem 2016: pora kładzenia najlepiej
 * przewiduje fazę melatoniny). Korekty z drzew: bedtime fading przesuwa porę snu (±30 min),
 * nap capping przyspiesza koniec ostatniej drzemki (do 60 min).
 *
 * @param {CircadianCalculationParams} params - Czasy pobudek i zaśnięć, konfiguracja wieku, korekty drzew
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
  const formulaBedtime = avgWake + (MINUTES_PER_DAY - expectedNight);
  const observedShift = Math.round(
    OBSERVED_BEDTIME_WEIGHT *
      observedBedtimeDeviation(params.bedtimesLast5DaysMinutesFromMidnight, formulaBedtime),
  );
  const fadingShift = clampMinutes(
    params.bedtimeShiftMin,
    -MAX_BEDTIME_SHIFT_MINUTES,
    MAX_BEDTIME_SHIFT_MINUTES,
  );
  const bioBedtime =
    (((formulaBedtime + observedShift + fadingShift) % MINUTES_PER_DAY) + MINUTES_PER_DAY) %
    MINUTES_PER_DAY;
  const wmzStart = (bioBedtime - WMZ_START_OFFSET_MINUTES + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const wmzEnd = (bioBedtime - WMZ_END_OFFSET_MINUTES + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const capOffset = clampMinutes(
    params.daytimeSleepCapOffsetMin,
    -MAX_DAYTIME_CAP_OFFSET_MINUTES,
    0,
  );
  const latestNapEnd =
    (bioBedtime - bracket.wwMaxEvening + capOffset + 2 * MINUTES_PER_DAY) % MINUTES_PER_DAY;

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
 * Proponuje porę wybudzenia z trwającej drzemki, gdy drzewo zaleca ograniczenie snu w dzień.
 *
 * @description
 * Miękka sugestia (nie limit): dzienny limit = `maxDaytimeSleepMin` przedziału skrócony o korektę
 * drzewa (do 60 min), a pojedyncza drzemka nie dłuższa niż `maxSingleNapMin` i nie krótsza niż 30 min.
 *
 * @param {object} params - Start drzemki, dotychczasowy sen dzienny, przedział i korekta drzewa
 * @returns {string | null} Sugerowana pora wybudzenia (ISO) albo null, gdy drzewo nic nie zaleca
 */
export function suggestNapWakeTime(params: {
  readonly napStartIso: string;
  readonly daytimeSleepBeforeNapMin: number;
  readonly bracket: AgeBracketConfig;
  readonly daytimeSleepCapOffsetMin: number;
}): string | null {
  const capOffset = clampMinutes(
    params.daytimeSleepCapOffsetMin,
    -MAX_DAYTIME_CAP_OFFSET_MINUTES,
    0,
  );
  if (capOffset === 0) return null;
  const dailyCap = params.bracket.maxDaytimeSleepMin + capOffset;
  const remaining = dailyCap - Math.max(0, params.daytimeSleepBeforeNapMin);
  const napMinutes = Math.min(
    params.bracket.maxSingleNapMin,
    Math.max(MIN_SUGGESTED_NAP_MINUTES, remaining),
  );
  return new Date(
    new Date(params.napStartIso).getTime() + napMinutes * MILLISECONDS_PER_MINUTE,
  ).toISOString();
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
 * @param {number} bioBedtime - Przewidywana pora snu nocnego
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
 * Sprawdza, czy kolejny sen to sen nocny (dziecko ma już za sobą drzemki zaplanowane na dzień).
 *
 * @param {NextSleepSlotParams} params - Parametry obliczenia okna
 * @returns {boolean} Czy prognozujemy porę snu nocnego
 */
function isBedtimeSlot(params: NextSleepSlotParams): boolean {
  return params.napIndexToday >= params.bracket.targetNapsCount;
}

/**
 * Oblicza okno czuwania w dniu bez drzemki: od pobudki do przewidywanej pory snu nocnego.
 *
 * @param {NextSleepSlotParams} params - Parametry obliczenia okna
 * @returns {number} Okno czuwania w minutach (nie krótsze niż wieczorne okno z matrycy)
 */
function calculateNoNapDayWindow(params: NextSleepSlotParams): number {
  const wakeMinutes = getMinutesFromMidnightInTimeZone(params.lastWakeUpIso, params.timeZone);
  const untilBedtime =
    (params.biologicalBedtimeMinFromMidnight - wakeMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return Math.max(params.bracket.wwMaxEvening, untilBedtime);
}

/**
 * Oblicza docelową długość okna czuwania przed uwzględnieniem rytmu dobowego.
 *
 * @param {NextSleepSlotParams} params - Parametry obliczenia okna
 * @returns {{ targetMinutes: number; reasonCode: string }} Obliczone okno i powód
 */
function calculateTargetWindow(params: NextSleepSlotParams): {
  targetMinutes: number;
  reasonCode: string;
} {
  const { previousNapDurationMin, napIndexToday, bracket } = params;
  if (bracket.targetNapsCount === 0 && napIndexToday === 0) {
    return { targetMinutes: calculateNoNapDayWindow(params), reasonCode: "NO_NAP_DAY_BEDTIME" };
  }
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
 * Waga rytmu dobowego dla wieku: 0 przed 10. tyg., liniowo do 1 w 16. tyg.
 *
 * @param {number} effectiveAgeDays - Wiek efektywny w dniach
 * @returns {number} Waga z zakresu 0–1
 */
export function resolveCircadianWeight(effectiveAgeDays: number): number {
  if (effectiveAgeDays <= CIRCADIAN_RAMP_START_DAYS) return 0;
  if (effectiveAgeDays >= WMZ_MIN_AGE_DAYS) return 1;
  return (
    (effectiveAgeDays - CIRCADIAN_RAMP_START_DAYS) / (WMZ_MIN_AGE_DAYS - CIRCADIAN_RAMP_START_DAYS)
  );
}

/**
 * Wylicza przesunięcie pory snu nocnego wynikające z rytmu dobowego.
 *
 * @description
 * Kandydat w WMZ przesuwany jest na przewidywaną porę snu (od 10. tyg. częściowo, od 16. tyg. w pełni).
 * Od 16. tyg. pora snu nie wypada też później niż 30 min po przewidywanej, o ile okno czuwania
 * nie spadnie poniżej porannego minimum.
 *
 * @param {number} candidateMin - Kandydat na porę snu (minuty od północy, czas lokalny)
 * @param {number} targetMinutes - Wyliczone okno czuwania
 * @param {NextSleepSlotParams} params - Parametry wejściowe
 * @returns {{ shift: number; reasonCode?: string }} Przesunięcie w minutach i powód
 */
function resolveCircadianShift(
  candidateMin: number,
  targetMinutes: number,
  params: NextSleepSlotParams,
): { shift: number; reasonCode?: string } {
  const bioBedtime = params.biologicalBedtimeMinFromMidnight;
  const weight = resolveCircadianWeight(params.effectiveAgeDays);
  const wmzShift = Math.round(
    weight * resolveWmzShiftMinutes(candidateMin, bioBedtime, params.chronicSleepDebtMin),
  );
  if (wmzShift > 0) return { shift: wmzShift, reasonCode: "CIRCADIAN_WMZ_AVOIDANCE_SHIFT" };

  if (params.effectiveAgeDays < WMZ_MIN_AGE_DAYS) return { shift: 0 };
  const lateBy = signedMinutesDifference(candidateMin, bioBedtime) - BEDTIME_LATE_TOLERANCE_MINUTES;
  const maxPullBack = Math.max(0, targetMinutes - params.bracket.wwMinMorning);
  const pullBack = Math.min(lateBy, maxPullBack);
  return pullBack > 0
    ? { shift: -pullBack, reasonCode: "CIRCADIAN_BEDTIME_LATE_CAP" }
    : { shift: 0 };
}

/**
 * Koryguje porę snu nocnego o rytm dobowy (WMZ i górna granica pory snu).
 *
 * @param {number} initialMs - Początkowy timestamp snu
 * @param {number} targetMinutes - Wyliczone okno czuwania
 * @param {NextSleepSlotParams} params - Parametry wejściowe
 * @returns {{ adjustedMs: number; finalMinutes: number; reasonCode?: string }} Skorygowany czas
 */
function applyCircadianAdjustment(
  initialMs: number,
  targetMinutes: number,
  params: NextSleepSlotParams,
): { adjustedMs: number; finalMinutes: number; reasonCode?: string } {
  const isNoNapDay = params.bracket.targetNapsCount === 0 && params.napIndexToday === 0;
  if (!isBedtimeSlot(params) || isNoNapDay || params.dayMode === "illness_regression") {
    return { adjustedMs: initialMs, finalMinutes: targetMinutes };
  }

  // Kotwica poranna i przewidywana pora snu są w czasie lokalnym dziecka, więc kandydat też
  const candidateMin = getMinutesFromMidnightInTimeZone(initialMs, params.timeZone);
  const onTheGo = resolveOnTheGoEarlyBedtime(initialMs, candidateMin, targetMinutes, params);
  if (onTheGo) return onTheGo;
  const { shift, reasonCode } = resolveCircadianShift(candidateMin, targetMinutes, params);
  if (shift === 0) return { adjustedMs: initialMs, finalMinutes: targetMinutes };
  return {
    adjustedMs: initialMs + shift * MILLISECONDS_PER_MINUTE,
    finalMinutes: targetMinutes + shift,
    reasonCode,
  };
}

/**
 * Wcześniejszy sen nocny po dniu „W drodze” z niedoborem drzemek (bez Strefy Zakazanej).
 *
 * @description
 * Cel: przewidywana pora snu minus połowa niedoboru drzemek (maks. 60 min). Jak przy dużym długu
 * pomijamy WMZ, bo przemęczone dziecko zasypia łatwiej wcześniej. Okno nie spada poniżej
 * porannego minimum. Kandydat już wcześniejszy niż cel zostaje bez zmian.
 *
 * @param {number} initialMs - Kandydat na porę snu (timestamp)
 * @param {number} candidateMin - Kandydat w minutach od północy (czas lokalny)
 * @param {number} targetMinutes - Wyliczone okno czuwania
 * @param {NextSleepSlotParams} params - Parametry wejściowe
 * @returns {{ adjustedMs: number; finalMinutes: number; reasonCode?: string } | null} Wynik albo null
 */
function resolveOnTheGoEarlyBedtime(
  initialMs: number,
  candidateMin: number,
  targetMinutes: number,
  params: NextSleepSlotParams,
): { adjustedMs: number; finalMinutes: number; reasonCode?: string } | null {
  if (params.dayMode !== "on_the_go") return null;
  const advance = resolveOnTheGoBedtimeAdvance(
    params.todayDaytimeSleepMin ?? 0,
    params.usualDaytimeSleepMin ?? null,
  );
  if (advance === 0) return null;
  const earlyBedtime = params.biologicalBedtimeMinFromMidnight - advance;
  const lateBy = signedMinutesDifference(candidateMin, earlyBedtime);
  const maxPullBack = Math.max(0, targetMinutes - params.bracket.wwMinMorning);
  const pullBack = Math.max(0, Math.min(lateBy, maxPullBack));
  return {
    adjustedMs: initialMs - pullBack * MILLISECONDS_PER_MINUTE,
    finalMinutes: targetMinutes - pullBack,
    reasonCode: pullBack > 0 ? "ON_THE_GO_EARLY_BEDTIME" : undefined,
  };
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
  const circadian = applyCircadianAdjustment(initialMs, targetMinutes, params);
  const offsetMs = COMPASS_WINDOW_OFFSET_MINUTES * MILLISECONDS_PER_MINUTE;

  return {
    sweetSpotIso: new Date(circadian.adjustedMs).toISOString(),
    compassWindowStartIso: new Date(circadian.adjustedMs - offsetMs).toISOString(),
    compassWindowEndIso: new Date(circadian.adjustedMs + offsetMs).toISOString(),
    targetWakeWindowMin: circadian.finalMinutes,
    reasonCode: circadian.reasonCode ?? reasonCode,
  };
}
