/**
 * Katalog celów i metod: wymagania wiekowe, dozwolone metody, cele sukcesu.
 *
 * Wiek zawsze w dniach WIEKU KORYGOWANEGO (calculateEffectiveAgeDays).
 */

import { ILLNESS_DAY_TAGS } from "../sleep-engine/dayModes";
import type { InterventionType } from "../sleep-engine/types";
import type { DailyGoalMetrics, GoalMethod, GoalType, InterventionRung } from "./types";

export interface GoalDefinition {
  readonly type: GoalType;
  readonly minAgeDays: number;
  readonly methods: readonly GoalMethod[];
}

export interface MethodDefinition {
  readonly method: GoalMethod;
  readonly minAgeDays: number;
  /** Metody stanowcze (z ograniczonym wsparciem rodzica) — wymagają starszego dziecka. */
  readonly isFirm: boolean;
}

export const MIN_BASELINE_DAYS = 3;
export const BASELINE_WINDOW_DAYS = 7;

export const GOAL_CATALOG: Readonly<Record<GoalType, GoalDefinition>> = {
  reduce_night_wakings: {
    type: "reduce_night_wakings",
    minAgeDays: 120,
    methods: ["gentle_fading", "check_and_console", "extinction"],
  },
  night_weaning: {
    type: "night_weaning",
    minAgeDays: 180,
    methods: ["gentle_fading", "check_and_console", "extinction"],
  },
  independent_sleep_onset: {
    type: "independent_sleep_onset",
    minAgeDays: 120,
    methods: [
      "gentle_fading",
      "chair_method",
      "pick_up_put_down",
      "check_and_console",
      "extinction",
    ],
  },
  // Bez treningu snu — dostępny od urodzenia, nie wymaga „problemu do rozwiązania”
  healthy_sleep_habits: {
    type: "healthy_sleep_habits",
    minAgeDays: 0,
    methods: ["habit_building"],
  },
};

/** Cele, które są treningiem snu (czerwone flagi, ABM, wymóg problemu do rozwiązania). */
export function isSleepTrainingGoal(goal: GoalType): boolean {
  return goal !== "healthy_sleep_habits";
}

export const METHOD_CATALOG: Readonly<Record<GoalMethod, MethodDefinition>> = {
  gentle_fading: { method: "gentle_fading", minAgeDays: 120, isFirm: false },
  chair_method: { method: "chair_method", minAgeDays: 120, isFirm: false },
  pick_up_put_down: { method: "pick_up_put_down", minAgeDays: 120, isFirm: false },
  check_and_console: { method: "check_and_console", minAgeDays: 180, isFirm: true },
  extinction: { method: "extinction", minAgeDays: 180, isFirm: true },
  habit_building: { method: "habit_building", minAgeDays: 0, isFirm: false },
};

/**
 * Weź–odłóż po 6. mies. często bardziej pobudza niż uspokaja (opinia ekspercka, m.in. Baboo):
 * ostrzeżenie, nie blokada (decyzja planu etap D).
 */
export const PUPD_WARNING_AGE_DAYS = 180;

/** Te same tagi choroby co w silniku snu, żeby cel i drzewa nie rozjeżdżały się. */
export const ILLNESS_TAGS: readonly string[] = ILLNESS_DAY_TAGS;
export const TEETHING_TAG = "ząbkowanie";

export const RUNG_ORDER: readonly InterventionRung[] = [
  "feed",
  "carry",
  "pat",
  "shush",
  "presence",
  "independent",
];

const RUNG_BY_INTERVENTION: Readonly<Record<InterventionType, InterventionRung>> = {
  breast: "feed",
  bottle: "feed",
  bouncing: "carry",
  carrying: "carry",
  stroller_car: "carry",
  co_sleeping: "carry",
  patting: "pat",
  pacifier_reinsert: "pat",
  shushing_voice: "shush",
  room_presence: "presence",
  independent: "independent",
};

/**
 * Mapuje interwencję usypiania na szczebel drabiny.
 *
 * @param {InterventionType} intervention - Interwencja z logu snu
 * @returns {InterventionRung} Szczebel drabiny
 */
export function rungForIntervention(intervention: InterventionType): InterventionRung {
  return RUNG_BY_INTERVENTION[intervention];
}

/** Cel sukcesu per cel: mniejsza wartość = lepiej. */
export const GOAL_TARGETS: Readonly<Record<GoalType, number>> = {
  reduce_night_wakings: 1,
  night_weaning: 0,
  independent_sleep_onset: 20,
  healthy_sleep_habits: 20,
};

/**
 * Wartość metryki celu dla doby (mniejsza = lepiej); null, gdy brak danych do oceny.
 *
 * @param {GoalType} goal - Cel
 * @param {DailyGoalMetrics} day - Metryki doby
 * @returns {number | null} Wartość metryki
 */
export function goalMetricValue(goal: GoalType, day: DailyGoalMetrics): number | null {
  if (goal === "reduce_night_wakings") return day.nightWakings;
  if (goal === "night_weaning") return day.nightFeedCount;
  return day.sleepOnsetLatencyMin;
}
