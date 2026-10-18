import { NextResponse } from "next/server";
import { evaluateSleepInsightsWithOpenRouter } from "@/lib/openrouter";
import { pb } from "@/lib/pocketbase";
import {
  calculateChronicDrive,
  calculateEffectiveAgeDays,
  evaluateAll7DiagnosticCategories,
  getAgeBracket,
} from "@/lib/sleep-engine";
import type {
  DailySleepSummary,
  DiagnosticEvaluationInput,
  DiagnosticTreeResult,
  SleepLog,
} from "@/lib/sleep-engine/types";
import type { ChildInsightRecord, ChildRecord, SleepLogRecord } from "@/lib/types/database";

export const DEFAULT_FALLBACK_BEDTIME_MINUTES = 1200;
export const MINUTES_PER_HOUR = 60;
export const MILLISECONDS_PER_MINUTE = 60_000;

interface EvaluateInsightsRequestBody {
  readonly childId: string;
}

/**
 * Przelicza różnicę czasu w milisekundach na minuty.
 *
 * @param {string | undefined} startIso - Czas rozpoczęcia w formacie ISO
 * @param {string | undefined} endIso - Czas zakończenia w formacie ISO
 * @returns {number} Czas trwania w minutach
 */
function calculateDurationInMinutes(startIso?: string, endIso?: string): number {
  if (!startIso || !endIso) return 0;
  const startTime = new Date(startIso).getTime();
  const endTime = new Date(endIso).getTime();
  return Math.max(0, Math.round((endTime - startTime) / MILLISECONDS_PER_MINUTE));
}

/**
 * Mapuje rekord bazy danych SleepLogRecord na format oczekiwany przez silnik snu.
 *
 * @param {SleepLogRecord} record - Rekord z kolekcji sleep_logs
 * @returns {SleepLog} Obiekt logu dla silnika snu
 */
