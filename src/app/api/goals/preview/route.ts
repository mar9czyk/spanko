import { NextResponse } from "next/server";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { authenticateRequest } from "@/lib/server/auth";
import { buildGoalPreview, GoalSelectionSchema, loadChildGoalContext } from "@/lib/server/goals";

/**
 * POST /api/goals/preview — gotowość, baseline i podgląd planu dla wybranego celu (bez zapisu).
 *
 * @param {Request} request - Żądanie z wyborem celu i metody
 * @returns {Promise<NextResponse>} Gotowość, baseline i plan
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { pb, user } = await authenticateRequest(request);
    const selection = await parseJsonBody(request, GoalSelectionSchema);
    const context = await loadChildGoalContext(pb, selection.childId, user.household_id);
    const { readiness, baseline, plan } = buildGoalPreview(context, selection);
    return NextResponse.json({ success: true, readiness, baseline, plan });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się przygotować podglądu celu.");
  }
}
