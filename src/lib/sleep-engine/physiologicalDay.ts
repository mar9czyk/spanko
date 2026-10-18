/**
 * Moduł wyznaczania granicy doby fizjologicznej niemowlęcia.
 *
 * @description
 * Doba fizjologiczna dziecka trwa od momentu porannej pobudki ze snu nocnego
 * do kolejnej porannej pobudki następnego dnia. Sen nocny i wszystkie nocne pobudki
 * są przypisywane do doby, w której rozpoczęła się dana noc.
 */

export const DEFAULT_NIGHT_FALLBACK_CUTOFF_HOUR = 6;
export const MILLISECONDS_IN_DAY = 86_400_000;

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
  /** Informacja o aktywnym lub niedawno zakończonym śnie nocnym */
  readonly activeOrRecentNightSleep?: NightSleepReference | null;
  /** Godzina graniczna fallbacku nocnego (domyślnie 6:00 rano) */
  readonly fallbackCutoffHour?: number;
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

/**
 * Formatuje obiekt Date do ciągu znaków w formacie kalendarzowym YYYY-MM-DD.
 *
 * @param {Date} date - Obiekt daty
 * @returns {string} Sformatowana data kalendarzowa
 */
export function formatDateToCalendarString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Oblicza datę kalendarzową poprzedniego dnia (data minus 24 godziny).
 *
 * @param {Date} date - Obiekt bieżącej daty
 * @returns {string} Data poprzedniego dnia w formacie YYYY-MM-DD
 */
export function getPreviousCalendarDateString(date: Date): string {
  const previousDay = new Date(date.getTime() - MILLISECONDS_IN_DAY);
  return formatDateToCalendarString(previousDay);
}

/**
 * Sprawdza, czy czas zdarzenia mieści się w przedziale trwania danego snu nocnego.
 *
 * @param {number} eventMilliseconds - Czas zdarzenia w milisekundach
 * @param {NightSleepReference} nightSleep - Referencja do snu nocnego
 * @returns {boolean} True jeśli zdarzenie przypada w trakcie trwania snu
 */
function isDuringNightSleep(eventMilliseconds: number, nightSleep: NightSleepReference): boolean {
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
 * @returns {string} Wyznaczona data fizjologiczna YYYY-MM-DD
 */
function resolveFallbackDate(eventDate: Date, cutoffHour: number): string {
  const currentHour = eventDate.getHours();
  if (currentHour < cutoffHour) {
    return getPreviousCalendarDateString(eventDate);
  }
  return formatDateToCalendarString(eventDate);
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
        return formatDateToCalendarString(new Date(wakeUpMilliseconds));
      }
    }
  }

  return resolveFallbackDate(eventDate, fallbackCutoffHour);
}
