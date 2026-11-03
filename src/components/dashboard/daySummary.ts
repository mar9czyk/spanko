import type { TimelineEvent, TimelineNapEvent } from "./types";

export interface DaySummary {
  readonly naps: number;
  readonly napMinutes: number;
  readonly feedings: number;
  /** Pieluchy z siku (także „obie”). */
  readonly wet: number;
  /** Pieluchy z kupką (także „obie”). */
  readonly dirty: number;
  /** Pobudki nocne zapisane w nocy tej doby. */
  readonly nightWakings: number;
}

/**
 * Liczy wpisy doby do znaczników pod paskiem: drzemki (tylko `type=nap`), karmienia,
 * siku, kupki i pobudki nocne. Pielucha „obie” liczy się i do siku, i do kupki.
 *
 * @param {readonly TimelineEvent[]} events - Zdarzenia doby
 * @returns {DaySummary} Liczniki
 */
export function summarizeDay(events: readonly TimelineEvent[]): DaySummary {
  let naps = 0;
  let napMinutes = 0;
  let feedings = 0;
  let wet = 0;
  let dirty = 0;
  let nightWakings = 0;
  for (const event of events) {
    if (event.kind === "nap") {
      if (event.type === "nap") {
        naps += 1;
        napMinutes += event.durationMinutes ?? 0;
      } else {
        nightWakings += event.nightWakingIsos?.length ?? 0;
      }
    } else if (event.kind === "feeding") {
      feedings += 1;
    } else if (event.kind === "diaper") {
      if (event.diaperKind !== "dirty") wet += 1;
      if (event.diaperKind !== "wet") dirty += 1;
    }
  }
  return { naps, napMinutes, feedings, wet, dirty, nightWakings };
}

/**
 * Znajduje sen nocny doby (ten, który zaczyna się wieczorem i kończy poranną pobudką).
 *
 * @param {readonly TimelineEvent[]} events - Zdarzenia doby
 * @returns {TimelineNapEvent | null} Sen nocny albo null
 */
export function findNightSleep(events: readonly TimelineEvent[]): TimelineNapEvent | null {
  const nights = events.filter(
    (event): event is TimelineNapEvent => event.kind === "nap" && event.type === "night",
  );
  return nights[nights.length - 1] ?? null;
}
