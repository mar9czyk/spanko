import type { SleepType } from "@/lib/types/database";
import type { TimelineEvent } from "./types";

const MS_PER_MINUTE = 60_000;
export const DAY_STRIP_SLOT_MINUTES = 15;
export const DAY_STRIP_SLOTS = (24 * 60) / DAY_STRIP_SLOT_MINUTES;
const SLOT_MS = DAY_STRIP_SLOT_MINUTES * MS_PER_MINUTE;
const DAY_MS = DAY_STRIP_SLOTS * SLOT_MS;

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

export interface DayStripSlot {
  readonly startMs: number;
  /** Część 15-minutowego odcinka przespana, 0..1. */
  readonly sleepFraction: number;
  /** Rodzaj snu dominujący w odcinku. */
  readonly sleepType: SleepType | null;
  readonly state: "past" | "current" | "future";
}

export interface DayStripMark {
  readonly kind: "feeding" | "diaper";
  /** Położenie na pasku, 0..1 od początku doby. */
  readonly offset: number;
}

export interface DayStrip {
  /** Pierwsza pełna godzina doby (od niej liczą się odcinki). */
  readonly startMs: number;
  readonly slots: readonly DayStripSlot[];
  readonly marks: readonly DayStripMark[];
  /** Położenie „teraz” na pasku, 0..1, albo null poza dobą. */
  readonly nowOffset: number | null;
}

/**
 * Buduje pasek doby fizjologicznej: 96 odcinków po 15 minut od pełnej godziny porannej
 * pobudki, z udziałem snu w każdym odcinku oraz dokładnym położeniem karmień i pieluch.
 *
 * @param {DayStripInput} input - Początek doby, teraz, sny, karmienia i pieluchy
 * @returns {DayStrip} Odcinki, znaczniki zdarzeń i położenie „teraz”
 */
export function buildDayStrip(input: DayStripInput): DayStrip {
  const first = new Date(input.dayStartIso);
  first.setMinutes(0, 0, 0);
  const firstMs = first.getTime();
  const nowMs = new Date(input.nowIso).getTime();
  const sleeps = input.sleeps.map((sleep) => ({
    startMs: new Date(sleep.startIso).getTime(),
    endMs: sleep.endIso ? new Date(sleep.endIso).getTime() : nowMs,
    type: sleep.type,
  }));
  const toOffset = (iso: string) => (new Date(iso).getTime() - firstMs) / DAY_MS;
  const inDay = (offset: number) => offset >= 0 && offset < 1;

  const slots = Array.from({ length: DAY_STRIP_SLOTS }, (_, index): DayStripSlot => {
    const startMs = firstMs + index * SLOT_MS;
    const endMs = startMs + SLOT_MS;
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
      sleepFraction: Math.min(1, asleepMs / SLOT_MS),
      sleepType: dominant?.type ?? null,
      state: nowMs >= endMs ? "past" : nowMs >= startMs ? "current" : "future",
    };
  });

  const marks: DayStripMark[] = [
    ...input.feedingIsos.map((iso) => ({ kind: "feeding" as const, offset: toOffset(iso) })),
    ...input.diaperIsos.map((iso) => ({ kind: "diaper" as const, offset: toOffset(iso) })),
  ].filter((mark) => inDay(mark.offset));

  const nowOffset = (nowMs - firstMs) / DAY_MS;
  return { startMs: firstMs, slots, marks, nowOffset: inDay(nowOffset) ? nowOffset : null };
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
