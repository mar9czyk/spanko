/**
 * Deterministyczne sygnały karmienia istotne dla snu (czysty TypeScript, bez I/O).
 *
 * @description
 * Zasila drzewa diagnostyczne i Silnik Celów (np. odstawienie nocnego mleka)
 * danymi o związku karmienia ze snem.
 */

import { parseTimestampToMilliseconds } from "./physiologicalDay";

const MS_PER_MINUTE = 60_000;
/** Karmienie zakończone krócej niż tyle minut przed snem uznajemy za „tuż przed snem”. */
export const PRE_SLEEP_FEED_WINDOW_MIN = 30;
/** Karmienie w tym oknie względem usypiania/zaśnięcia uznajemy za karmienie do snu. */
export const FEED_TO_SLEEP_WINDOW_MIN = 15;
/** Karmienia starsze niż tyle minut nie są brane pod uwagę jako „ostatnie przed snem”. */
const MAX_LOOKBACK_MIN = 240;

export type FeedingKind = "breast" | "bottle" | "solid";

export interface FeedingEvent {
  readonly timestamp: string;
  readonly kind: FeedingKind;
  /** Ilość w ml (butelka). */
  readonly ml?: number;
  /** Łączny czas karmienia piersią w minutach. */
  readonly breastMinutes?: number;
}

export interface NightFeedingSummary {
  readonly count: number;
  readonly totalMl: number;
  readonly breastMinutes: number;
}

function toMs(iso: string): number {
  return parseTimestampToMilliseconds(iso);
}

/**
 * Liczba minut od ostatniego karmienia (null, gdy brak karmień przed `nowIso`).
 *
 * @param {readonly FeedingEvent[]} events - Karmienia
 * @param {string} nowIso - Punkt odniesienia
 * @returns {number | null} Minuty od ostatniego karmienia
 */
export function minutesSinceLastFeeding(
  events: readonly FeedingEvent[],
  nowIso: string,
): number | null {
  const now = toMs(nowIso);
  const past = events.map((e) => toMs(e.timestamp)).filter((t) => t <= now);
  if (past.length === 0) return null;
  return Math.round((now - Math.max(...past)) / MS_PER_MINUTE);
}

/**
 * Odstęp (min) między ostatnim karmieniem a początkiem snu.
 * Zwraca null, gdy brak karmienia w oknie 4 h przed snem.
 *
 * @param {readonly FeedingEvent[]} events - Karmienia
 * @param {string} sleepStartIso - Początek usypiania lub snu
 * @returns {number | null} Odstęp w minutach
 */
export function feedToSleepGapMin(
  events: readonly FeedingEvent[],
  sleepStartIso: string,
): number | null {
  const gap = minutesSinceLastFeeding(events, sleepStartIso);
  return gap !== null && gap <= MAX_LOOKBACK_MIN ? gap : null;
}

/**
 * Czy karmienie odbyło się tuż przed snem (≤ 30 min)?
 *
 * @param {readonly FeedingEvent[]} events - Karmienia
 * @param {string} sleepStartIso - Początek snu
 * @returns {boolean} true, gdy ostatnie karmienie < 30 min przed snem
 */
export function wasFedJustBeforeSleep(
  events: readonly FeedingEvent[],
  sleepStartIso: string,
): boolean {
  const gap = feedToSleepGapMin(events, sleepStartIso);
  return gap !== null && gap <= PRE_SLEEP_FEED_WINDOW_MIN;
}

/**
 * Wykrywa „karmienie do snu” (feed-to-sleep): pierś/butelka w oknie ±15 min wokół
 * usypiania i zaśnięcia. Typowe skojarzenie senne napędzające pobudki nocne.
 *
 * @param {readonly FeedingEvent[]} events - Karmienia
 * @param {string} putDownIso - Rozpoczęcie usypiania
 * @param {string} fellAsleepIso - Moment zaśnięcia
 * @returns {boolean} true, gdy dziecko zasnęło w trakcie lub tuż po karmieniu mlekiem
 */
export function isFeedToSleep(
  events: readonly FeedingEvent[],
  putDownIso: string,
  fellAsleepIso: string,
): boolean {
  const from = toMs(putDownIso) - FEED_TO_SLEEP_WINDOW_MIN * MS_PER_MINUTE;
  const to = toMs(fellAsleepIso) + FEED_TO_SLEEP_WINDOW_MIN * MS_PER_MINUTE;
  return events.some((e) => {
    if (e.kind === "solid") return false;
    const t = toMs(e.timestamp);
    return t >= from && t <= to;
  });
}

/**
 * Podsumowanie mleka w oknie nocnym [nightStart, nightEnd) — karmienia stałe pomijane.
 *
 * @param {readonly FeedingEvent[]} events - Karmienia
 * @param {string} nightStartIso - Zaśnięcie na noc
 * @param {string} nightEndIso - Poranna pobudka
 * @returns {NightFeedingSummary} Liczba nocnych karmień, ml i minuty piersi
 */
export function summarizeNightFeedings(
  events: readonly FeedingEvent[],
  nightStartIso: string,
  nightEndIso: string,
): NightFeedingSummary {
  const start = toMs(nightStartIso);
  const end = toMs(nightEndIso);
  const night = events.filter((e) => {
    const t = toMs(e.timestamp);
    return e.kind !== "solid" && t > start && t < end;
  });
  return {
    count: night.length,
    totalMl: night.reduce((sum, e) => sum + (e.kind === "bottle" ? (e.ml ?? 0) : 0), 0),
    breastMinutes: night.reduce(
      (sum, e) => sum + (e.kind === "breast" ? (e.breastMinutes ?? 0) : 0),
      0,
    ),
  };
}
