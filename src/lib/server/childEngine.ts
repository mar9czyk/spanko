import type PocketBase from "pocketbase";
import { mapRecordToSleepLog } from "@/lib/server/sleepLogMapper";
import {
  applyObservedNapsCount,
  calculateChronicDrive,
  calculateCircadianParameters,
  calculateEffectiveAgeDays,
  DEFAULT_TIME_ZONE,
  evaluateAll7DiagnosticCategories,
  getAgeBracket,
  getMinutesFromMidnightInTimeZone,
  resolvePhysiologicalDate,
  resolveSleepMatrix,
} from "@/lib/sleep-engine";
import type {
  AgeBracketConfig,
  DailySleepSummary,
  DiagnosticEvaluationInput,
  DiagnosticSeverity,
  DiagnosticTreeResult,
  SleepLog,
} from "@/lib/sleep-engine/types";
import { aggregateDailySleepSummaries } from "@/lib/sleep-summary";
import type {
  ChildGoalRecord,
  ChildRecord,
  DayContextRecord,
  SleepLogRecord,
} from "@/lib/types/database";

/** Liczba ostatnich porannych pobudek dla kotwicy okołodobowej. */
export const MORNING_WAKE_SAMPLE_SIZE = 5;
const DAY_CONTEXT_LIMIT = 50;

export type SleepNeedsProfile = "low_sleep_needs" | "average" | "high_sleep_needs";

/** Dane spoza logów snu potrzebne drzewom (tagi doby, start planu). */
export interface DiagnosticExtras {
  readonly todayTags?: readonly string[];
  readonly currentPlanStartDateIso?: string | null;
}

/**
 * Wylicza przewidywaną porę snu nocnego (minuty od północy w strefie dziecka) z ostatnich
 * porannych pobudek i faktycznych pór zaśnięcia.
 *
 * @param {readonly SleepLog[]} logs - Logi snu (dowolna kolejność)
 * @param {AgeBracketConfig} bracket - Przedział wiekowy
 * @param {string} timeZone - Strefa IANA dziecka
 * @returns {number} Przewidywana pora snu w minutach od północy
 */
export function resolveBiologicalBedtimeMin(
  logs: readonly SleepLog[],
  bracket: AgeBracketConfig,
  timeZone: string,
): number {
  const recentNights = logs
    .filter((l) => l.type === "night" && l.status === "completed" && l.wokeUpAt)
    .toSorted((a, b) => new Date(b.putDownAt).getTime() - new Date(a.putDownAt).getTime())
    .slice(0, MORNING_WAKE_SAMPLE_SIZE);
  return calculateCircadianParameters({
    morningWakeTimesLast5DaysMinutesFromMidnight: recentNights.map((l) =>
      getMinutesFromMidnightInTimeZone(l.wokeUpAt ?? l.putDownAt, timeZone),
    ),
    bedtimesLast5DaysMinutesFromMidnight: recentNights.map((l) =>
      getMinutesFromMidnightInTimeZone(l.fellAsleepAt || l.putDownAt, timeZone),
    ),
    bracket,
  }).biologicalBedtimeMinFromMidnight;
}

/**
 * Formułuje wejście diagnostyczne dla deterministycznego silnika snu.
 *
 * @param {object} params - Zestaw parametrów wejściowych
 * @returns {DiagnosticEvaluationInput} Kompletne wejście silnika
 */
