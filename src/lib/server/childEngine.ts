import { mapRecordToSleepLog } from "@/lib/server/sleepLogMapper";
import {
  calculateChronicDrive,
  calculateEffectiveAgeDays,
  evaluateAll7DiagnosticCategories,
  getAgeBracket,
  resolveSleepMatrix,
} from "@/lib/sleep-engine";
import type {
  AgeBracketConfig,
  DailySleepSummary,
  DiagnosticEvaluationInput,
  DiagnosticTreeResult,
  SleepLog,
} from "@/lib/sleep-engine/types";
import { aggregateDailySleepSummaries } from "@/lib/sleep-summary";
import type { ChildRecord, SleepLogRecord } from "@/lib/types/database";

export const DEFAULT_FALLBACK_BEDTIME_MINUTES = 1200;

export type SleepNeedsProfile = "low_sleep_needs" | "average" | "high_sleep_needs";

/**
 * Formułuje wejście diagnostyczne dla deterministycznego silnika snu.
 *
 * @param {object} params - Zestaw parametrów wejściowych
 * @returns {DiagnosticEvaluationInput} Kompletne wejście silnika
 */
export function buildDiagnosticInput(params: {
  child: ChildRecord;
  effectiveAgeDays: number;
  recentSleepLogs: readonly SleepLog[];
  dailyTotals: readonly DailySleepSummary[];
  chronicSleepDebtMin: number;
  sleepBatteryPercent: number;
  sleepNeedsProfile: SleepNeedsProfile;
}): DiagnosticEvaluationInput {
  return {
    child: {
      birthDateIso: params.child.birth_date,
      dueDateIso: params.child.due_date,
      activeDayMode: params.child.active_day_mode,
    },
    todayContext: { dayMode: params.child.active_day_mode },
    recentSleepLogs: params.recentSleepLogs,
    dailyTotalsLast14DaysMin: params.dailyTotals,
    currentMetrics: {
      effectiveAgeDays: params.effectiveAgeDays,
      chronicSleepDebtMin: params.chronicSleepDebtMin,
      sleepBatteryPercent: params.sleepBatteryPercent,
      sleepNeedsProfile: params.sleepNeedsProfile,
      biologicalBedtimeMinFromMidnight: DEFAULT_FALLBACK_BEDTIME_MINUTES,
    },
  };
}

/**
 * Wybiera istotne diagnozy z 7 deterministycznych kategorii problemów snu.
 *
 * @param {readonly DiagnosticTreeResult[]} results - Wszystkie 7 wyników
 * @returns {DiagnosticTreeResult[]} Zdiagnozowane lub domyślne kategorie
 */
export function resolveSignificantDiagnostics(
  results: readonly DiagnosticTreeResult[],
): readonly DiagnosticTreeResult[] {
  const triggered = results.filter((diag) => diag.isTriggered);
  if (triggered.length > 0) {
    return triggered;
  }
  const firstDiagnostic = results[0];
  return firstDiagnostic ? [firstDiagnostic] : [];
}

export interface DeterministicEngineResult {
  readonly effectiveAgeDays: number;
  readonly bracket: AgeBracketConfig;
  readonly chronicDrive: ReturnType<typeof calculateChronicDrive>;
  readonly dailyTotals: DailySleepSummary[];
  readonly allDiagnostics: readonly DiagnosticTreeResult[];
  readonly significantDiagnostics: readonly DiagnosticTreeResult[];
}

/**
 * Uruchamia wyłącznie silnik deterministyczny (wiek efektywny, 3 napędy, 7 drzew) — bez AI.
 *
 * @param {object} input - Dziecko, logi snu, nadpisanie matrycy i czas odniesienia
 * @returns {DeterministicEngineResult} Wynik silnika
 */
export function runDeterministicEngine(input: {
  readonly child: ChildRecord;
  readonly sleepRecords: readonly SleepLogRecord[];
  readonly matrixOverrideJson: unknown;
  readonly nowIso: string;
}): DeterministicEngineResult {
  const effectiveAgeDays = calculateEffectiveAgeDays(
    input.child.birth_date,
    input.child.due_date,
    input.nowIso,
  );
  const bracket = getAgeBracket(effectiveAgeDays, resolveSleepMatrix(input.matrixOverrideJson));
  const dailyTotals = aggregateDailySleepSummaries(input.sleepRecords);
  const chronicDrive = calculateChronicDrive(dailyTotals, bracket);
  const allDiagnostics = evaluateAll7DiagnosticCategories(
    buildDiagnosticInput({
      child: input.child,
      effectiveAgeDays,
      recentSleepLogs: input.sleepRecords.map(mapRecordToSleepLog),
      dailyTotals,
      chronicSleepDebtMin: chronicDrive.chronicSleepDebtMin,
      sleepBatteryPercent: chronicDrive.sleepBatteryPercent,
      sleepNeedsProfile: chronicDrive.sleepNeedsProfile,
    }),
  );
  return {
    effectiveAgeDays,
    bracket,
    chronicDrive,
    dailyTotals,
    allDiagnostics,
    significantDiagnostics: resolveSignificantDiagnostics(allDiagnostics),
  };
}
