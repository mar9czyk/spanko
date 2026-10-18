/**
 * Moduł wyznaczania granicy doby fizjologicznej niemowlęcia.
 *
 * @description
 * Doba fizjologiczna dziecka trwa od momentu porannej pobudki ze snu nocnego
 * do kolejnej porannej pobudki następnego dnia. Sen nocny i wszystkie nocne pobudki
 * są przypisywane do doby, w której rozpoczęła się dana noc.
 */

import type { SleepLog } from "./types";

export type { SleepLog };

export const DEFAULT_NIGHT_FALLBACK_CUTOFF_HOUR = 6;
export const MILLISECONDS_IN_DAY = 86_400_000;
export const DEFAULT_TIME_ZONE = "Europe/Warsaw";

export interface NightSleepReference {
  /** Data fizjologiczna snu nocnego w formacie YYYY-MM-DD */
  readonly physiologicalDate: string;
  /** Moment zaśnięcia lub odłożenia dziecka do snu nocnego */
  readonly fellAsleepAt: Date | string | number;
  /** Moment porannej pobudki kończącej sen nocny (null lub undefined jeśli sen wciąż trwa) */
  readonly wokeUpAt?: Date | string | number | null;
}

export interface ResolvePhysiologicalDateOptions {
  /** Czas badanego zdarzenia (np. wpis karmienia, pobudki, sen) */
  readonly eventTimestamp: Date | string | number;
  /** Informacja o aktywnym lub niedawno zakończonym śnie nocnym (referencja lub SleepLog) */
  readonly activeOrRecentNightSleep?: NightSleepReference | SleepLog | null;
  /** Godzina graniczna fallbacku nocnego (domyślnie 6:00 rano) */
  readonly fallbackCutoffHour?: number;
  /** Strefa IANA, w której liczona jest doba (domyślnie Europe/Warsaw, niezależnie od strefy serwera) */
  readonly timeZone?: string;
}

/**
 * Konwertuje timestamp na liczbę milisekund od epoki Unix.
 *
 * @param {Date | string | number} timestamp - Data w dowolnym formacie
 * @returns {number} Liczba milisekund
 */
export function parseTimestampToMilliseconds(timestamp: Date | string | number): number {
  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }
  return new Date(timestamp).getTime();
}

interface CalendarParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
}

/**
 * Rozkłada moment w czasie na składowe kalendarzowe w podanej strefie czasowej.
 *
 * @param {Date} date - Moment w czasie
 * @param {string} timeZone - Strefa IANA
 * @returns {CalendarParts} Rok, miesiąc, dzień i godzina (0-23) w strefie
 */
function getCalendarParts(date: Date, timeZone: string): CalendarParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const values: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }
  return {
    year: values.year ?? 1970,
    month: values.month ?? 1,
    day: values.day ?? 1,
    hour: values.hour ?? 0,
  };
}

/**
 * Formatuje składowe kalendarzowe do YYYY-MM-DD.
 *
 * @param {number} year - Rok
 * @param {number} month - Miesiąc (1-12)
 * @param {number} day - Dzień
 * @returns {string} Data YYYY-MM-DD
 */
