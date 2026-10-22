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

    const { page, perPage, status, household_id, child_id, user_id, category, model, from, to } =
      query.data;
    const clauses: string[] = [];
    if (status) clauses.push(pb.filter("status = {:status}", { status }));
    if (household_id) clauses.push(pb.filter("household_id = {:v}", { v: household_id }));
    if (user_id) clauses.push(pb.filter("user_id = {:v}", { v: user_id }));
    if (child_id) clauses.push(pb.filter("child_id = {:v}", { v: child_id }));
    if (category) clauses.push(pb.filter("category ~ {:v}", { v: category }));
    if (model) clauses.push(pb.filter("model ~ {:v}", { v: model }));
    if (from) clauses.push(pb.filter("created >= {:v}", { v: from }));
    if (to) clauses.push(pb.filter("created <= {:v}", { v: to }));

    const result = await pb.collection("ai_calls").getList<AiCallWithExpand>(page, perPage, {
      sort: "-created",
      expand: "insight_id",
      filter: clauses.join(" && "),
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
