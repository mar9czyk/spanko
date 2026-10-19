import { NextResponse } from "next/server";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { ApiAuthError, authenticateRequest } from "@/lib/server/auth";
import { buildGoalPreview, GoalSelectionSchema, loadChildGoalContext } from "@/lib/server/goals";
import type { ChildGoalRecord } from "@/lib/types/database";

/**
 * POST /api/goals — tworzy aktywny cel, jeśli dziecko jest gotowe (walidacja po stronie serwera).
 *
 * @param {Request} request - Żądanie z wyborem celu, metody i potwierdzeniem czerwonych flag
 * @returns {Promise<NextResponse>} Utworzony cel lub 400 z listą blokerów
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { pb, user } = await authenticateRequest(request);
    const selection = await parseJsonBody(request, GoalSelectionSchema);
    const context = await loadChildGoalContext(pb, selection.childId, user.household_id);

    const existing = await pb.collection("child_goals").getList<ChildGoalRecord>(1, 1, {
      filter: pb.filter("child_id = {:childId} && (status = 'active' || status = 'paused')", {
        childId: selection.childId,
      }),
    });
    if (existing.totalItems > 0) {
      throw new ApiAuthError(
        "Dziecko ma już aktywny cel. Zakończ go, zanim zaczniesz kolejny.",
        400,
      );
    }

    const { readiness, baseline, plan } = buildGoalPreview(context, selection);
    if (!readiness.ready) {
      return NextResponse.json({ success: false, error: "NOT_READY", readiness }, { status: 400 });
    }

    const goal = await pb.collection("child_goals").create<ChildGoalRecord>({
      child_id: selection.childId,
      goal_type: selection.goal,
      method: selection.method,
      status: "active",
      started_on: context.todayDate,
      step_started_on: context.todayDate,
      current_step: 0,
      baseline_json: baseline,
      plan_json: plan,
      red_flags_ack_at: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, goal, readiness });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się utworzyć celu.");
  }
}
