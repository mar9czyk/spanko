import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { ApiAuthError, authenticateRequest } from "@/lib/server/auth";
import type { ChildGoalRecord } from "@/lib/types/database";

const StatusBodySchema = z.object({
  goalId: z.string().min(1),
  status: z.enum(["active", "paused", "abandoned"]),
});

const ALLOWED_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  active: ["paused", "abandoned"],
  paused: ["active", "abandoned"],
};

/**
 * POST /api/goals/status — wstrzymanie, wznowienie lub porzucenie celu.
 *
 * @param {Request} request - Żądanie z goalId i nowym statusem
 * @returns {Promise<NextResponse>} Zaktualizowany cel
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { pb } = await authenticateRequest(request);
    const { goalId, status } = await parseJsonBody(request, StatusBodySchema);

    let goal: ChildGoalRecord;
    try {
      goal = await pb.collection("child_goals").getOne<ChildGoalRecord>(goalId);
    } catch {
      throw new ApiAuthError("Nie znaleziono celu.", 404);
    }
    if (!ALLOWED_TRANSITIONS[goal.status]?.includes(status)) {
      throw new ApiAuthError(`Nie można zmienić statusu ${goal.status} na ${status}.`, 400);
    }
    const updated = await pb.collection("child_goals").update<ChildGoalRecord>(goalId, { status });
    return NextResponse.json({ success: true, goal: updated });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się zmienić statusu celu.");
  }
}