export function buildDiagnosticInput(params: {
  child: ChildRecord;
  nowIso: string;
  bracket: AgeBracketConfig;
  effectiveAgeDays: number;
  recentSleepLogs: readonly SleepLog[];
  dailyTotals: readonly DailySleepSummary[];
  chronicSleepDebtMin: number;
  sleepBatteryPercent: number;
  sleepNeedsProfile: SleepNeedsProfile;
  extras?: DiagnosticExtras;
}): DiagnosticEvaluationInput {
  const timeZone = params.child.timezone || DEFAULT_TIME_ZONE;
  return {
    nowIso: params.nowIso,
    timeZone,
    child: {
      birthDateIso: params.child.birth_date,
      dueDateIso: params.child.due_date,
      activeDayMode: params.child.active_day_mode,
      currentPlanStartDateIso: params.extras?.currentPlanStartDateIso ?? null,
    },
    todayContext: {
      dayMode: params.child.active_day_mode,
      tags: params.extras?.todayTags ?? [],
    },
    recentSleepLogs: params.recentSleepLogs,
    dailyTotalsLast14DaysMin: params.dailyTotals,
    currentMetrics: {
      effectiveAgeDays: params.effectiveAgeDays,
      chronicSleepDebtMin: params.chronicSleepDebtMin,
      sleepBatteryPercent: params.sleepBatteryPercent,
      sleepNeedsProfile: params.sleepNeedsProfile,
      biologicalBedtimeMinFromMidnight: resolveBiologicalBedtimeMin(
        params.recentSleepLogs,
        params.bracket,
        timeZone,
      ),
    },
  };
}

const SEVERITY_RANK: Record<DiagnosticSeverity, number> = { high: 3, medium: 2, low: 1, info: 0 };

/**
 * Wybiera istotne diagnozy z 7 deterministycznych kategorii problemów snu.
 *
 * @description
 * Zwraca diagnozy aktywne posortowane od najważniejszej (istotność, potem pewność,
 * potem kolejność kategorii) — pierwsza jest diagnozą główną wniosku.
 *
 * @param {readonly DiagnosticTreeResult[]} results - Wszystkie 7 wyników
 * @returns {DiagnosticTreeResult[]} Zdiagnozowane lub domyślne kategorie
 */
export function resolveSignificantDiagnostics(
  results: readonly DiagnosticTreeResult[],
): readonly DiagnosticTreeResult[] {
  const triggered = results
    .map((diag, index) => ({ diag, index }))
    .filter(({ diag }) => diag.isTriggered)
    .toSorted(
      (a, b) =>
        SEVERITY_RANK[b.diag.severity] - SEVERITY_RANK[a.diag.severity] ||
        b.diag.confidenceScore - a.diag.confidenceScore ||
        a.index - b.index,
    )
    .map(({ diag }) => diag);
  if (triggered.length > 0) {
    return triggered;
  }
  const firstDiagnostic = results[0];
  return firstDiagnostic ? [firstDiagnostic] : [];
}

/**
 * Wyznacza status nowego wniosku: powtórzona diagnoza jest aktywna, nowa — hipotezą.
 *
 * @param {DiagnosticTreeResult | undefined} primary - Diagnoza główna
 * @param {string | undefined} previousDiagnosisCode - Kod poprzedniego aktywnego wniosku
 * @returns {"active" | "hypothesis"} Status wniosku
 */
export function resolveInsightStatus(
  primary: DiagnosticTreeResult | undefined,
  previousDiagnosisCode: string | undefined,
): "active" | "hypothesis" {
  if (!primary?.isTriggered || primary.severity === "info") return "active";
  return primary.diagnosisCode === previousDiagnosisCode ? "active" : "hypothesis";
}

/**
 * Wyznacza bieżącą dobę fizjologiczną dziecka.
 *
 * @param {ChildRecord} child - Dziecko
 * @param {readonly SleepLogRecord[]} sleepRecords - Logi snu (najnowsze pierwsze)
 * @param {string} nowIso - Czas odniesienia
 * @returns {string} Data doby fizjologicznej (YYYY-MM-DD)
 */
