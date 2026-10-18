import { NextResponse } from "next/server";
import { pb } from "@/lib/pocketbase";
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
 * Oznacza wybrany wpis snu jako anomalię ignorowaną w kalibracji normy.
 *
 * @param {string} sleepLogId - Identyfikator rekordu w sleep_logs
 * @returns {Promise<boolean>} Czy pomyślnie zaktualizowano wpis
 */
async function markSleepLogAsIgnored(sleepLogId: string): Promise<boolean> {
  try {
    await pb.collection("sleep_logs").update(sleepLogId, {
      ignore_in_calibration: true,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Wyszukuje najnowszy wpis snu dla danego dziecka i oznacza go jako ignorowany.
 *
 * @param {string} childId - Identyfikator dziecka
 * @returns {Promise<string | null>} Identyfikator oznaczonego wpisu lub null
 */
async function markLatestSleepLogAsIgnored(childId: string): Promise<string | null> {
  try {
    const latestLogs = await pb.collection("sleep_logs").getList<SleepLogRecord>(1, 1, {
      filter: pb.filter("child_id = {:childId}", { childId }),
      sort: "-created",
    });

    const targetLog = latestLogs.items[0];
    if (targetLog) {
      await markSleepLogAsIgnored(targetLog.id);
      return targetLog.id;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Obsługuje wyłączenie anomalii z kalibracji na podstawie przekazanych parametrów.
 *
 * @param {CorrectInsightRequestBody} payload - Dane żądania
 * @param {string} [childId] - Opcjonalny identyfikator dziecka
 * @returns {Promise<string | null>} Identyfikator zaktualizowanego logu
 */
async function handleAnomalyCalibrationExclusion(
  payload: CorrectInsightRequestBody,
  childId?: string,
): Promise<string | null> {
  if (payload.sleepLogIdToIgnore) {
    await markSleepLogAsIgnored(payload.sleepLogIdToIgnore);
    return payload.sleepLogIdToIgnore;
  }

  if (payload.isAnomalyException && childId) {
    return await markLatestSleepLogAsIgnored(childId);
  }

  return null;
}

/**
 * Pobiera istniejący rekord wniosku z PocketBase.
 *
 * @param {string} insightId - Identyfikator wniosku
 * @returns {Promise<ChildInsightRecord | null>} Pobrany rekord lub null
 */
async function fetchExistingInsight(insightId: string): Promise<ChildInsightRecord | null> {
  try {
    return await pb.collection("child_insights").getOne<ChildInsightRecord>(insightId);
  } catch {
    return null;
  }
}

/**
 * Zapisuje aktualizację wniosku w PocketBase lub zwraca symulowany rekord.
 *
 * @param {string} insightId - Identyfikator wniosku
 * @param {Record<string, unknown>} updateData - Dane aktualizacji
 * @param {ChildInsightRecord | null} fallback - Rekord bazowy w trybie offline
 * @returns {Promise<ChildInsightRecord>} Zaktualizowany rekord
 */
async function persistInsightUpdate(
  insightId: string,
  updateData: Record<string, unknown>,
  fallback: ChildInsightRecord | null,
): Promise<ChildInsightRecord> {
  try {
    return await pb.collection("child_insights").update<ChildInsightRecord>(insightId, updateData);
  } catch {
    return {
      ...(fallback || {
        id: insightId,
        child_id: "child_default",
        category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
        diagnosis_code: "OVERTIRED_FUSS",
        title: "Korekta rodzica",
        explanation: "Zaktualizowano preferencje.",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }),
      ...updateData,
      updated: new Date().toISOString(),
    } as ChildInsightRecord;
  }
}

/**
 * Route Handler POST /api/ai/correct-insight (Human-in-the-Loop)
 *
 * @description
 * Umożliwia rodzicowi zatwierdzenie, odrzucenie lub modyfikację reguły AI.
 * Przy anomaliach wyklucza zniekształcony wpis z kalibracji algorytmu (ignore_in_calibration = true)
 * oraz zapisuje nadpisane parametry w algorithm_override_json.
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Zaktualizowany wniosek
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = (await request.json()) as CorrectInsightRequestBody;
    const validationError = validateCorrectionPayload(payload);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const existingInsight = await fetchExistingInsight(payload.insightId);
    const updateData = buildInsightUpdatePayload(payload);
    const updatedInsight = await persistInsightUpdate(
      payload.insightId,
      updateData,
      existingInsight,
    );

    const ignoredSleepLogId = await handleAnomalyCalibrationExclusion(
      payload,
      existingInsight?.child_id,
    );

    return NextResponse.json({
      success: true,
      insight: updatedInsight,
      ignoredSleepLogId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Błąd aktualizacji wniosku.";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