function formatCalendarParts(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Formatuje obiekt Date do ciągu YYYY-MM-DD w podanej strefie czasowej.
 *
 * @param {Date} date - Obiekt daty
 * @param {string} [timeZone=DEFAULT_TIME_ZONE] - Strefa IANA
 * @returns {string} Sformatowana data kalendarzowa
 */
export function formatDateToCalendarString(
  date: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): string {
  const { year, month, day } = getCalendarParts(date, timeZone);
  return formatCalendarParts(year, month, day);
}

/**
 * Oblicza datę kalendarzową poprzedniego dnia w podanej strefie (odporne na zmianę czasu).
 *
 * @param {Date} date - Obiekt bieżącej daty
 * @param {string} [timeZone=DEFAULT_TIME_ZONE] - Strefa IANA
 * @returns {string} Data poprzedniego dnia w formacie YYYY-MM-DD
 */
export function getPreviousCalendarDateString(
  date: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): string {
  const { year, month, day } = getCalendarParts(date, timeZone);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return formatCalendarParts(
    previous.getUTCFullYear(),
    previous.getUTCMonth() + 1,
    previous.getUTCDate(),
  );
}

/**
 * Sprawdza, czy czas zdarzenia mieści się w przedziale trwania danego snu nocnego.
 *
 * @param {number} eventMilliseconds - Czas zdarzenia w milisekundach
 * @param {NightSleepReference | SleepLog} nightSleep - Referencja lub wpis snu nocnego
 * @returns {boolean} True jeśli zdarzenie przypada w trakcie trwania snu
 */
function isDuringNightSleep(
  eventMilliseconds: number,
  nightSleep: NightSleepReference | SleepLog,
): boolean {
  const startMilliseconds = parseTimestampToMilliseconds(nightSleep.fellAsleepAt);
  if (eventMilliseconds < startMilliseconds) {
    return false;
  }
  if (!nightSleep.wokeUpAt) {
    return true;
  }
  const endMilliseconds = parseTimestampToMilliseconds(nightSleep.wokeUpAt);
  return eventMilliseconds <= endMilliseconds;
}

/**
 * Wyznacza datę fizjologiczną w oparciu o godzinę graniczną fallbacku nocnego.
 *
 * @param {Date} eventDate - Obiekt daty zdarzenia
 * @param {number} cutoffHour - Godzina graniczna fallbacku
 * @param {string} timeZone - Strefa IANA
 * @returns {string} Wyznaczona data fizjologiczna YYYY-MM-DD
 */
function resolveFallbackDate(eventDate: Date, cutoffHour: number, timeZone: string): string {
  if (getCalendarParts(eventDate, timeZone).hour < cutoffHour) {
    return getPreviousCalendarDateString(eventDate, timeZone);
  }
  return formatDateToCalendarString(eventDate, timeZone);
}

/**
 * Wyznacza datę fizjologiczną dla danego zdarzenia zgodnie ze Złotą Regułą Doby Dziecięcej.
 *
 * @description
 * 1. Jeśli zdarzenie przypada w trakcie trwającego lub zakończonego snu nocnego ->
 *    przyjmuje physiologicalDate tego snu nocnego.
 * 2. Jeśli zdarzenie nastąpiło po porannej pobudce -> przypisuje dzień tej porannej pobudki.
 * 3. Jeśli brak aktywnego snu nocnego, a zdarzenie nastąpiło między 00:00 a 05:59 ->
 *    fallback do dnia poprzedniego (data - 24h).
 * 4. W pozostałych przypadkach -> bieżąca data kalendarzowa YYYY-MM-DD.
 *
 * @param {ResolvePhysiologicalDateOptions} options - Opcje wyznaczania daty
 * @returns {string} Data doby fizjologicznej w formacie YYYY-MM-DD
 */
export function resolvePhysiologicalDate(options: ResolvePhysiologicalDateOptions): string {
  const {
    eventTimestamp,
    activeOrRecentNightSleep,
    fallbackCutoffHour = DEFAULT_NIGHT_FALLBACK_CUTOFF_HOUR,
    timeZone = DEFAULT_TIME_ZONE,
  } = options;

  const eventMilliseconds = parseTimestampToMilliseconds(eventTimestamp);
  const eventDate = new Date(eventMilliseconds);

  if (activeOrRecentNightSleep) {
    if (isDuringNightSleep(eventMilliseconds, activeOrRecentNightSleep)) {
      return activeOrRecentNightSleep.physiologicalDate;
    }
    if (activeOrRecentNightSleep.wokeUpAt) {
      const wakeUpMilliseconds = parseTimestampToMilliseconds(activeOrRecentNightSleep.wokeUpAt);
      if (eventMilliseconds >= wakeUpMilliseconds) {
        return formatDateToCalendarString(new Date(wakeUpMilliseconds), timeZone);
      }
    }
  }

  return resolveFallbackDate(eventDate, fallbackCutoffHour, timeZone);
}
