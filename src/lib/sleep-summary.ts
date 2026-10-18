import type { DailySleepSummary } from "@/lib/sleep-engine/types";
import type { SleepLogRecord } from "@/lib/types/database";

export const MILLISECONDS_PER_MINUTE = 60_000;

/**
 * Przelicza różnicę czasu w milisekundach na minuty.
 *
 * @param {string | undefined} startIso - Czas rozpoczęcia w formacie ISO
 * @param {string | undefined} endIso - Czas zakończenia w formacie ISO
 * @returns {number} Czas trwania w minutach
 */
export function calculateDurationInMinutes(startIso?: string, endIso?: string): number {
  if (!startIso || !endIso) return 0;
  const startTime = new Date(startIso).getTime();
  const endTime = new Date(endIso).getTime();
  return Math.max(0, Math.round((endTime - startTime) / MILLISECONDS_PER_MINUTE));
}

/**
 * Grupuje logi snu po dacie fizjologicznej i oblicza dobowe sumy snu (najnowsza doba pierwsza).
 *
 * @param {readonly SleepLogRecord[]} records - Lista logów z bazy danych
 * @returns {DailySleepSummary[]} Podsumowania dobowe
 */
export function aggregateDailySleepSummaries(
  records: readonly SleepLogRecord[],
): DailySleepSummary[] {
  const groupedByDate = new Map<string, { totalSleepMin: number; isIllOrIgnored: boolean }>();

  for (const record of records) {
    if (record.status !== "completed") continue;
    const duration = calculateDurationInMinutes(
      record.fell_asleep_at || record.put_down_at,
      record.woke_up_at,
    );
    const existing = groupedByDate.get(record.physiological_date) || {
      totalSleepMin: 0,
      isIllOrIgnored: false,
    };
    groupedByDate.set(record.physiological_date, {
      totalSleepMin: existing.totalSleepMin + duration,
      isIllOrIgnored: existing.isIllOrIgnored || record.ignore_in_calibration,
    });
  }

  return Array.from(groupedByDate.entries())
    .map(([physiologicalDate, values]) => ({ physiologicalDate, ...values }))
    .sort((a, b) => b.physiologicalDate.localeCompare(a.physiologicalDate));
}
