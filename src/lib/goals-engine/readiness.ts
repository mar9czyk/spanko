/**
 * Ocena gotowości do rozpoczęcia celu (wiek, dane, choroba, czerwone flagi).
 */

import { hasDayTag } from "../sleep-engine/dayTags";
import {
  GOAL_CATALOG,
  ILLNESS_TAGS,
  isSleepTrainingGoal,
  METHOD_CATALOG,
  MIN_BASELINE_DAYS,
  PUPD_WARNING_AGE_DAYS,
  TEETHING_TAG,
} from "./catalog";
import type {
  GoalBaseline,
  GoalMethod,
  GoalType,
  ReadinessBlocker,
  ReadinessResult,
  ReadinessWarning,
} from "./types";

const LOW_DATA_QUALITY_DAYS = 5;
const WAKINGS_PROBLEM_THRESHOLD = 1.5;
const NIGHT_FEEDS_PROBLEM_THRESHOLD = 0.5;
const ONSET_PROBLEM_LATENCY_MIN = 20;

export interface ReadinessInput {
  readonly goal: GoalType;
  readonly method: GoalMethod;
  /** Wiek korygowany w dniach. */
  readonly effectiveAgeDays: number;
  readonly baseline: GoalBaseline;
  /** Tagi bieżącej doby (np. gorączka). */
  readonly todayTags: readonly string[];
  /** Włączony tryb dnia „Choroba” (działa jak tag choroby). */
  readonly illnessModeActive?: boolean;
  /** Rodzic potwierdził listę czerwonych flag (brak sygnałów do pediatry). */
  readonly redFlagsAcknowledged: boolean;
}

function hasProblem(goal: GoalType, baseline: GoalBaseline): boolean {
  if (goal === "reduce_night_wakings") return baseline.avgNightWakings >= WAKINGS_PROBLEM_THRESHOLD;
  if (goal === "night_weaning") return baseline.avgNightFeedCount >= NIGHT_FEEDS_PROBLEM_THRESHOLD;
  return (
    (baseline.avgLatencyMin ?? 0) > ONSET_PROBLEM_LATENCY_MIN ||
    baseline.dominantRung !== "independent"
  );
}

/**
 * Sprawdza, czy można bezpiecznie rozpocząć plan celu.
 *
 * @param {ReadinessInput} input - Cel, metoda, wiek, dane bazowe i potwierdzenia
 * @returns {ReadinessResult} Czy gotowe, blokery i ostrzeżenia
 */
export function evaluateReadiness(input: ReadinessInput): ReadinessResult {
  const blockers: ReadinessBlocker[] = [];
  const warnings: ReadinessWarning[] = [];
  const goalDef = GOAL_CATALOG[input.goal];

  if (input.effectiveAgeDays < goalDef.minAgeDays) blockers.push("AGE_TOO_YOUNG");
  if (!goalDef.methods.includes(input.method)) {
    blockers.push("METHOD_NOT_SUPPORTED");
  } else if (input.effectiveAgeDays < METHOD_CATALOG[input.method].minAgeDays) {
    blockers.push("METHOD_AGE_TOO_YOUNG");
  }
  const hasEnoughData = input.baseline.dayCount >= MIN_BASELINE_DAYS;
  if (!hasEnoughData) blockers.push("INSUFFICIENT_DATA");
  if (input.illnessModeActive || ILLNESS_TAGS.some((key) => hasDayTag(input.todayTags, key))) {
    blockers.push("ILLNESS_ACTIVE");
  }
  // Nawyki snu nie ograniczają reakcji rodzica, więc nie wymagają listy flag ani „problemu”
  const isTraining = isSleepTrainingGoal(input.goal);
  if (isTraining && !input.redFlagsAcknowledged) blockers.push("RED_FLAGS_NOT_ACKNOWLEDGED");
  if (isTraining && hasEnoughData && !hasProblem(input.goal, input.baseline)) {
    blockers.push("NO_PROBLEM_TO_SOLVE");
  }

  if (hasDayTag(input.todayTags, TEETHING_TAG)) warnings.push("TEETHING_ACTIVE");
  if (input.method === "pick_up_put_down" && input.effectiveAgeDays > PUPD_WARNING_AGE_DAYS) {
    warnings.push("PUPD_OLDER_CHILD");
  }
  if (hasEnoughData && input.baseline.dayCount < LOW_DATA_QUALITY_DAYS) {
    warnings.push("LOW_DATA_QUALITY");
  }

  return { ready: blockers.length === 0, blockers, warnings };
}
