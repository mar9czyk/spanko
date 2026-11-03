import { calculateDurationInMinutes } from "@/lib/sleep-summary";
import type { DayContextRecord, SleepLogRecord } from "@/lib/types/database";
import type { TimelineEvent } from "./types";

const PLACEHOLDER_TIME = "—";

/**
 * Formatuje moment ISO do zegara HH:mm w czasie lokalnym urządzenia.
 *
 * @param {string | undefined} iso - Moment w formacie ISO
 * @returns {string} Godzina lub znak zastępczy
 */
export function formatClock(iso?: string): string {
  if (!iso) return PLACEHOLDER_TIME;
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Zamienia log snu na element osi czasu.
 *
 * @param {SleepLogRecord} log - Zakończony wpis snu
 * @returns {TimelineEvent} Zdarzenie osi czasu
 */
export function mapSleepLogToTimelineEvent(log: SleepLogRecord): TimelineEvent {
  const startIso = log.fell_asleep_at || log.put_down_at;
  const fallAsleepMinutes =
    log.fell_asleep_at && log.put_down_at
      ? Math.max(
          0,
          Math.round((Date.parse(log.fell_asleep_at) - Date.parse(log.put_down_at)) / 60_000),
        )
      : undefined;
  return {
    id: log.id,
    kind: "nap",
    type: log.type,
    status: log.status,
    startTime: formatClock(startIso),
    endTime: log.woke_up_at ? formatClock(log.woke_up_at) : undefined,
    startIso: startIso || undefined,
    startField: log.fell_asleep_at ? "fell_asleep_at" : log.put_down_at ? "put_down_at" : undefined,
    putDownIso: log.put_down_at || undefined,
    fallAsleepMinutes: Number.isFinite(fallAsleepMinutes) ? fallAsleepMinutes : undefined,
    endIso: log.woke_up_at || undefined,
    durationMinutes: calculateDurationInMinutes(startIso, log.woke_up_at),
    mood: log.mood,
    interventions: log.interventions?.length ? log.interventions : undefined,
    nightWakingIsos: log.night_wakings?.length
      ? log.night_wakings.map((wake) => wake.wokeAt)
      : undefined,
    nightWakings: log.night_wakings?.length ? log.night_wakings : undefined,
  };
}

/**
 * Zamienia wpis day_context na element osi czasu (karmienie lub tagi dnia).
 *
 * @param {DayContextRecord} record - Rekord day_context
 * @returns {TimelineEvent} Zdarzenie osi czasu
 */
export function mapDayContextToTimelineEvent(record: DayContextRecord): TimelineEvent {
  if (record.event_type === "diaper" && record.diaper_kind) {
    return {
      id: record.id,
      kind: "diaper",
      time: formatClock(record.timestamp),
      timeIso: record.timestamp,
      diaperKind: record.diaper_kind,
    };
  }
  if (record.feeding_type === "none") {
    return {
      id: record.id,
      kind: "tag",
      time: formatClock(record.timestamp),
      timeIso: record.timestamp,
      tags: record.tags ?? [],
      notes: record.notes,
    };
  }
  return {
    id: record.id,
    kind: "feeding",
    time: formatClock(record.timestamp),
    timeIso: record.timestamp,
    feedingType: record.feeding_type,
    breastSide: record.breast_side,
    bottleMl: record.bottle_ml,
    breastMinutes: (record.breast_left_min ?? 0) + (record.breast_right_min ?? 0) || undefined,
    notes: record.notes,
  };
}

function eventTimeMs(event: TimelineEvent): number {
  const iso = event.kind === "nap" ? event.startIso : event.timeIso;
  return iso ? Date.parse(iso) : Number.POSITIVE_INFINITY;
}

/**
 * Sortuje zdarzenia doby chronologicznie od rana do wieczora (sen wg zaśnięcia/odłożenia,
 * reszta wg znacznika czasu). Zdarzenia bez czasu trafiają na koniec.
 *
 * @param {readonly TimelineEvent[]} events - Zdarzenia w dowolnej kolejności
 * @returns {TimelineEvent[]} Nowa lista, najstarsze pierwsze
 */
export function sortTimelineEventsAsc(events: readonly TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => {
    const am = eventTimeMs(a);
    const bm = eventTimeMs(b);
    if (am === bm) return 0;
    return am > bm ? 1 : -1;
  });
}
