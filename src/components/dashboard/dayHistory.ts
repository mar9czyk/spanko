import type { DayContextRecord, SleepLogRecord } from "@/lib/types/database";
import {
  mapDayContextToTimelineEvent,
  mapSleepLogToTimelineEvent,
  sortTimelineEventsAsc,
} from "./timelineMapping";
import type { TimelineEvent } from "./types";

const MS_PER_DAY = 86_400_000;

/** Zamknięta doba fizjologiczna gotowa do pokazania na osi czasu. */
export interface PastDayView {
  readonly date: string;
  /** Poranna pobudka otwierająca dobę (koniec nocy z poprzedniej doby). */
  readonly dayStartIso?: string;
  /** Poranna pobudka następnego dnia, która zamyka tę dobę. */
  readonly dayEndIso?: string;
  readonly events: readonly TimelineEvent[];
}

/**
 * Przesuwa datę doby fizjologicznej YYYY-MM-DD o podaną liczbę dni (arytmetyka w UTC).
 *
 * @param {string} date - Data doby YYYY-MM-DD
 * @param {number} deltaDays - Liczba dni (ujemna = wstecz)
 * @returns {string} Przesunięta data YYYY-MM-DD
 */
export function shiftPhysiologicalDate(date: string, deltaDays: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`) + deltaDays * MS_PER_DAY;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Znajduje poranną pobudkę kończącą noc przypisaną do danej doby.
 *
 * @param {readonly SleepLogRecord[]} logs - Logi snu
 * @param {string} date - Data doby, do której należy noc
 * @returns {string | undefined} Moment pobudki ISO
 */
function findNightWake(logs: readonly SleepLogRecord[], date: string): string | undefined {
  return logs.find(
    (log) =>
      log.type === "night" &&
      log.status === "completed" &&
      log.physiological_date === date &&
      log.woke_up_at,
  )?.woke_up_at;
}

/**
 * Składa zamkniętą dobę z logów snu i wpisów day_context (te same karty co na pulpicie).
 *
 * @param {string} date - Data doby YYYY-MM-DD
 * @param {readonly SleepLogRecord[]} logs - Logi snu obejmujące też noc z poprzedniej doby
 * @param {readonly DayContextRecord[]} contexts - Karmienia, pieluchy i tagi
 * @returns {PastDayView} Doba z granicami i zdarzeniami
 */
export function buildPastDay(
  date: string,
  logs: readonly SleepLogRecord[],
  contexts: readonly DayContextRecord[],
): PastDayView {
  const dayContexts = contexts
    .filter((record) => record.physiological_date === date)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const dayLogs = logs
    // Także niezakończone (np. zapomniane „śpi”), inaczej drzemka znika z historii
    .filter((log) => log.physiological_date === date)
    .sort((a, b) =>
      (b.fell_asleep_at || b.put_down_at || "").localeCompare(
        a.fell_asleep_at || a.put_down_at || "",
      ),
    )
    .map(mapSleepLogToTimelineEvent);
  return {
    date,
    dayStartIso: findNightWake(logs, shiftPhysiologicalDate(date, -1)),
    dayEndIso: findNightWake(logs, date),
    events: sortTimelineEventsAsc([...dayContexts.map(mapDayContextToTimelineEvent), ...dayLogs]),
  };
}

/**
 * Moment „teraz” dla paska godzin zamkniętej doby: jej koniec, najpóźniej 24 h od początku,
 * żeby wszystkie godziny doby były przeszłe.
 *
 * @param {PastDayView} day - Zamknięta doba
 * @returns {string | undefined} Moment ISO albo brak, gdy doba nie ma porannej pobudki
 */
export function pastDayStripNowIso(day: PastDayView): string | undefined {
  if (!day.dayStartIso) return undefined;
  const fullDayMs = Date.parse(day.dayStartIso) + MS_PER_DAY;
  const endMs = day.dayEndIso ? Math.min(Date.parse(day.dayEndIso), fullDayMs) : fullDayMs;
  return new Date(endMs).toISOString();
}
