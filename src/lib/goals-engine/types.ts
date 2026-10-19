/**
 * Typy domenowe Silnika Celów (Goals Engine) — czysty TypeScript, bez I/O i bez LLM.
 */

import type { InterventionType } from "../sleep-engine/types";

export type GoalType = "reduce_night_wakings" | "night_weaning" | "independent_sleep_onset";

export type GoalMethod =
  | "gentle_fading"
  | "chair_method"
  | "pick_up_put_down"
  | "check_and_console"
  | "extinction";

export type GoalStatus = "readiness_check" | "active" | "paused" | "achieved" | "abandoned";

/** Szczebel „drabiny interwencji” — od najbardziej do najmniej angażującego rodzica. */
export type InterventionRung = "feed" | "carry" | "pat" | "shush" | "presence" | "independent";

export type ChairDistance = "bedside" | "mid_room" | "doorway" | "outside";

/** Metryki jednej doby fizjologicznej istotne dla celów. */
export interface DailyGoalMetrics {
  readonly date: string;
  readonly hasData: boolean;
  readonly nightWakings: number;
  readonly nightFeedCount: number;
  readonly nightMilkMl: number;
  /** Minuty od odłożenia do zaśnięcia (sen nocny); null, gdy brak danych. */
  readonly sleepOnsetLatencyMin: number | null;
  readonly independentOnset: boolean | null;
  readonly dominantIntervention: InterventionType | null;
  /** Choroba, gorączka, szczepienie — doba wyłączona z oceny postępu. */
  readonly illness: boolean;
}

export interface GoalBaseline {
  readonly dayCount: number;
  readonly avgNightWakings: number;
  readonly avgNightFeedCount: number;
  readonly avgNightMilkMl: number;
  readonly avgLatencyMin: number | null;
  readonly dominantRung: InterventionRung | null;
}

export type ReadinessBlocker =
  | "AGE_TOO_YOUNG"
  | "METHOD_AGE_TOO_YOUNG"
  | "METHOD_NOT_SUPPORTED"
  | "INSUFFICIENT_DATA"
  | "ILLNESS_ACTIVE"
  | "RED_FLAGS_NOT_ACKNOWLEDGED"
  | "NO_PROBLEM_TO_SOLVE";

export type ReadinessWarning = "TEETHING_ACTIVE" | "LOW_DATA_QUALITY";

export interface ReadinessResult {
  readonly ready: boolean;
  readonly blockers: readonly ReadinessBlocker[];
  readonly warnings: readonly ReadinessWarning[];
}

export type PlanStepCode =
  | "LADDER_RUNG"
  | "FERBER_DAY"
  | "EXTINCTION"
  | "CHAIR_STAGE"
  | "PICK_UP_PUT_DOWN"
  | "WEAN_REDUCE_VOLUME"
  | "WEAN_DROP_FEED"
  | "CONSOLIDATE";

export interface StepParams {
  readonly rung?: InterventionRung;
  readonly checkIntervalsMin?: readonly number[];
  readonly chairDistance?: ChairDistance;
  readonly nightFeedsAllowed?: number;
  readonly mlPerFeed?: number;
}

export interface PlanStep {
  readonly code: PlanStepCode;
  /** Numer doby planu (1-based), od której krok obowiązuje. */
  readonly fromDay: number;
  readonly toDay: number;
  readonly params: StepParams;
}

export interface GoalPlan {
  readonly goal: GoalType;
  readonly method: GoalMethod;
  readonly totalDays: number;
  readonly steps: readonly PlanStep[];
}

export type ProgressAction = "advance" | "hold" | "step_back" | "pause" | "achieved";

export type ProgressReason =
  | "ILLNESS_PAUSE"
  | "TARGET_REACHED"
  | "STEP_IN_PROGRESS"
  | "STEP_COMPLETED"
  | "REGRESSION_DETECTED"
  | "CONSOLIDATING"
  | "INSUFFICIENT_DATA";

export interface ProgressDecision {
  readonly action: ProgressAction;
  readonly reason: ProgressReason;
  readonly nextStepIndex: number;
}

export type DailyTaskKind =
  | "NIGHT_FEED_LIMIT"
  | "CHECK_INTERVALS"
  | "RESPONSE_RUNG"
  | "CHAIR_DISTANCE"
  | "PICK_UP_PUT_DOWN"
  | "NO_RESPONSE"
  | "BEDTIME_ROUTINE";

export interface DailyTask {
  readonly kind: DailyTaskKind;
  readonly params: StepParams;
}
