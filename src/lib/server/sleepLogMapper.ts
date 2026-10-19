import type { SleepLog } from "@/lib/sleep-engine/types";
import type { SleepLogRecord } from "@/lib/types/database";

/**
 * Mapuje rekord bazy danych SleepLogRecord na format oczekiwany przez silnik snu.
 *
 * @param {SleepLogRecord} record - Rekord z kolekcji sleep_logs
 * @returns {SleepLog} Obiekt logu dla silnika snu
 */
export function mapRecordToSleepLog(record: SleepLogRecord): SleepLog {
  const fallbackIso = new Date().toISOString();

  return {
    id: record.id,
    childId: record.child_id,
    physiologicalDate: record.physiological_date,
    type: record.type,
    status: record.status,
    putDownAt: record.put_down_at || record.fell_asleep_at || fallbackIso,
    fellAsleepAt: record.fell_asleep_at || record.put_down_at || fallbackIso,
    wokeUpAt: record.woke_up_at,
    interventions: record.interventions || [],
    mood: record.mood || "easy",
    nightWakings: record.night_wakings || [],
    isReboundSleep: record.is_rebound_sleep,
    ignoreInCalibration: record.ignore_in_calibration,
  };
}