function mapRecordToSleepLog(record: SleepLogRecord): SleepLog {
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

/**
 * Grupuje logi snu po dacie fizjologicznej i oblicza dobowe sumy snu.
 *
 * @param {readonly SleepLogRecord[]} records - Lista logów z bazy danych
 * @returns {DailySleepSummary[]} Podsumowania dobowe dla ostatnich dni
 */
function aggregateDailySleepSummaries(records: readonly SleepLogRecord[]): DailySleepSummary[] {
  const groupedByDate = new Map<string, { totalSleepMin: number; isIllOrIgnored: boolean }>();

  for (const record of records) {
    if (record.status !== "completed") continue;
    const dateKey = record.physiological_date;
    const duration = calculateDurationInMinutes(
      record.fell_asleep_at || record.put_down_at,
      record.woke_up_at,
    );

    const existing = groupedByDate.get(dateKey) || { totalSleepMin: 0, isIllOrIgnored: false };
    groupedByDate.set(dateKey, {
      totalSleepMin: existing.totalSleepMin + duration,
      isIllOrIgnored: existing.isIllOrIgnored || record.ignore_in_calibration,
    });
  }

  return Array.from(groupedByDate.entries()).map(([dateKey, values]) => ({
    physiologicalDate: dateKey,
    totalSleepMin: values.totalSleepMin,
    isIllOrIgnored: values.isIllOrIgnored,
  }));
}

/**
 * Pobiera dane dziecka z PocketBase lub tworzy obiekt zastępczy w trybie offline.
 *
 * @param {string} childId - Identyfikator dziecka
 * @returns {Promise<ChildRecord>} Rekord dziecka
 */
async function loadChildRecord(childId: string): Promise<ChildRecord> {
  try {
    return await pb.collection("children").getOne<ChildRecord>(childId);
  } catch {
    return {
      id: childId,
      household_id: "household_default",
      name: "Dziecko",
      birth_date: new Date(Date.now() - 150 * 86_400_000).toISOString(),
      active_day_mode: "home",
      anti_orthosomnia_mode: false,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
  }
}

/**
 * Pobiera logi snu dla dziecka z ostatnich 14 dni z PocketBase.
 *
 * @param {string} childId - Identyfikator dziecka
 * @returns {Promise<SleepLogRecord[]>} Lista logów snu
 */
async function loadSleepLogRecords(childId: string): Promise<SleepLogRecord[]> {
  try {
    const listResult = await pb.collection("sleep_logs").getList<SleepLogRecord>(1, 100, {
      filter: pb.filter("child_id = {:childId}", { childId }),
      sort: "-created",
    });
    return listResult.items;
  } catch {
    return [];
  }
}

/**
 * Pobiera aktualnie aktywny lub oczekujący wniosek dziecka.
 *
 * @param {string} childId - Identyfikator dziecka
 * @returns {Promise<ChildInsightRecord | null>} Aktywny wniosek lub null
 */
async function loadActiveInsight(childId: string): Promise<ChildInsightRecord | null> {
  try {
    const result = await pb.collection("child_insights").getFirstListItem<ChildInsightRecord>(
      pb.filter("child_id = {:childId} && (status = 'active' || status = 'hypothesis')", {
        childId,
      }),
    );
    return result;
  } catch {
    return null;
  }
}

/**
 * Formułuje wejście diagnostyczne dla deterministycznego silnika snu.
 *
 * @param {object} params - Zestaw parametrów wejściowych
 * @returns {DiagnosticEvaluationInput} Kompletne wejście silnika
 */
function buildDiagnosticInput(params: {
  child: ChildRecord;
  effectiveAgeDays: number;
  recentSleepLogs: readonly SleepLog[];
  dailyTotals: readonly DailySleepSummary[];
  chronicSleepDebtMin: number;
  sleepBatteryPercent: number;
  sleepNeedsProfile: "low_sleep_needs" | "average" | "high_sleep_needs";
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
 * Zapisuje nowy rekord wniosku w kolekcji child_insights.
 *
 * @param {object} payload - Parametry nowego wniosku
 * @returns {Promise<ChildInsightRecord>} Nowo utworzony wniosek
 */
async function saveNewInsightRecord(payload: {
  childId: string;
  category: string;
  diagnosisCode: string;
  status: "active" | "hypothesis";
  title: string;
  explanation: string;
  algorithmOverrideJson: Record<string, unknown>;
  confidenceScore: number;
  previousInsightId?: string;
}): Promise<ChildInsightRecord> {
  const newRecordData = {
    child_id: payload.childId,
    category: payload.category,
    diagnosis_code: payload.diagnosisCode,
    status: payload.status,
    title: payload.title,
    explanation: payload.explanation,
    algorithm_override_json: payload.algorithmOverrideJson,
    confidence_score: payload.confidenceScore,
    parent_feedback: "pending" as const,
    previous_insight_id: payload.previousInsightId,
    valid_from: new Date().toISOString(),
  };

  try {
    return await pb.collection("child_insights").create<ChildInsightRecord>(newRecordData);
  } catch {
    return {
      ...newRecordData,
      id: `insight_${Date.now()}`,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
  }
}

/**
 * Aktualizuje poprzedni aktywny wniosek ustawiając status superseded i wskaźnik nowszego wniosku.
 *
 * @param {string} previousId - Identyfikator zastępowanego wniosku
 * @param {string} newerId - Identyfikator nowego wniosku
 */
async function archiveSupersededInsight(previousId: string, newerId: string): Promise<void> {
  try {
    await pb.collection("child_insights").update(previousId, {
      status: "superseded",
      superseded_by_id: newerId,
      valid_until: new Date().toISOString(),
    });
  } catch {
    // Brak akcji w trybie offline/mock
  }
}

/**
 * Wybiera istotne diagnozy z 7 deterministycznych kategorii problemów snu.
 *
 * @param {readonly DiagnosticTreeResult[]} results - Wszystkie 7 wyników
 * @returns {DiagnosticTreeResult[]} Zdiagnozowane lub domyślne kategorie
 */
function resolveSignificantDiagnostics(
  results: readonly DiagnosticTreeResult[],
): readonly DiagnosticTreeResult[] {
  const triggered = results.filter((diag) => diag.isTriggered);
  if (triggered.length > 0) {
    return triggered;
  }
  const firstDiagnostic = results[0];
  return firstDiagnostic ? [firstDiagnostic] : [];
}

/**
 * Route Handler POST /api/ai/evaluate-insights
 *
 * @description
 * Uruchamia deterministyczny silnik (3 napędy + 7 drzew diagnostycznych),
 * przekazuje diagnozę do OpenRoutera i zapisuje ewoluujący wniosek w child_insights.
 *
 * @param {Request} request - Przychodzące żądanie HTTP
 * @returns {Promise<NextResponse>} Odpowiedź z utworzonym wnioskiem i łańcuchem ewolucji
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as EvaluateInsightsRequestBody;
    const childId = body?.childId;
    if (!childId) {
      return NextResponse.json({ error: "Wymagane pole childId." }, { status: 400 });
    }

    const child = await loadChildRecord(childId);
    const sleepRecords = await loadSleepLogRecords(childId);
    const existingActiveInsight = await loadActiveInsight(childId);

    const nowIso = new Date().toISOString();
    const effectiveAgeDays = calculateEffectiveAgeDays(child.birth_date, child.due_date, nowIso);
    const bracket = getAgeBracket(effectiveAgeDays);
    const dailyTotals = aggregateDailySleepSummaries(sleepRecords);
    const chronicDrive = calculateChronicDrive(dailyTotals, bracket);

    const diagnosticInput = buildDiagnosticInput({
      child,
      effectiveAgeDays,
      recentSleepLogs: sleepRecords.map(mapRecordToSleepLog),
      dailyTotals,
      chronicSleepDebtMin: chronicDrive.chronicSleepDebtMin,
      sleepBatteryPercent: chronicDrive.sleepBatteryPercent,
      sleepNeedsProfile: chronicDrive.sleepNeedsProfile,
    });

    const allDiagnostics = evaluateAll7DiagnosticCategories(diagnosticInput);
    const significantDiagnostics = resolveSignificantDiagnostics(allDiagnostics);

    const aiInsight = await evaluateSleepInsightsWithOpenRouter({
      childAgeDisplay: `${Math.round(effectiveAgeDays / 30)} msc`,
      effectiveAgeDays,
      activeDayMode: child.active_day_mode,
      chronicSleepDebtMin: chronicDrive.chronicSleepDebtMin,
      sleepBatteryPercent: chronicDrive.sleepBatteryPercent,
      sleepNeedsProfile: chronicDrive.sleepNeedsProfile,
      triggeredDiagnostics: significantDiagnostics.map((diag) => ({
        category: diag.category,
        diagnosisCode: diag.diagnosisCode,
        severity: diag.severity,
        title: diag.title,
        explanation: diag.explanation,
        clinicalAction: diag.clinicalAction,
      })),
      activeInsights: existingActiveInsight ? [existingActiveInsight] : [],
    });

    const savedInsight = await saveNewInsightRecord({
      childId: child.id,
      category: aiInsight.category,
      diagnosisCode: aiInsight.diagnosis_code,
      status: aiInsight.status === "hypothesis" ? "hypothesis" : "active",
      title: aiInsight.title,
      explanation: aiInsight.explanation,
      algorithmOverrideJson: aiInsight.algorithm_override_json,
      confidenceScore: aiInsight.confidence_score,
      previousInsightId: existingActiveInsight?.id,
    });

    if (existingActiveInsight?.id) {
      await archiveSupersededInsight(existingActiveInsight.id, savedInsight.id);
    }

    return NextResponse.json({
      success: true,
      insight: savedInsight,
      supersededInsightId: existingActiveInsight?.id,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Nieznany błąd ewaluacji wniosków.";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
