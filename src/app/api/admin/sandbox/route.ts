import { NextResponse } from "next/server";
import { buildRequestSnapshot, runInsightEvaluation } from "@/lib/openrouter";
import { SandboxRequestSchema } from "@/lib/server/adminSchemas";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { requireAdmin } from "@/lib/server/auth";
import { buildSandboxContext } from "@/lib/server/sandboxFixtures";

/**
 * POST /api/admin/sandbox — testuje prompt/model na przykładowych danych.
 *
 * @description
 * Nie tworzy żadnych rekordów child_insights; wywołanie trafia do ai_calls z kind `sandbox`.
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Kontekst z silnika i wynik wywołania modelu
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const body = await parseJsonBody(request, SandboxRequestSchema);

    const context = buildSandboxContext(body.sample);
    const outcome = await runInsightEvaluation(context, {
      modelName: body.model || undefined,
      systemPrompt: body.prompt || undefined,
      audit: {
        kind: "sandbox",
        requestSnapshot: { sample: body.sample, ...buildRequestSnapshot(context) },
      },
    });

    return NextResponse.json({
      success: true,
      context,
      result: {
        status: outcome.status,
        model: outcome.model,
        insight: outcome.insight,
        errorMessage: outcome.errorMessage,
        rawResponse: outcome.rawResponse,
        latencyMs: outcome.latencyMs,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Błąd Sandboxa.");
  }
}
