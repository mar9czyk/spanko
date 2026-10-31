/**
 * Normalizuje wpisany lub wklejony kod zaproszenia (wielkie litery, bez spacji i myślników).
 *
 * @param {string} raw - Kod od użytkownika
 * @returns {string} Znormalizowany kod
 */
export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}
