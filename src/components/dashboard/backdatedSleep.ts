const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;
const CLOCK_PATTERN = /^(\d{2}):(\d{2})$/;
/** Najdłuższy trwający sen, jaki można wpisać wstecz. */
export const MAX_BACKDATED_HOURS = 16;

/** Szybkie wybory „zaczęło się X temu” (minuty). */
export const BACKDATED_PRESET_MINUTES = [15, 30, 60, 90, 120] as const;

export type BackdatedStartError = "invalid_time" | "too_long";

/**
 * Zamienia godzinę HH:mm na ostatni taki moment nie późniejszy niż teraz (np. 23:30 wpisane
 * o 00:10 oznacza wczorajszy wieczór).
 *
 * @param {string} clock - Godzina HH:mm (czas lokalny)
 * @param {number} nowMs - Bieżący moment w ms
 * @returns {number | BackdatedStartError} Początek snu w ms albo kod błędu
 */
export function resolveBackdatedStart(clock: string, nowMs: number): number | BackdatedStartError {
  const match = CLOCK_PATTERN.exec(clock);
  if (!match) return "invalid_time";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return "invalid_time";
  const candidate = new Date(nowMs);
  candidate.setHours(hours, minutes, 0, 0);
  if (candidate.getTime() > nowMs) candidate.setDate(candidate.getDate() - 1);
  const startMs = candidate.getTime();
  if (nowMs - startMs > MAX_BACKDATED_HOURS * 60 * MS_PER_MINUTE) return "too_long";
  return startMs;
}

/**
 * Początek snu „X minut temu”.
 *
 * @param {number} minutesAgo - Ile minut temu
 * @param {number} nowMs - Bieżący moment w ms
 * @returns {number} Początek snu w ms
 */
export function startFromMinutesAgo(minutesAgo: number, nowMs: number): number {
  return nowMs - Math.min(minutesAgo * MS_PER_MINUTE, MS_PER_DAY);
}
