/**
 * Generatory planów per cel × metoda. Czyste funkcje; kroki opisują „co robić”, a nie teksty UI.
 */

import { RUNG_ORDER } from "./catalog";
import type {
  ChairDistance,
  GoalBaseline,
  GoalMethod,
  GoalPlan,
  GoalType,
  InterventionRung,
  PlanStep,
  SleepHabit,
  StepParams,
} from "./types";

// heurystyka: 2 doby na szczebel, by łagodne wygaszanie mieściło się w 7–14 nocach
const LADDER_STEP_DAYS = 2;
const WEANING_STEP_DAYS = 2;
const CONSOLIDATE_DAYS = 3;
const DEFAULT_RUNG: InterventionRung = "carry";
const DEFAULT_FEED_ML = 120;
const MIN_FEED_ML = 30;
const MAX_FEED_ML = 240;
const MIN_REDUCED_ML = 10;
const WEANING_VOLUME_FRACTIONS = [0.75, 0.5, 0.25] as const;

/**
 * Odstępy sprawdzania (min) wg spec v2.0: doba 1: 3/5/10, doba 2: 5/10/12, doba 3: 10/12/15,
 * od doby 4: 12/15/17 bez dalszego wydłużania. Efekt zwykle po 4–7 nocach.
 */
export const FERBER_INTERVALS_MIN: readonly (readonly number[])[] = [
  [3, 5, 10],
  [5, 10, 12],
  [10, 12, 15],
  [12, 15, 17],
];
/** Ile dób trwa ostatni (stały) poziom odstępów — razem z dobami 1–3 daje 7 nocy. */
const FERBER_LAST_LEVEL_DAYS = 4;

const CHAIR_STAGES: readonly ChairDistance[] = ["bedside", "mid_room", "doorway", "outside"];
// Krzesło: 4 pozycje × 3 noce = 12 nocy (zakres 10–14); weź–odłóż: 14–21 nocy
const CHAIR_STAGE_DAYS = 3;
const PICK_UP_PUT_DOWN_DAYS = 14;
const EXTINCTION_DAYS = 3;

/**
 * Nawyki po kolei, 3 noce każdy + 2 noce utrwalenia = 14 nocy (heurystyka Spanko).
 * Kolejność: najpierw stała pobudka (kotwica rytmu), na końcu odkładanie sennego dziecka.
 */
const HABIT_SEQUENCE: readonly SleepHabit[] = [
  "WAKE_ANCHOR",
  "BEDTIME_ROUTINE",
  "SLEEP_ENVIRONMENT",
  "DROWSY_PUT_DOWN",
];
const HABIT_STEP_DAYS = 3;
const HABIT_CONSOLIDATE_DAYS = 2;

function appendStep(
  steps: PlanStep[],
  code: PlanStep["code"],
  days: number,
  params: StepParams,
): void {
  const last = steps[steps.length - 1];
  const fromDay = last ? last.toDay + 1 : 1;
  steps.push({ code, fromDay, toDay: fromDay + days - 1, params });
}

function finish(goal: GoalType, method: GoalMethod, steps: PlanStep[]): GoalPlan {
  const last = steps[steps.length - 1];
  return { goal, method, totalDays: last ? last.toDay : 0, steps };
}

function ladderSteps(baseline: GoalBaseline): PlanStep[] {
  const steps: PlanStep[] = [];
  const startIndex = RUNG_ORDER.indexOf(baseline.dominantRung ?? DEFAULT_RUNG);
  for (let i = startIndex + 1; i < RUNG_ORDER.length; i++) {
    appendStep(steps, "LADDER_RUNG", LADDER_STEP_DAYS, { rung: RUNG_ORDER[i] });
  }
  appendStep(steps, "CONSOLIDATE", CONSOLIDATE_DAYS, { rung: "independent" });
  return steps;
}

function ferberSteps(extra: StepParams): PlanStep[] {
  const steps: PlanStep[] = [];
  FERBER_INTERVALS_MIN.forEach((intervals, index) => {
    const isLast = index === FERBER_INTERVALS_MIN.length - 1;
    appendStep(steps, "FERBER_DAY", isLast ? FERBER_LAST_LEVEL_DAYS : 1, {
      ...extra,
      checkIntervalsMin: intervals,
    });
  });
  appendStep(steps, "CONSOLIDATE", CONSOLIDATE_DAYS, {
    ...extra,
    checkIntervalsMin: FERBER_INTERVALS_MIN[FERBER_INTERVALS_MIN.length - 1],
  });
  return steps;
}

