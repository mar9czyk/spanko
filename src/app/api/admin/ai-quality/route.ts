import { NextResponse } from "next/server";
import { computeAiQuality, type QualityInput } from "@/lib/admin/quality";
import { AiQualityQuerySchema } from "@/lib/server/adminSchemas";
import { toErrorResponse } from "@/lib/server/apiResponse";
import { ApiAuthError, requireAdmin, requireServiceClient } from "@/lib/server/auth";
import type { AiCallRecord, ChildInsightRecord } from "@/lib/types/database";

const CORRECTIONS_LIMIT = 20;

type CallWithInsight = AiCallRecord & {
  readonly expand?: { readonly insight_id?: ChildInsightRecord };
};

/**
 * GET /api/admin/ai-quality — jakość wniosków AI: accepted/corrected/pending per kategoria
 * i per wersja promptu oraz ostatnie korekty rodziców (materiał do poprawy promptu).
 *
 * @param {Request} request - Żądanie HTTP (query: limit — ile ostatnich wywołań analizować)
 * @returns {Promise<NextResponse>} Raport jakości i lista korekt
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const query = AiQualityQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!query.success) {
      throw new ApiAuthError("Niepoprawne parametry zapytania.", 400);
    }
    const service = await requireServiceClient();

    const [calls, corrections] = await Promise.all([
      service.collection("ai_calls").getList<CallWithInsight>(1, query.data.limit, {
        sort: "-created",
        expand: "insight_id",
        filter: "kind = 'evaluate' && status = 'ok' && insight_id != ''",
      }),
      service.collection("child_insights").getList<ChildInsightRecord>(1, CORRECTIONS_LIMIT, {
        sort: "-updated",
        filter: "parent_correction_note != ''",
      }),
    ]);

    const rows: QualityInput[] = calls.items.map((call) => ({
      category: call.category || call.expand?.insight_id?.category || "",
      promptVersion: call.prompt_version ?? 0,
      feedback: call.expand?.insight_id?.parent_feedback,
      insightStatus: call.expand?.insight_id?.status,
    }));

    return NextResponse.json({
      success: true,
      analyzed: rows.length,
      report: computeAiQuality(rows),
      corrections: corrections.items.map((insight) => ({
        id: insight.id,
        category: insight.category,
        title: insight.title,
        note: insight.parent_correction_note ?? "",
        feedback: insight.parent_feedback ?? null,
        updated: insight.updated,
      })),
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się obliczyć jakości wniosków.");
  }
}
