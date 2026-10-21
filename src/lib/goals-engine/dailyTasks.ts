/**
 * Zadania „na dziś” oraz wskazówka nocna wynikające z bieżącego kroku planu.
 */

import { isSleepTrainingGoal } from "./catalog";
import type { DailyTask, GoalPlan, PlanStep } from "./types";

function consolidateTask(step: PlanStep): DailyTask | null {
  if (step.params.checkIntervalsMin) {
    return {
      kind: "CHECK_INTERVALS",
      params: { checkIntervalsMin: step.params.checkIntervalsMin },
    };
  }
  if (step.params.nightFeedsAllowed !== undefined) {
    return {
      kind: "NIGHT_FEED_LIMIT",
      params: { nightFeedsAllowed: step.params.nightFeedsAllowed },
    };
  }
  if (step.params.rung) return { kind: "RESPONSE_RUNG", params: { rung: step.params.rung } };
  if (step.params.chairDistance) {
    return { kind: "CHAIR_DISTANCE", params: { chairDistance: step.params.chairDistance } };
  }
  return null;
}

function taskForStep(step: PlanStep): DailyTask | null {
  switch (step.code) {
    case "LADDER_RUNG":
      return { kind: "RESPONSE_RUNG", params: { rung: step.params.rung } };
    case "FERBER_DAY":
      return {
        kind: "CHECK_INTERVALS",
        params: { checkIntervalsMin: step.params.checkIntervalsMin },
      };
    case "EXTINCTION":
      return { kind: "NO_RESPONSE", params: {} };
    case "CHAIR_STAGE":
      return { kind: "CHAIR_DISTANCE", params: { chairDistance: step.params.chairDistance } };
    case "PICK_UP_PUT_DOWN":
      return { kind: "PICK_UP_PUT_DOWN", params: {} };
    case "WEAN_REDUCE_VOLUME":
    case "WEAN_DROP_FEED":
      return {
        kind: "NIGHT_FEED_LIMIT",
        params: {
          nightFeedsAllowed: step.params.nightFeedsAllowed,
          mlPerFeed: step.params.mlPerFeed,
        },
      };
    case "HABIT":
      return { kind: "SLEEP_HABIT", params: { habit: step.params.habit } };
    case "CONSOLIDATE":
      return consolidateTask(step);
    default:
      return null;
  }
}

/**
 * Buduje 1–2 zadania na dziś dla kroku planu.
 *
 * @param {GoalPlan} plan - Plan
 * @param {number} stepIndex - Indeks bieżącego kroku
 * @returns {readonly DailyTask[]} Zadania dnia
 */
export function buildDailyTasks(plan: GoalPlan, stepIndex: number): readonly DailyTask[] {
  const step = plan.steps[stepIndex];
  if (!step) return [];
  const tasks: DailyTask[] = [];
  const main = taskForStep(step);
  if (main) tasks.push(main);
  // Nawyki snu mają rutynę jako własny krok; odstawianie mleka jej nie dotyczy
  if (plan.goal !== "night_weaning" && isSleepTrainingGoal(plan.goal)) {
    tasks.push({ kind: "BEDTIME_ROUTINE", params: {} });
  }
  return tasks;
}

/**
 * Wskazówka nocna: co zrobić przy pobudce w bieżącym kroku (null, gdy brak).
 *
 * @param {GoalPlan} plan - Plan
 * @param {number} stepIndex - Indeks bieżącego kroku
 * @returns {DailyTask | null} Wskazówka nocna
 */
export function buildNightTip(plan: GoalPlan, stepIndex: number): DailyTask | null {
  const step = plan.steps[stepIndex];
  return step ? taskForStep(step) : null;
}