function extinctionSteps(extra: StepParams): PlanStep[] {
  const steps: PlanStep[] = [];
  appendStep(steps, "EXTINCTION", EXTINCTION_DAYS, extra);
  appendStep(steps, "CONSOLIDATE", CONSOLIDATE_DAYS, extra);
  return steps;
}

function roundToTen(value: number): number {
  return Math.round(value / 10) * 10;
}

function weaningFadeSteps(baseline: GoalBaseline): PlanStep[] {
  const steps: PlanStep[] = [];
  const feeds = Math.max(1, Math.round(baseline.avgNightFeedCount));
  const perFeed =
    baseline.avgNightFeedCount > 0 && baseline.avgNightMilkMl > 0
      ? baseline.avgNightMilkMl / baseline.avgNightFeedCount
      : DEFAULT_FEED_ML;
  const ml0 = Math.min(MAX_FEED_ML, Math.max(MIN_FEED_ML, roundToTen(perFeed)));
  let lastMl = ml0;
  for (const fraction of WEANING_VOLUME_FRACTIONS) {
    lastMl = Math.max(MIN_REDUCED_ML, roundToTen(ml0 * fraction));
    appendStep(steps, "WEAN_REDUCE_VOLUME", WEANING_STEP_DAYS, {
      nightFeedsAllowed: feeds,
      mlPerFeed: lastMl,
    });
  }
  for (let allowed = feeds - 1; allowed >= 0; allowed--) {
    appendStep(steps, "WEAN_DROP_FEED", WEANING_STEP_DAYS, {
      nightFeedsAllowed: allowed,
      mlPerFeed: lastMl,
    });
  }
  appendStep(steps, "CONSOLIDATE", CONSOLIDATE_DAYS, { nightFeedsAllowed: 0 });
  return steps;
}

function chairSteps(): PlanStep[] {
  const steps: PlanStep[] = [];
  for (const distance of CHAIR_STAGES) {
    appendStep(steps, "CHAIR_STAGE", CHAIR_STAGE_DAYS, { chairDistance: distance });
  }
  appendStep(steps, "CONSOLIDATE", CONSOLIDATE_DAYS, { chairDistance: "outside" });
  return steps;
}

function habitSteps(): PlanStep[] {
  const steps: PlanStep[] = [];
  for (const habit of HABIT_SEQUENCE) {
    appendStep(steps, "HABIT", HABIT_STEP_DAYS, { habit });
  }
  appendStep(steps, "CONSOLIDATE", HABIT_CONSOLIDATE_DAYS, {});
  return steps;
}

/**
 * Generuje plan dla pary cel × metoda na podstawie punktu odniesienia dziecka.
 *
 * @param {object} input - Cel, metoda i baseline
 * @returns {GoalPlan} Plan krok po kroku
 */
export function generatePlan(input: {
  readonly goal: GoalType;
  readonly method: GoalMethod;
  readonly baseline: GoalBaseline;
}): GoalPlan {
  const { goal, method, baseline } = input;
  const extra: StepParams = goal === "night_weaning" ? { nightFeedsAllowed: 0 } : {};

  if (method === "gentle_fading") {
    return finish(
      goal,
      method,
      goal === "night_weaning" ? weaningFadeSteps(baseline) : ladderSteps(baseline),
    );
  }
  if (method === "check_and_console") return finish(goal, method, ferberSteps(extra));
  if (method === "extinction") return finish(goal, method, extinctionSteps(extra));
  if (method === "chair_method") return finish(goal, method, chairSteps());
  if (method === "habit_building") return finish(goal, method, habitSteps());

  const steps: PlanStep[] = [];
  appendStep(steps, "PICK_UP_PUT_DOWN", PICK_UP_PUT_DOWN_DAYS, {});
  appendStep(steps, "CONSOLIDATE", CONSOLIDATE_DAYS, {});
  return finish(goal, method, steps);
}

/**
 * Zwraca indeks kroku obowiązującego w danej dobie planu (1-based); ostatni krok po końcu planu.
 *
 * @param {GoalPlan} plan - Plan
 * @param {number} dayNumber - Numer doby planu
 * @returns {number} Indeks kroku
 */
export function stepIndexForDay(plan: GoalPlan, dayNumber: number): number {
  const index = plan.steps.findIndex((s) => dayNumber >= s.fromDay && dayNumber <= s.toDay);
  return index === -1 ? plan.steps.length - 1 : index;
}
