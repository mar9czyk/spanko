import { z } from "zod";
import { DEFAULT_SLEEP_MATRIX } from "./matrix";
import type { AgeBracketConfig } from "./types";

export const MATRIX_MIN_AGE_DAYS = 0;
export const MATRIX_MAX_AGE_DAYS = 1095;
export const MAX_MINUTES_PER_DAY = 1440;
export const MAX_NAPS_PER_DAY = 8;
export const MAX_NIGHT_WAKINGS_NORM = 10;

const positiveMinutes = z.number().positive().max(MAX_MINUTES_PER_DAY);

export const AgeBracketConfigSchema = z
  .object({
    minAgeDays: z.number().int().min(MATRIX_MIN_AGE_DAYS),
    maxAgeDays: z
      .number()
      .int()
      .max(MATRIX_MAX_AGE_DAYS * 2),
    targetNapsCount: z.number().int().min(0).max(MAX_NAPS_PER_DAY),
    wwMinMorning: positiveMinutes,
    wwMaxEvening: positiveMinutes,
    maxSingleNapMin: positiveMinutes,
    maxDaytimeSleepMin: positiveMinutes,
    medianTotalSleepMin: positiveMinutes,
    homeostaticTauRiseMin: positiveMinutes,
    minNapsCount: z.number().int().min(0).max(MAX_NAPS_PER_DAY).optional(),
    nightWakingsMean: z.number().min(0).max(MAX_NIGHT_WAKINGS_NORM).optional(),
    nightWakingsUpperNorm: z.number().min(0).max(MAX_NIGHT_WAKINGS_NORM).optional(),
  })
  .refine((bracket) => bracket.minAgeDays <= bracket.maxAgeDays, {
    message: "minAgeDays musi być <= maxAgeDays",
  })
  .refine((bracket) => bracket.wwMinMorning <= bracket.wwMaxEvening, {
    message: "wwMinMorning musi być <= wwMaxEvening",
  })
  .refine(
    (bracket) =>
      bracket.minNapsCount === undefined || bracket.minNapsCount <= bracket.targetNapsCount,
    { message: "minNapsCount musi być <= targetNapsCount" },
  );

export type SleepMatrixValidation =
  | { readonly ok: true; readonly matrix: readonly AgeBracketConfig[] }
  | { readonly ok: false; readonly errors: readonly string[] };

/**
 * Wyciąga tablicę przedziałów z surowego JSON-a (tablica lub obiekt `{ brackets: [...] }`).
 *
 * @param {unknown} input - Wartość z `admin_settings.sleep_matrix_override_json`
 * @returns {unknown} Kandydat na tablicę przedziałów
 */
function extractBracketCandidates(input: unknown): unknown {
  if (input && typeof input === "object" && !Array.isArray(input) && "brackets" in input) {
    return (input as { brackets: unknown }).brackets;
  }
  return input;
}

/**
 * Sprawdza ciągłość przedziałów: start od 0, brak dziur i nakładania, koniec >= 1095 dni.
 *
 * @param {readonly AgeBracketConfig[]} sorted - Przedziały posortowane po minAgeDays
 * @returns {string[]} Lista błędów (pusta, gdy matryca jest ciągła)
 */
function findContinuityErrors(sorted: readonly AgeBracketConfig[]): string[] {
  const errors: string[] = [];
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first && first.minAgeDays !== MATRIX_MIN_AGE_DAYS) {
    errors.push(`Pierwszy przedział musi zaczynać się od dnia ${MATRIX_MIN_AGE_DAYS}.`);
  }
  if (last && last.maxAgeDays < MATRIX_MAX_AGE_DAYS) {
    errors.push(`Ostatni przedział musi sięgać co najmniej do dnia ${MATRIX_MAX_AGE_DAYS}.`);
  }
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (previous && current && current.minAgeDays !== previous.maxAgeDays + 1) {
      errors.push(
        `Przedziały nie są ciągłe: po dniu ${previous.maxAgeDays} oczekiwano ${previous.maxAgeDays + 1}, jest ${current.minAgeDays}.`,
      );
    }
  }
  return errors;
}

/**
 * Waliduje matrycę snu z panelu admina (schemat zod + ciągłość zakresów wiekowych).
 *
 * @param {unknown} input - Surowy JSON matrycy
 * @returns {SleepMatrixValidation} Poprawna matryca (posortowana) albo lista błędów
 */
export function validateSleepMatrix(input: unknown): SleepMatrixValidation {
  const parsed = z.array(AgeBracketConfigSchema).min(1).safeParse(extractBracketCandidates(input));
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "matryca"}: ${issue.message}`,
      ),
    };
  }

  const sorted = [...parsed.data].sort((a, b) => a.minAgeDays - b.minAgeDays);
  const continuityErrors = findContinuityErrors(sorted);
  if (continuityErrors.length > 0) {
    return { ok: false, errors: continuityErrors };
  }
  return { ok: true, matrix: sorted };
}

/**
 * Zwraca matrycę z nadpisania admina lub domyślną, gdy nadpisanie jest puste/niepoprawne.
 *
 * @param {unknown} overrideJson - Wartość `sleep_matrix_override_json`
 * @returns {readonly AgeBracketConfig[]} Matryca używana przez silnik snu
 */
export function resolveSleepMatrix(overrideJson: unknown): readonly AgeBracketConfig[] {
  if (overrideJson === undefined || overrideJson === null) {
    return DEFAULT_SLEEP_MATRIX;
  }
  const validation = validateSleepMatrix(overrideJson);
  return validation.ok ? validation.matrix : DEFAULT_SLEEP_MATRIX;
}
