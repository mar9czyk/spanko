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
    endIso: log.woke_up_at || undefined,
    durationMinutes: calculateDurationInMinutes(startIso, log.woke_up_at),
    mood: log.mood,
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
