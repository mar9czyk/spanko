import { NextResponse } from "next/server";
import { buildGoalProgressSeries } from "@/lib/goals-engine/progress";
import { toErrorResponse } from "@/lib/server/apiResponse";
import { ApiAuthError, authenticateRequest } from "@/lib/server/auth";
import { loadChildGoalContext } from "@/lib/server/goals";
import type { ChildGoalRecord } from "@/lib/types/database";

const HISTORY_GOALS_LIMIT = 10;
const MIN_HISTORY_DAYS = 21;
const MAX_HISTORY_DAYS = 90;
const MS_PER_DAY = 86_400_000;
const DATE_LENGTH = 10;

/**
 * GET /api/goals/progress?childId=… — seria „metryka vs baseline” bieżącego (lub ostatniego) celu
 * oraz historia celów dziecka, do sekcji „Postęp celu” w /insights.
 *
 * @param {Request} request - Żądanie z `childId` w query
 * @returns {Promise<NextResponse>} Seria wykresu i lista celów (najnowsze pierwsze)
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { pb, user } = await authenticateRequest(request);
    const childId = new URL(request.url).searchParams.get("childId");
    if (!childId) throw new ApiAuthError("Brak childId.", 400);

    const goals = await pb
      .collection("child_goals")
      .getList<ChildGoalRecord>(1, HISTORY_GOALS_LIMIT, {
        filter: pb.filter("child_id = {:childId}", { childId }),
        sort: "-created",
      });
    const featured =
      goals.items.find((g) => g.status === "active" || g.status === "paused") ?? goals.items[0];
    if (!featured) {
      return NextResponse.json({ success: true, goals: [], featured: null, series: null });
    }

    const daysSinceStart = Math.ceil(
      (Date.now() - new Date(`${featured.started_on}T12:00:00Z`).getTime()) / MS_PER_DAY,
    );
    const historyDays = Math.min(MAX_HISTORY_DAYS, Math.max(MIN_HISTORY_DAYS, daysSinceStart + 1));
    const context = await loadChildGoalContext(pb, childId, user.household_id, historyDays);
    const isOpen = featured.status === "active" || featured.status === "paused";
    // Zakończony cel kończy się w dobie ostatniej zmiany statusu
    const endedOn =
      featured.achieved_at?.slice(0, DATE_LENGTH) ?? featured.updated.slice(0, DATE_LENGTH);
    const series = buildGoalProgressSeries(
      featured.goal_type,
      featured.baseline_json,
      context.days.filter((day) => isOpen || day.date <= endedOn),
      featured.started_on,
    );
    return NextResponse.json({ success: true, goals: goals.items, featured, series });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać postępu celu.");
  }
}
