/**
 * Decyzja o progresji planu na podstawie metryk od startu celu.
 */

import { GOAL_TARGETS, goalMetricValue } from "./catalog";
import type { DailyGoalMetrics, GoalBaseline, GoalPlan, GoalType, ProgressDecision } from "./types";

const ACHIEVEMENT_STREAK_DAYS = 3;
const REGRESSION_WINDOW_DAYS = 2;
const REGRESSION_FACTOR = 1.3;

export interface ProgressInput {
  readonly goal: GoalType;
  readonly baseline: GoalBaseline;
  readonly plan: GoalPlan;
  readonly stepIndex: number;
  /** Ile dób minęło w bieżącym kroku (łącznie z ostatnio zakończoną). */
  readonly daysInStep: number;
  /** Doby od startu celu, rosnąco po dacie. */
  readonly recentDays: readonly DailyGoalMetrics[];
}

function baselineValue(goal: GoalType, baseline: GoalBaseline): number | null {
  if (goal === "reduce_night_wakings") return baseline.avgNightWakings;
  if (goal === "night_weaning") return baseline.avgNightFeedCount;
  return baseline.avgLatencyMin;
}

function metricSeries(goal: GoalType, days: readonly DailyGoalMetrics[]): number[] {
  return days
    .filter((d) => d.hasData && !d.illness)
    .map((d) => goalMetricValue(goal, d))
    .filter((v): v is number => v !== null);
}

/**
 * Decyduje: advance / hold / step_back / pause / achieved.
 *
 * @param {ProgressInput} input - Stan celu i dotychczasowe metryki
 * @returns {ProgressDecision} Decyzja i kod powodu
 */
export function evaluateProgress(input: ProgressInput): ProgressDecision {
  const { goal, baseline, plan, stepIndex, daysInStep, recentDays } = input;
  const decide = (
    action: ProgressDecision["action"],
    reason: ProgressDecision["reason"],
    nextStepIndex = stepIndex,
  ): ProgressDecision => ({ action, reason, nextStepIndex });

  const lastDay = recentDays[recentDays.length - 1];
  if (lastDay?.illness) return decide("pause", "ILLNESS_PAUSE");

  const series = metricSeries(goal, recentDays);
  const target = GOAL_TARGETS[goal];
  const streak = series.slice(-ACHIEVEMENT_STREAK_DAYS);
  if (streak.length === ACHIEVEMENT_STREAK_DAYS && streak.every((v) => v <= target)) {
    return decide("achieved", "TARGET_REACHED");
  }

  const step = plan.steps[stepIndex];
  if (!step) return decide("hold", "INSUFFICIENT_DATA");
  if (daysInStep < step.toDay - step.fromDay + 1) return decide("hold", "STEP_IN_PROGRESS");

  const window = series.slice(-REGRESSION_WINDOW_DAYS);
  if (window.length === 0) return decide("hold", "INSUFFICIENT_DATA");

  const base = baselineValue(goal, baseline);
  const avg = window.reduce((a, b) => a + b, 0) / window.length;
  if (base !== null && base > 0 && avg > base * REGRESSION_FACTOR) {
    return stepIndex > 0
      ? decide("step_back", "REGRESSION_DETECTED", stepIndex - 1)
      : decide("hold", "REGRESSION_DETECTED");
  }
  const isLastStep = stepIndex >= plan.steps.length - 1;
  return isLastStep
    ? decide("hold", "CONSOLIDATING")
    : decide("advance", "STEP_COMPLETED", stepIndex + 1);
}
