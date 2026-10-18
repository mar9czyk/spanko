import { NextResponse } from "next/server";
import { AiCallsQuerySchema } from "@/lib/server/adminSchemas";
import { toErrorResponse } from "@/lib/server/apiResponse";
import { ApiAuthError, requireAdmin } from "@/lib/server/auth";
import type { AiCallRecord, ChildInsightRecord } from "@/lib/types/database";

type AiCallWithExpand = AiCallRecord & {
  readonly expand?: { readonly insight_id?: ChildInsightRecord };
};

/**
 * GET /api/admin/ai-calls — paginowany log wywołań AI wraz z reakcją rodzica na wniosek.
 *
 * @param {Request} request - Żądanie HTTP (query: page, perPage, status)
 * @returns {Promise<NextResponse>} Strona wyników
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { pb } = await requireAdmin(request);
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = AiCallsQuerySchema.safeParse(params);
    if (!query.success) {
      throw new ApiAuthError("Niepoprawne parametry zapytania.", 400);
    }

    const { page, perPage, status } = query.data;
    const result = await pb.collection("ai_calls").getList<AiCallWithExpand>(page, perPage, {
      sort: "-created",
      expand: "insight_id",
      filter: status ? pb.filter("status = {:status}", { status }) : "",
    });

    return NextResponse.json({
      success: true,
      page: result.page,
      totalPages: result.totalPages,
      totalItems: result.totalItems,
      items: result.items.map(({ expand, ...call }) => ({
        ...call,
        insight: expand?.insight_id
          ? {
              id: expand.insight_id.id,
              title: expand.insight_id.title,
              status: expand.insight_id.status,
              parent_feedback: expand.insight_id.parent_feedback ?? null,
              parent_correction_note: expand.insight_id.parent_correction_note ?? null,
            }
          : null,
      })),
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać logu wywołań AI.");
  }
}
