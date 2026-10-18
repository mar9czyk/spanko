import { NextResponse } from "next/server";
import type PocketBase from "pocketbase";
import { evaluateSleepInsightsWithOpenRouter, fetchAdminSettings } from "@/lib/openrouter";
import { ApiAuthError, authenticateRequest } from "@/lib/server/auth";
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
import { aggregateDailySleepSummaries } from "@/lib/sleep-summary";
import type { ChildInsightRecord, ChildRecord, SleepLogRecord } from "@/lib/types/database";

export const DEFAULT_FALLBACK_BEDTIME_MINUTES = 1200;
export const MINUTES_PER_HOUR = 60;
export const DEFAULT_AI_DAILY_LIMIT_PER_HOUSEHOLD = 20;
export const AI_LIMIT_WINDOW_MS = 86_400_000;

interface EvaluateInsightsRequestBody {
  readonly childId: string;
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
 * Pobiera dane dziecka; reguły API zwrócą błąd, jeśli dziecko nie należy do gospodarstwa użytkownika.
 *
 * @param {PocketBase} pb - Klient PocketBase użytkownika
 * @param {string} childId - Identyfikator dziecka
 * @throws {ApiAuthError} 404 gdy dziecko nie istnieje lub nie jest dostępne dla użytkownika
 * @returns {Promise<ChildRecord>} Rekord dziecka
 */
async function loadChildRecord(pb: PocketBase, childId: string): Promise<ChildRecord> {
  try {
    return await pb.collection("children").getOne<ChildRecord>(childId);
  } catch {
    throw new ApiAuthError("Nie znaleziono dziecka.", 404);
  }
}

/**
 * Pobiera logi snu dla dziecka z PocketBase.
 *
 * @param {PocketBase} pb - Klient PocketBase użytkownika
 * @param {string} childId - Identyfikator dziecka
 * @returns {Promise<SleepLogRecord[]>} Lista logów snu
 */
async function loadSleepLogRecords(pb: PocketBase, childId: string): Promise<SleepLogRecord[]> {
  const listResult = await pb.collection("sleep_logs").getList<SleepLogRecord>(1, 100, {
    filter: pb.filter("child_id = {:childId}", { childId }),
    sort: "-created",
  });
  return listResult.items;
}

/**
 * Pobiera aktualnie aktywny lub oczekujący wniosek dziecka.
 *
 * @param {PocketBase} pb - Klient PocketBase użytkownika
 * @param {string} childId - Identyfikator dziecka
 * @returns {Promise<ChildInsightRecord | null>} Aktywny wniosek lub null
 */
async function loadActiveInsight(
  pb: PocketBase,
  childId: string,
): Promise<ChildInsightRecord | null> {
  const result = await pb.collection("child_insights").getList<ChildInsightRecord>(1, 1, {
    filter: pb.filter("child_id = {:childId} && (status = 'active' || status = 'hypothesis')", {
      childId,
    }),
    sort: "-created",
  });
  return result.items[0] ?? null;
}

/**
 * Egzekwuje dzienny limit zapytań AI dla gospodarstwa (liczony jako wnioski z ostatnich 24h).
 *
 * @param {PocketBase} pb - Klient PocketBase użytkownika
 * @param {string} householdId - Identyfikator gospodarstwa
 * @throws {ApiAuthError} 429 po przekroczeniu limitu
 */
async function enforceDailyAiLimit(pb: PocketBase, householdId: string): Promise<void> {
  const adminSettings = await fetchAdminSettings();
  const limit = adminSettings?.ai_daily_limit_per_household ?? DEFAULT_AI_DAILY_LIMIT_PER_HOUSEHOLD;
  const since = new Date(Date.now() - AI_LIMIT_WINDOW_MS).toISOString();

  const recent = await pb.collection("child_insights").getList(1, 1, {
    filter: pb.filter("child_id.household_id = {:householdId} && created >= {:since}", {
      householdId,
      since,
    }),
  });

  if (recent.totalItems >= limit) {
    throw new ApiAuthError("Dzienny limit zapytań AI dla gospodarstwa został wyczerpany.", 429);
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
 * @param {PocketBase} pb - Klient PocketBase użytkownika
 * @param {object} payload - Parametry nowego wniosku
 * @returns {Promise<ChildInsightRecord>} Nowo utworzony wniosek
 */
async function saveNewInsightRecord(
  pb: PocketBase,
  payload: {
    childId: string;
    category: string;
    diagnosisCode: string;
    status: "active" | "hypothesis";
    title: string;
    explanation: string;
    algorithmOverrideJson: Record<string, unknown>;
    confidenceScore: number;
    previousInsightId?: string;
  },
): Promise<ChildInsightRecord> {
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

  return await pb.collection("child_insights").create<ChildInsightRecord>(newRecordData);
}

/**
 * Aktualizuje poprzedni aktywny wniosek ustawiając status superseded i wskaźnik nowszego wniosku.
 *
 * @param {PocketBase} pb - Klient PocketBase użytkownika
 * @param {string} previousId - Identyfikator zastępowanego wniosku
 * @param {string} newerId - Identyfikator nowego wniosku
 */
async function archiveSupersededInsight(
  pb: PocketBase,
  previousId: string,
  newerId: string,
): Promise<void> {
  await pb.collection("child_insights").update(previousId, {
    status: "superseded",
    superseded_by_id: newerId,
    valid_until: new Date().toISOString(),
  });
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
    const { pb, user } = await authenticateRequest(request);

    const body = (await request.json()) as EvaluateInsightsRequestBody;
    const childId = body?.childId;
    if (!childId) {
      return NextResponse.json({ error: "Wymagane pole childId." }, { status: 400 });
    }

    const child = await loadChildRecord(pb, childId);
    if (child.household_id !== user.household_id) {
      throw new ApiAuthError("Brak dostępu do tego dziecka.", 403);
    }
    await enforceDailyAiLimit(pb, user.household_id);

    const sleepRecords = await loadSleepLogRecords(pb, childId);
    const existingActiveInsight = await loadActiveInsight(pb, childId);

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

    const savedInsight = await saveNewInsightRecord(pb, {
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
      await archiveSupersededInsight(pb, existingActiveInsight.id, savedInsight.id);
    }

    return NextResponse.json({
      success: true,
      insight: savedInsight,
      supersededInsightId: existingActiveInsight?.id,
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    const errorMessage =
      error instanceof Error ? error.message : "Nieznany błąd ewaluacji wniosków.";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
