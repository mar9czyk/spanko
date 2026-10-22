/**
 * Neutralne (angielskie) klucze tagów doby. Dane zapisujemy kluczami neutralnymi, a etykiety
 * tłumaczy UI (`tag.<klucz>`). Starsze wpisy mają klucze PL — `normalizeDayTag` mapuje je na nowe.
 */
export const DAY_TAG_KEYS = [
  "teething",
  "walk",
  "growth_spurt",
  "fever",
  "runny_nose",
  "ear_infection",
  "gastro",
  "vaccination",
  "travel",
  "daylight",
  "visitors",
] as const;

export type DayTagKey = (typeof DAY_TAG_KEYS)[number];

/** Klucze PL zapisane przed wprowadzeniem kluczy neutralnych → klucz neutralny. */
export const LEGACY_DAY_TAG_KEYS: Readonly<Record<string, DayTagKey>> = {
  ząbkowanie: "teething",
  spacer: "walk",
  skok_rozwojowy: "growth_spurt",
  gorączka: "fever",
  katar: "runny_nose",
  infekcja_ucha: "ear_infection",
  biegunka_wymioty: "gastro",
  szczepienie: "vaccination",
  podróż: "travel",
  światło_dzienne: "daylight",
  goście: "visitors",
};

/**
 * Zamienia klucz tagu (PL ze starych wpisów lub neutralny) na klucz neutralny.
 * Własne tagi użytkownika zostają bez zmian.
 *
 * @param {string} tag - Zapisany klucz tagu
 * @returns {string} Klucz neutralny albo ten sam tag
 */
export function normalizeDayTag(tag: string): string {
  return LEGACY_DAY_TAG_KEYS[tag] ?? tag;
}

/**
 * Normalizuje listę tagów doby (patrz `normalizeDayTag`).
 *
 * @param {readonly string[]} tags - Zapisane tagi
 * @returns {string[]} Tagi z kluczami neutralnymi
 */
export function normalizeDayTags(tags: readonly string[]): string[] {
  return tags.map(normalizeDayTag);
}

/**
 * Sprawdza, czy lista zawiera tag (obojętnie czy zapisany kluczem PL, czy neutralnym).
 *
 * @param {readonly string[]} tags - Zapisane tagi
 * @param {string} key - Klucz neutralny
 * @returns {boolean} True gdy tag występuje
 */
export function hasDayTag(tags: readonly string[], key: string): boolean {
  return tags.some((tag) => normalizeDayTag(tag) === key);
}
