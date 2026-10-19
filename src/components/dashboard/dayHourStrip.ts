import type { SleepType } from "@/lib/types/database";
import type { TimelineEvent } from "./types";

const MS_PER_HOUR = 3_600_000;
export const DAY_STRIP_HOURS = 24;

export interface DayStripSleep {
  readonly startIso: string;
  /** Brak końca = sen trwa do teraz. */
  readonly endIso?: string;
  readonly type: SleepType;
}

export interface DayStripInput {
  readonly dayStartIso: string;
  readonly nowIso: string;
  readonly sleeps: readonly DayStripSleep[];
  readonly feedingIsos: readonly string[];
  readonly diaperIsos: readonly string[];
}

export interface DayStripHour {
  readonly startMs: number;
  /** Część godziny przespana, 0..1. */
  readonly sleepFraction: number;
  /** Rodzaj snu dominujący w tej godzinie. */
  readonly sleepType: SleepType | null;
  readonly feedings: number;
  readonly diapers: number;
  readonly state: "past" | "current" | "future";
}

/**
 * Buduje 24 godzinne kreseczki doby fizjologicznej, licząc od pełnej godziny porannej pobudki.
 *
 * @param {DayStripInput} input - Początek doby, teraz, sny, karmienia i pieluchy
 * @returns {readonly DayStripHour[]} 24 godziny z udziałem snu i zdarzeniami
 */
export function buildDayHourStrip(input: DayStripInput): readonly DayStripHour[] {
  const first = new Date(input.dayStartIso);
  first.setMinutes(0, 0, 0);
  const firstMs = first.getTime();
  const nowMs = new Date(input.nowIso).getTime();
  const sleeps = input.sleeps.map((sleep) => ({
    startMs: new Date(sleep.startIso).getTime(),
    endMs: sleep.endIso ? new Date(sleep.endIso).getTime() : nowMs,
    type: sleep.type,
  }));
  const hourIndex = (iso: string) => Math.floor((new Date(iso).getTime() - firstMs) / MS_PER_HOUR);
  const feedingIndexes = input.feedingIsos.map(hourIndex);
  const diaperIndexes = input.diaperIsos.map(hourIndex);

  return Array.from({ length: DAY_STRIP_HOURS }, (_, index) => {
    const startMs = firstMs + index * MS_PER_HOUR;
    const endMs = startMs + MS_PER_HOUR;
    let asleepMs = 0;
    let dominant: { type: SleepType; ms: number } | null = null;
    for (const sleep of sleeps) {
      const overlap = Math.min(endMs, sleep.endMs) - Math.max(startMs, sleep.startMs);
      if (overlap <= 0) continue;
      asleepMs += overlap;
      if (!dominant || overlap > dominant.ms) dominant = { type: sleep.type, ms: overlap };
    }
    return {
      startMs,
      sleepFraction: Math.min(1, asleepMs / MS_PER_HOUR),
      sleepType: dominant?.type ?? null,
      feedings: feedingIndexes.filter((i) => i === index).length,
      diapers: diaperIndexes.filter((i) => i === index).length,
      state: nowMs >= endMs ? "past" : nowMs >= startMs ? "current" : "future",
    };
  });
}

/**
 * Zbiera dane paska z listy zdarzeń osi czasu i trwającego snu.
 *
 * @param {readonly TimelineEvent[]} events - Zdarzenia bieżącej doby
 * @param {DayStripSleep | null} activeSleep - Trwający sen (bez końca)
 * @returns {object} Sny, karmienia i pieluchy z momentami ISO
 */
export function collectDayStripEvents(
  events: readonly TimelineEvent[],
  activeSleep: DayStripSleep | null,
): Pick<DayStripInput, "sleeps" | "feedingIsos" | "diaperIsos"> {
  const sleeps: DayStripSleep[] = [];
  const feedingIsos: string[] = [];
  const diaperIsos: string[] = [];
  for (const event of events) {
    if (event.kind === "nap" && event.startIso) {
      sleeps.push({ startIso: event.startIso, endIso: event.endIso, type: event.type });
    } else if (event.kind === "feeding" && event.timeIso) {
      feedingIsos.push(event.timeIso);
    } else if (event.kind === "diaper" && event.timeIso) {
      diaperIsos.push(event.timeIso);
    }
  }
  if (activeSleep) sleeps.push(activeSleep);
  return { sleeps, feedingIsos, diaperIsos };
}
