import { NextResponse } from "next/server";
import type PocketBase from "pocketbase";
import {
  buildRequestSnapshot,
  fetchAdminSettings,
  type InsightEvaluationContext,
  linkAiCallToInsight,
  runInsightEvaluation,
} from "@/lib/openrouter";
import { enforceDailyAiLimit, isAiDisabled } from "@/lib/server/aiLimit";
import { ApiAuthError, authenticateRequest } from "@/lib/server/auth";
import {
  loadDiagnosticExtras,
  resolveInsightStatus,
  runDeterministicEngine,
} from "@/lib/server/childEngine";
import { localizeDiagnosticTexts } from "@/lib/sleep-engine";
import type { ChildInsightRecord, ChildRecord, SleepLogRecord } from "@/lib/types/database";

export const MINUTES_PER_HOUR = 60;

interface EvaluateInsightsRequestBody {
  readonly childId: string;
  readonly locale?: string;
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
    clinicalAction?: string;
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
    clinical_action: payload.clinicalAction,
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
 * Route Handler POST /api/ai/evaluate-insights
 *
 * @description
 * Uruchamia deterministyczny silnik (3 napędy + 7 drzew diagnostycznych), prosi OpenRouter
 * wyłącznie o tekst dla rodzica i zapisuje ewoluujący wniosek w child_insights.
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
    // AI wyłączone (globalnie lub dla gospodarstwa) → sam silnik deterministyczny, bez limitu i błędu
    const aiDisabled = await isAiDisabled(pb, user.household_id);
    if (!aiDisabled) {
      await enforceDailyAiLimit(pb, user.household_id);
    }

    const sleepRecords = await loadSleepLogRecords(pb, childId);
    const existingActiveInsight = await loadActiveInsight(pb, childId);

    const nowIso = new Date().toISOString();
    const [adminSettings, extras] = await Promise.all([
      fetchAdminSettings(),
      loadDiagnosticExtras(pb, child, sleepRecords, nowIso),
    ]);
    // Diagnoza, pewność, status i nadpisania pochodzą wyłącznie z silnika deterministycznego
    const { effectiveAgeDays, chronicDrive, significantDiagnostics } = runDeterministicEngine({
      child,
      sleepRecords,
      matrixOverrideJson: adminSettings?.sleep_matrix_override_json,
      nowIso,
      extras,
    });

    const locale = body.locale === "en" ? "en" : "pl";
    const evaluationContext: InsightEvaluationContext = {
      locale,
      childAgeDisplay: `${Math.round(effectiveAgeDays / 30)} msc`,
      effectiveAgeDays,
      activeDayMode: child.active_day_mode,
      chronicSleepDebtMin: chronicDrive.chronicSleepDebtMin,
      sleepBatteryPercent: chronicDrive.sleepBatteryPercent,
      sleepNeedsProfile: chronicDrive.sleepNeedsProfile,
      triggeredDiagnostics: significantDiagnostics.map((rawDiag) => {
        const diag = localizeDiagnosticTexts(rawDiag, locale);
        return {
          category: diag.category,
          diagnosisCode: diag.diagnosisCode,
          severity: diag.severity,
          title: diag.title,
          explanation: diag.explanation,
          clinicalAction: diag.clinicalAction,
          confidenceScore: diag.confidenceScore,
          algorithmOverride: diag.algorithmOverride ? { ...diag.algorithmOverride } : undefined,
        };
      }),
      insightStatus: resolveInsightStatus(
        significantDiagnostics[0],
        existingActiveInsight?.diagnosis_code,
      ),
      activeInsights: existingActiveInsight ? [existingActiveInsight] : [],
    };

    const evaluation = await runInsightEvaluation(evaluationContext, {
      skipAi: aiDisabled,
      audit: {
        kind: "evaluate",
        childId: child.id,
        householdId: user.household_id,
        userId: user.id,
        requestSnapshot: buildRequestSnapshot(evaluationContext),
      },
    });
    const aiInsight = evaluation.insight;

    const savedInsight = await saveNewInsightRecord(pb, {
      childId: child.id,
      category: aiInsight.category,
      diagnosisCode: aiInsight.diagnosis_code,
      status: aiInsight.status === "hypothesis" ? "hypothesis" : "active",
      title: aiInsight.title,
      explanation: aiInsight.explanation,
      clinicalAction: aiInsight.clinical_action,
      algorithmOverrideJson: aiInsight.algorithm_override_json,
      confidenceScore: aiInsight.confidence_score,
      previousInsightId: existingActiveInsight?.id,
    });

    await linkAiCallToInsight(evaluation.callId, savedInsight.id);

    if (existingActiveInsight?.id) {
      await archiveSupersededInsight(pb, existingActiveInsight.id, savedInsight.id);
    }

    return NextResponse.json({
      success: true,
      insight: savedInsight,
      supersededInsightId: existingActiveInsight?.id,
      aiSkipped: evaluation.aiSkipped,
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