function resolveTodayPhysiologicalDate(
  child: ChildRecord,
  sleepRecords: readonly SleepLogRecord[],
  nowIso: string,
): string {
  const latestNight = sleepRecords.find((l) => l.type === "night");
  return resolvePhysiologicalDate({
    eventTimestamp: nowIso,
    timeZone: child.timezone || DEFAULT_TIME_ZONE,
    activeOrRecentNightSleep: latestNight
      ? {
          physiologicalDate: latestNight.physiological_date,
          fellAsleepAt: latestNight.fell_asleep_at || latestNight.put_down_at || nowIso,
          wokeUpAt: latestNight.woke_up_at,
        }
      : null,
  });
}

/**
 * Pobiera tagi bieżącej doby fizjologicznej i datę startu aktywnego planu (best effort).
 *
 * @param {PocketBase} pb - Klient PocketBase użytkownika
 * @param {ChildRecord} child - Dziecko
 * @param {readonly SleepLogRecord[]} sleepRecords - Logi snu (najnowsze pierwsze)
 * @param {string} nowIso - Czas odniesienia
 * @returns {Promise<DiagnosticExtras>} Tagi i start planu
 */
export async function loadDiagnosticExtras(
  pb: PocketBase,
  child: ChildRecord,
  sleepRecords: readonly SleepLogRecord[],
  nowIso: string,
): Promise<DiagnosticExtras> {
  const todayDate = resolveTodayPhysiologicalDate(child, sleepRecords, nowIso);

  const [context, goals] = await Promise.all([
    pb
      .collection("day_context")
      .getList<DayContextRecord>(1, DAY_CONTEXT_LIMIT, {
        filter: pb.filter("child_id = {:childId} && physiological_date = {:date}", {
          childId: child.id,
          date: todayDate,
        }),
      })
      .then((r) => r.items)
      .catch(() => [] as DayContextRecord[]),
    pb
      .collection("child_goals")
      .getList<ChildGoalRecord>(1, 1, {
        filter: pb.filter("child_id = {:childId} && status = 'active'", { childId: child.id }),
        sort: "-created",
      })
      .then((r) => r.items)
      .catch(() => [] as ChildGoalRecord[]),
  ]);

  return {
    todayTags: context.flatMap((c) => c.tags ?? []),
    currentPlanStartDateIso: goals[0]?.started_on ?? null,
  };
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
 * @param {object} input - Dziecko, logi snu, nadpisanie matrycy, czas odniesienia i dane dodatkowe
 * @returns {DeterministicEngineResult} Wynik silnika
 */
export function runDeterministicEngine(input: {
  readonly child: ChildRecord;
  readonly sleepRecords: readonly SleepLogRecord[];
  readonly matrixOverrideJson: unknown;
  readonly nowIso: string;
  readonly extras?: DiagnosticExtras;
}): DeterministicEngineResult {
  const effectiveAgeDays = calculateEffectiveAgeDays(
    input.child.birth_date,
    input.child.due_date,
    input.nowIso,
  );
  const dailyTotals = aggregateDailySleepSummaries(input.sleepRecords);
  // Norma, dług i liczba drzemek liczone z pełnych dób, bez bieżącej (niedokończonej)
  const todayDate = resolveTodayPhysiologicalDate(input.child, input.sleepRecords, input.nowIso);
  const completedDays = dailyTotals.filter((day) => day.physiologicalDate !== todayDate);
  const bracket = applyObservedNapsCount(
    getAgeBracket(effectiveAgeDays, resolveSleepMatrix(input.matrixOverrideJson)),
    completedDays,
  );
  const chronicDrive = calculateChronicDrive(completedDays, bracket);
  const allDiagnostics = evaluateAll7DiagnosticCategories(
    buildDiagnosticInput({
      child: input.child,
      nowIso: input.nowIso,
      bracket,
      effectiveAgeDays,
      recentSleepLogs: input.sleepRecords.map(mapRecordToSleepLog),
      dailyTotals,
      chronicSleepDebtMin: chronicDrive.chronicSleepDebtMin,
      sleepBatteryPercent: chronicDrive.sleepBatteryPercent,
      sleepNeedsProfile: chronicDrive.sleepNeedsProfile,
      extras: input.extras,
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
