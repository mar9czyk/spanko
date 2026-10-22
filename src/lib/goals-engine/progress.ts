/**
 * Decyzja o progresji planu na podstawie metryk od startu celu.
 */

import { GOAL_TARGETS, goalMetricValue } from "./catalog";
import type { DailyGoalMetrics, GoalBaseline, GoalPlan, GoalType, ProgressDecision } from "./types";

// heurystyka Spanko (plan etap D): cel spełniony w ≥5 z ostatnich 7 zmierzonych nocy,
// co toleruje pojedyncze gorsze noce; ostateczne „osiągnięte” potwierdza rodzic.
const ACHIEVEMENT_WINDOW_DAYS = 7;
const ACHIEVEMENT_MIN_DAYS = 5;
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

export function baselineMetricValue(goal: GoalType, baseline: GoalBaseline): number | null {
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
 * `achieved` oznacza spełnienie kryterium danych; status celu zmienia dopiero rodzic.
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
  const metNights = series.slice(-ACHIEVEMENT_WINDOW_DAYS).filter((v) => v <= target).length;
  if (metNights >= ACHIEVEMENT_MIN_DAYS) return decide("achieved", "TARGET_REACHED");

  const step = plan.steps[stepIndex];
  if (!step) return decide("hold", "INSUFFICIENT_DATA");
  if (daysInStep < step.toDay - step.fromDay + 1) return decide("hold", "STEP_IN_PROGRESS");

  const window = series.slice(-REGRESSION_WINDOW_DAYS);
  if (window.length === 0) return decide("hold", "INSUFFICIENT_DATA");

  const base = baselineMetricValue(goal, baseline);
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

export interface GoalProgressPoint {
  readonly date: string;
  /** Wartość metryki celu; null, gdy doba bez pomiaru (brak danych lub choroba). */
  readonly value: number | null;
  readonly illness: boolean;
}

export interface GoalProgressSeries {
  readonly goal: GoalType;
  /** Punkt odniesienia sprzed startu celu; null, gdy nie dało się go policzyć. */
  readonly baseline: number | null;
  readonly target: number;
  readonly points: readonly GoalProgressPoint[];
}

/**
 * Zamienia dobowe metryki od startu celu na serię do wykresu „metryka vs baseline”.
 * Doby z chorobą lub bez danych dostają `value: null` (nie wchodzą do linii, jak w ocenie postępu).
 *
 * @param {GoalType} goal - Cel
 * @param {GoalBaseline} baseline - Baseline zapisany przy starcie celu
 * @param {readonly DailyGoalMetrics[]} days - Doby, rosnąco po dacie
 * @param {string} startedOn - Doba startu celu (YYYY-MM-DD); wcześniejsze doby są pomijane
 * @returns {GoalProgressSeries} Seria punktów z baseline i wartością docelową
 */
export function buildGoalProgressSeries(
  goal: GoalType,
  baseline: GoalBaseline,
  days: readonly DailyGoalMetrics[],
  startedOn: string,
): GoalProgressSeries {
  const points = days
    .filter((day) => day.date >= startedOn)
    .map((day) => ({
      date: day.date,
      value: day.hasData && !day.illness ? goalMetricValue(goal, day) : null,
      illness: day.illness,
    }));
  return {
    goal,
    baseline: baselineMetricValue(goal, baseline),
    target: GOAL_TARGETS[goal],
    points,
  };
}
