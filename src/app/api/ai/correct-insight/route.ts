import { NextResponse } from "next/server";
import type PocketBase from "pocketbase";
import { ApiAuthError, authenticateRequest } from "@/lib/server/auth";
import type { ChildInsightRecord, ParentFeedback, SleepLogRecord } from "@/lib/types/database";

export interface CorrectInsightRequestBody {
  readonly insightId: string;
  readonly feedback: ParentFeedback;
  readonly parentCorrectionNote?: string;
  readonly isAnomalyException?: boolean;
  readonly sleepLogIdToIgnore?: string;
  readonly algorithmOverrideJson?: Record<string, unknown>;
}

/**
 * Waliduje poprawność danych wejściowych w żądaniu korekty wniosku.
 *
 * @param {Partial<CorrectInsightRequestBody>} body - Ciało żądania
 * @returns {string | null} Komunikat błędu lub null
 */
function validateCorrectionPayload(body: Partial<CorrectInsightRequestBody>): string | null {
  if (!body.insightId) {
    return "Wymagany identyfikator wniosku (insightId).";
  }
  if (!body.feedback) {
    return "Wymagany status opinii rodzica (feedback).";
  }
  return null;
}

/**
 * Określa status wniosku w oparciu o akcję podjętą przez rodzica.
 *
 * @param {ParentFeedback} feedback - Informacja zwrotna rodzica
 * @returns {ChildInsightRecord["status"]} Nowy status wniosku
 */
function resolveNewInsightStatus(feedback: ParentFeedback): ChildInsightRecord["status"] {
  if (feedback === "accepted") {
    return "validated";
  }
  return "corrected_by_parent";
}

/**
 * Buduje obiekt aktualizacji dla rekordu wniosku w child_insights.
 *
 * @param {CorrectInsightRequestBody} payload - Dane przesłane przez rodzica
 * @returns {Record<string, unknown>} Obiekt zmian dla PocketBase
 */
function buildInsightUpdatePayload(payload: CorrectInsightRequestBody): Record<string, unknown> {
  const newStatus = resolveNewInsightStatus(payload.feedback);
  const updateData: Record<string, unknown> = {
    status: newStatus,
    parent_feedback: payload.feedback,
  };

  if (payload.parentCorrectionNote) {
    updateData.parent_correction_note = payload.parentCorrectionNote.trim();
  }
  if (payload.algorithmOverrideJson) {
    updateData.algorithm_override_json = payload.algorithmOverrideJson;
  }

  return updateData;
}

/**
 * Wyszukuje najnowszy wpis snu dla danego dziecka.
 *
 * @param {PocketBase} pb - Klient PocketBase użytkownika
 * @param {string} childId - Identyfikator dziecka
 * @returns {Promise<string | null>} Identyfikator wpisu lub null
 */
async function findLatestSleepLogId(pb: PocketBase, childId: string): Promise<string | null> {
  const latestLogs = await pb.collection("sleep_logs").getList<SleepLogRecord>(1, 1, {
    filter: pb.filter("child_id = {:childId}", { childId }),
    sort: "-created",
  });
  return latestLogs.items[0]?.id ?? null;
}

/**
 * Wyłącza anomalię z kalibracji; wpis musi należeć do dziecka, którego dotyczy wniosek.
 *
 * @param {PocketBase} pb - Klient PocketBase użytkownika
 * @param {CorrectInsightRequestBody} payload - Dane żądania
 * @param {string} childId - Dziecko, którego dotyczy wniosek
 * @returns {Promise<string | null>} Identyfikator zaktualizowanego logu
 */
async function handleAnomalyCalibrationExclusion(
  pb: PocketBase,
  payload: CorrectInsightRequestBody,
  childId: string,
): Promise<string | null> {
  let targetLogId: string | null = null;

  if (payload.sleepLogIdToIgnore) {
    const log = await pb
      .collection("sleep_logs")
      .getOne<SleepLogRecord>(payload.sleepLogIdToIgnore);
    if (log.child_id !== childId) {
      throw new ApiAuthError("Wpis snu nie należy do tego dziecka.", 403);
    }
    targetLogId = log.id;
  } else if (payload.isAnomalyException) {
    targetLogId = await findLatestSleepLogId(pb, childId);
  }

  if (targetLogId) {
    await pb.collection("sleep_logs").update(targetLogId, { ignore_in_calibration: true });
  }
  return targetLogId;
}

/**
 * Route Handler POST /api/ai/correct-insight (Human-in-the-Loop)
 *
 * @description
 * Wymaga tokena użytkownika. Umożliwia rodzicowi zatwierdzenie, odrzucenie lub modyfikację reguły AI.
 * Przy anomaliach wyklucza zniekształcony wpis z kalibracji algorytmu (ignore_in_calibration = true)
 * oraz zapisuje nadpisane parametry w algorithm_override_json.
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Zaktualizowany wniosek
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { pb } = await authenticateRequest(request);

    const payload = (await request.json()) as CorrectInsightRequestBody;
    const validationError = validateCorrectionPayload(payload);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Reguły API PocketBase zwracają 404, jeśli wniosek należy do innego gospodarstwa.
    let existingInsight: ChildInsightRecord;
    try {
      existingInsight = await pb
        .collection("child_insights")
        .getOne<ChildInsightRecord>(payload.insightId);
    } catch {
      return NextResponse.json({ error: "Nie znaleziono wniosku." }, { status: 404 });
    }

    const ignoredSleepLogId = await handleAnomalyCalibrationExclusion(
      pb,
      payload,
      existingInsight.child_id,
    );
    const updatedInsight = await pb
      .collection("child_insights")
      .update<ChildInsightRecord>(payload.insightId, buildInsightUpdatePayload(payload));

    return NextResponse.json({ success: true, insight: updatedInsight, ignoredSleepLogId });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    const errorMessage = error instanceof Error ? error.message : "Błąd aktualizacji wniosku.";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
