import { NextResponse } from "next/server";
import {
  buildRequestSnapshot,
  type InsightEvaluationContext,
  runInsightEvaluation,
} from "@/lib/openrouter";
import { ReplayRequestSchema } from "@/lib/server/adminSchemas";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { ApiAuthError, requireAdmin } from "@/lib/server/auth";
import type { AiCallRecord } from "@/lib/types/database";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

/**
 * Wyciąga zapisany pełny kontekst wywołania ze zrzutu żądania (jeśli wywołanie go zawiera).
 *
 * @param {AiCallRecord} call - Wpis z ai_calls
 * @returns {InsightEvaluationContext | null} Kontekst do ponownego uruchomienia albo null
 */
export function extractStoredContext(call: AiCallRecord): InsightEvaluationContext | null {
  const candidate = call.request_snapshot_json?.context;
  if (
    candidate &&
    typeof candidate === "object" &&
    Array.isArray((candidate as InsightEvaluationContext).triggeredDiagnostics)
  ) {
    return candidate as InsightEvaluationContext;
  }
  return null;
}

/**
 * POST /api/admin/ai-calls/[id]/replay — ponownie uruchamia zapisany kontekst z innym promptem/modelem.
 *
 * @description
 * Nie tworzy wniosku; nowe wywołanie jest logowane jako `sandbox`. Zwraca oryginalną i nową odpowiedź
 * do porównania. Starsze wywołania (sprzed zapisu pełnego kontekstu) nie mogą być odtworzone.
 *
 * @param {Request} request - Żądanie HTTP (opcjonalnie `prompt`, `model`)
 * @param {RouteContext} context - Parametry ścieżki
 * @returns {Promise<NextResponse>} Oryginał i wynik ponownego uruchomienia
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { pb } = await requireAdmin(request);
    const { id } = await context.params;
    const body = await parseJsonBody(request, ReplayRequestSchema);

    let call: AiCallRecord;
    try {
      call = await pb.collection("ai_calls").getOne<AiCallRecord>(id);
    } catch {
      throw new ApiAuthError("Nie znaleziono wywołania.", 404);
    }
    const storedContext = extractStoredContext(call);
    if (!storedContext) {
      throw new ApiAuthError(
        "To wywołanie nie ma zapisanego pełnego kontekstu — nie można go odtworzyć.",
        400,
      );
    }

    const outcome = await runInsightEvaluation(storedContext, {
      modelName: body.model || undefined,
      systemPrompt: body.prompt || undefined,
      audit: {
        kind: "sandbox",
        childId: call.child_id,
        householdId: call.household_id,
        requestSnapshot: { replayOf: id, ...buildRequestSnapshot(storedContext) },
      },
    });

    return NextResponse.json({
      success: true,
      original: { model: call.model ?? null, response: call.response_json ?? null },
      replay: {
        status: outcome.status,
        model: outcome.model,
        insight: outcome.insight,
        errorMessage: outcome.errorMessage,
        latencyMs: outcome.latencyMs,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się odtworzyć wywołania.");
  }
}
