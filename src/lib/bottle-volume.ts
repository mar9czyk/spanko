import { ML_PER_FLUID_OUNCE, type Units } from "@/i18n/translate";

export const MIN_BOTTLE_ML = 10;
export const MAX_BOTTLE_ML = 500;

const METRIC_STEP_ML = 10;
const IMPERIAL_STEP_OZ = 0.5;

/**
 * Ogranicza objętość butelki do sensownego zakresu i zaokrągla do pełnych ml.
 *
 * @param {number} ml - Objętość w ml
 * @returns {number} Objętość w zakresie MIN–MAX
 */
export function clampBottleMl(ml: number): number {
  return Math.min(MAX_BOTTLE_ML, Math.max(MIN_BOTTLE_ML, Math.round(ml)));
}

/**
 * Wartość pola wpisu w jednostkach użytkownika (ml albo oz z dokładnością 0,1).
 *
 * @param {number} ml - Objętość zapisana w ml
 * @param {Units} units - Jednostki wyświetlania
 * @returns {number} Liczba do pokazania w polu
 */
export function toDisplayAmount(ml: number, units: Units): number {
  if (units === "imperial") return Math.round((ml / ML_PER_FLUID_OUNCE) * 10) / 10;
  return Math.round(ml);
}

/**
 * Przesuwa objętość o jeden krok: ±10 ml albo ±0,5 oz; wynik zawsze w ml.
 *
 * @param {number} ml - Obecna objętość w ml
 * @param {Units} units - Jednostki użytkownika
 * @param {1 | -1} direction - Kierunek kroku
 * @returns {number} Nowa objętość w ml, w zakresie MIN–MAX
 */
export function stepBottleMl(ml: number, units: Units, direction: 1 | -1): number {
  if (units === "imperial") {
    const oz = Math.round(ml / ML_PER_FLUID_OUNCE / IMPERIAL_STEP_OZ) * IMPERIAL_STEP_OZ;
    return clampBottleMl((oz + direction * IMPERIAL_STEP_OZ) * ML_PER_FLUID_OUNCE);
  }
  const rounded = Math.round(ml / METRIC_STEP_ML) * METRIC_STEP_ML;
  return clampBottleMl(rounded + direction * METRIC_STEP_ML);
}

/**
 * Zamienia wpisany tekst (ml albo oz, przecinek lub kropka) na ml.
 *
 * @param {string} text - Tekst z pola
 * @param {Units} units - Jednostki użytkownika
 * @returns {number | null} Objętość w ml w zakresie MIN–MAX albo null przy błędnym wpisie
 */
export function parseBottleInput(text: string, units: Units): number | null {
  const value = Number(text.trim().replace(",", "."));
  if (!text.trim() || !Number.isFinite(value) || value <= 0) return null;
  return clampBottleMl(units === "imperial" ? value * ML_PER_FLUID_OUNCE : value);
}
