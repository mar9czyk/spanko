import type { InsightStatus } from "./types";

/** Maksymalne przesunięcie okna czuwania z wniosku (w obie strony), w minutach. */
export const MAX_INSIGHT_WW_OFFSET_MINUTES = 30;

/** Klucz przesunięcia ustawianego przez rodzica w korekcie wniosku. */
export const PARENT_WW_OFFSET_KEY = "wwOffsetMin";

/** Klucz przesunięcia wyliczonego przez drzewa diagnostyczne. */
export const ENGINE_WW_OFFSET_KEY = "wakeWindowOffsetMinutes";

/**
 * Ogranicza przesunięcie okna czuwania do bezpiecznego zakresu i pełnych minut.
 *
 * @param {unknown} value - Surowa wartość z algorithm_override_json
 * @returns {number} Przesunięcie w zakresie ±MAX_INSIGHT_WW_OFFSET_MINUTES (0 gdy niepoprawne)
 */
export function clampInsightWwOffset(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  return Math.max(-MAX_INSIGHT_WW_OFFSET_MINUTES, Math.min(MAX_INSIGHT_WW_OFFSET_MINUTES, rounded));
}

/**
 * Wyznacza przesunięcie okna czuwania z aktywnego wniosku.
 *
 * @description
 * Przesunięcie rodzica (`wwOffsetMin`) obowiązuje tylko we wniosku skorygowanym przez rodzica;
 * w pozostałych liczy się wyłącznie przesunięcie silnika (`wakeWindowOffsetMinutes`).
 * Dzięki temu wartość wpisana przez model językowy nigdy nie zmienia prognozy.
 *
 * @param {object | null | undefined} insight - Status i nadpisania wniosku
 * @returns {number} Przesunięcie w minutach (0 gdy brak)
 */
export function resolveInsightWwOffset(
  insight:
    | {
        readonly status?: InsightStatus | string;
        readonly algorithm_override_json?: Record<string, unknown> | null;
      }
    | null
    | undefined,
): number {
  const overrides = insight?.algorithm_override_json;
  if (!overrides) return 0;
  if (insight.status === "corrected_by_parent" && PARENT_WW_OFFSET_KEY in overrides) {
    return clampInsightWwOffset(overrides[PARENT_WW_OFFSET_KEY]);
  }
  return clampInsightWwOffset(overrides[ENGINE_WW_OFFSET_KEY]);
}

/** Klucz przesunięcia pory nocnej (bedtime fading) z drzew diagnostycznych. */
export const ENGINE_BEDTIME_FADING_KEY = "bedtimeFadingMinutes";

/** Klucz korekty limitu snu dziennego (nap capping) z drzew diagnostycznych. */
export const ENGINE_DAYTIME_CAP_KEY = "maxDaytimeSleepCapMinutes";

/**
 * Odczytuje liczbę z nadpisań wniosku (0, gdy brak lub niepoprawna).
 *
 * @param {Record<string, unknown>} overrides - algorithm_override_json
 * @param {string} key - Klucz nadpisania
 * @returns {number} Wartość w pełnych minutach
 */
function readOverrideMinutes(overrides: Record<string, unknown>, key: string): number {
  const value = overrides[key];
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}

/**
 * Wyznacza korekty rytmu dnia z aktywnego wniosku: bedtime fading i nap capping.
 *
 * @description
 * Czyta wyłącznie klucze drzew diagnostycznych; limity (±30 min pory snu, do −60 min snu dziennego)
 * nakłada silnik w `calculateCircadianParameters` i `suggestNapWakeTime`.
 *
 * @param {object | null | undefined} insight - Nadpisania wniosku
 * @returns {{ bedtimeShiftMin: number; daytimeSleepCapOffsetMin: number }} Korekty w minutach
 */
export function resolveInsightDayAdjustments(
  insight: { readonly algorithm_override_json?: Record<string, unknown> | null } | null | undefined,
): { bedtimeShiftMin: number; daytimeSleepCapOffsetMin: number } {
  const overrides = insight?.algorithm_override_json;
  if (!overrides) return { bedtimeShiftMin: 0, daytimeSleepCapOffsetMin: 0 };
  return {
    bedtimeShiftMin: readOverrideMinutes(overrides, ENGINE_BEDTIME_FADING_KEY),
    daytimeSleepCapOffsetMin: readOverrideMinutes(overrides, ENGINE_DAYTIME_CAP_KEY),
  };
}

/**
 * Zostawia z nadpisań przesłanych przez rodzica tylko ograniczone przesunięcie okna.
 *
 * @param {Record<string, unknown> | undefined} overrides - Nadpisania z żądania korekty
 * @returns {Record<string, number> | undefined} Bezpieczne nadpisania lub undefined
 */
export function sanitizeParentOverride(
  overrides: Record<string, unknown> | undefined,
): Record<string, number> | undefined {
  if (!overrides || !(PARENT_WW_OFFSET_KEY in overrides)) return undefined;
  return { [PARENT_WW_OFFSET_KEY]: clampInsightWwOffset(overrides[PARENT_WW_OFFSET_KEY]) };
}
