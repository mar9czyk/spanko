import { NextResponse } from "next/server";
import { z } from "zod";
import { runGoalCoach } from "@/lib/goal-coach";
import { type CopyLocale, GOAL_TITLES, localize, METHOD_TITLES } from "@/lib/goal-copy";
import { goalMetricValue } from "@/lib/goals-engine/catalog";
import { buildDailyTasks, buildNightTip } from "@/lib/goals-engine/dailyTasks";
import { baselineMetricValue, evaluateProgress } from "@/lib/goals-engine/progress";
import { enforceDailyAiLimit } from "@/lib/server/aiLimit";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { ApiAuthError, authenticateRequest } from "@/lib/server/auth";
import { loadChildGoalContext } from "@/lib/server/goals";
import type { ChildGoalRecord, GoalDailyTaskRecord } from "@/lib/types/database";

const BodySchema = z.object({
  goalId: z.string().min(1),
  locale: z.enum(["pl", "en"]).default("pl"),
});

const DAYS_PER_MONTH = 30.4;
const MS_PER_DAY = 86_400_000;

function daysBetween(fromDate: string, toDate: string): number {
  return Math.round(
    (new Date(`${toDate}T12:00:00Z`).getTime() - new Date(`${fromDate}T12:00:00Z`).getTime()) /
      MS_PER_DAY,
  );
}

/**
 * POST /api/ai/goal-coach — codzienna ocena postępu celu (deterministyczna) + rady coacha AI.
 *
 * @description
 * Idempotentne w obrębie doby fizjologicznej: drugie wywołanie zwraca zapisany wynik bez
 * ponownej oceny i bez kosztu AI. Liczby i kroki pochodzą wyłącznie z Silnika Celów.
 *
 * @param {Request} request - Żądanie z goalId i językiem
 * @returns {Promise<NextResponse>} Cel oraz dzienny rekord zadań i porad
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { pb, user } = await authenticateRequest(request);
    const { goalId, locale } = await parseJsonBody(request, BodySchema);

    let goal: ChildGoalRecord;
    try {
      goal = await pb.collection("child_goals").getOne<ChildGoalRecord>(goalId);
    } catch {
      throw new ApiAuthError("Nie znaleziono celu.", 404);
    }
    if (goal.status !== "active") {
      throw new ApiAuthError("Cel nie jest aktywny.", 400);
    }

    const context = await loadChildGoalContext(pb, goal.child_id, user.household_id);
    const existing = await pb.collection("goal_daily_tasks").getList<GoalDailyTaskRecord>(1, 1, {
      filter: pb.filter("goal_id = {:goalId} && physiological_date = {:date}", {
        goalId,
        date: context.todayDate,
      }),
    });
    if (existing.items[0]) {
      return NextResponse.json({ success: true, goal, daily: existing.items[0], cached: true });
    }

    // Limit AI nie może blokować planu dnia — przy wyczerpaniu zwracamy tekst deterministyczny
    let aiAllowed = true;
    try {
      await enforceDailyAiLimit(pb, user.household_id);
    } catch (limitError) {
      if (limitError instanceof ApiAuthError && limitError.status === 429) aiAllowed = false;
      else throw limitError;
    }

    const sinceStart = context.days.filter((d) => d.date >= goal.started_on);
    const inStep = sinceStart.filter(
      (d) => d.date >= goal.step_started_on && d.hasData && !d.illness,
    );
    const decision = evaluateProgress({
      goal: goal.goal_type,
      baseline: goal.baseline_json,
      plan: goal.plan_json,
      stepIndex: goal.current_step,
      daysInStep: inStep.length,
      recentDays: sinceStart,
    });

    const stepChanged = decision.action === "advance" || decision.action === "step_back";
    const nextStep = decision.nextStepIndex;
    const patch: Record<string, unknown> = { last_evaluated_on: context.todayDate };
    if (stepChanged) {
      patch.current_step = nextStep;
      patch.step_started_on = context.todayDate;
    }
    if (decision.action === "achieved") {
      patch.status = "achieved";
      patch.achieved_at = new Date().toISOString();
    }

    const tasks = buildDailyTasks(goal.plan_json, nextStep);
    const nightTip = buildNightTip(goal.plan_json, nextStep);
    const lastMeasured = [...sinceStart].reverse().find((d) => d.hasData && !d.illness);

    const coach = await runGoalCoach(
      {
        goal: goal.goal_type,
        locale: locale as CopyLocale,
        ageMonths: Math.round(context.effectiveAgeDays / DAYS_PER_MONTH),
        dayNumber: daysBetween(goal.started_on, context.todayDate) + 1,
        totalDays: goal.plan_json.totalDays,
        decision,
        baselineValue: baselineMetricValue(goal.goal_type, goal.baseline_json),
        latestValue: lastMeasured ? goalMetricValue(goal.goal_type, lastMeasured) : null,
        tasks,
        nightTip,
        methodTitle: localize(METHOD_TITLES[goal.method], locale),
        goalTitle: localize(GOAL_TITLES[goal.goal_type], locale),
      },
      { childId: goal.child_id, householdId: user.household_id },
      { skipAi: !aiAllowed },
    );

    const [updatedGoal, daily] = await Promise.all([
      pb.collection("child_goals").update<ChildGoalRecord>(goalId, patch),
      pb.collection("goal_daily_tasks").create<GoalDailyTaskRecord>({
        goal_id: goalId,
        physiological_date: context.todayDate,
        tasks_json: tasks,
        done_json: [],
        night_tip_json: nightTip,
        progress_json: decision,
        coach_json: coach.message,
      }),
    ]);

    return NextResponse.json({ success: true, goal: updatedGoal, daily, cached: false });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się ocenić postępu celu.");
  }
}
