import type {
  AgeBracketConfig,
  DayMode,
  InsightStatus,
  InterventionType,
  NightWakingEntry,
  ProblemCategory,
  SleepLog,
  SleepMood,
  SleepStatus,
  SleepType,
} from "@/lib/sleep-engine/types";

export type {
  AgeBracketConfig,
  DayMode,
  InsightStatus,
  InterventionType,
  NightWakingEntry,
  ProblemCategory,
  SleepLog,
  SleepMood,
  SleepStatus,
  SleepType,
};

export type ActiveDayMode = DayMode;
export type InterventionLevel = InterventionType;
export type NightWakingDetail = NightWakingEntry;

export type FeedingType = "breast" | "bottle" | "solid" | "none";

export type BreastSide = "left" | "right" | "both" | "none";

export type ParentFeedback = "accepted" | "rejected" | "adjusted" | "pending";

export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly avatar?: string;
  readonly is_admin: boolean;
  readonly household_id?: string;
  readonly created: string;
  readonly updated: string;
}

export interface HouseholdRecord {
  readonly id: string;
  readonly name: string;
  readonly invite_code?: string;
  readonly invite_expires_at?: string;
  readonly created: string;
  readonly updated: string;
}

export interface ChildRecord {
  readonly id: string;
  readonly household_id: string;
  readonly name: string;
  readonly birth_date: string;
  readonly due_date?: string;
  readonly active_day_mode: ActiveDayMode;
  readonly anti_orthosomnia_mode: boolean;
  readonly created: string;
  readonly updated: string;
}

export interface SleepLogRecord {
  readonly id: string;
  readonly child_id: string;
  readonly physiological_date: string;
  readonly type: SleepType;
  readonly status: SleepStatus;
  readonly put_down_at?: string;
  readonly fell_asleep_at?: string;
  readonly woke_up_at?: string;
  readonly interventions?: readonly InterventionLevel[];
  readonly mood?: SleepMood;
  readonly night_wakings?: readonly NightWakingDetail[];
  readonly is_rebound_sleep: boolean;
  readonly ignore_in_calibration: boolean;
  readonly created: string;
  readonly updated: string;
}

export interface DayContextRecord {
  readonly id: string;
  readonly child_id: string;
  readonly physiological_date: string;
  readonly timestamp: string;
  readonly feeding_type: FeedingType;
  readonly bottle_ml?: number;
  readonly breast_side?: BreastSide;
  readonly tags?: readonly string[];
  readonly notes?: string;
  readonly created: string;
  readonly updated: string;
}

export interface ChildInsightRecord {
  readonly id: string;
  readonly child_id: string;
  readonly category: string;
  readonly diagnosis_code: string;
  readonly status: InsightStatus;
  readonly title: string;
  readonly explanation: string;
  readonly algorithm_override_json?: Record<string, unknown>;
  readonly confidence_score?: number;
  readonly parent_feedback?: ParentFeedback;
  readonly parent_correction_note?: string;
  readonly previous_insight_id?: string;
  readonly superseded_by_id?: string;
  readonly valid_from?: string;
  readonly valid_until?: string;
  readonly created: string;
  readonly updated: string;
}

export interface AdminSettingsRecord {
  readonly id: string;
  readonly openrouter_fast_model?: string;
  readonly openrouter_reasoning_model?: string;
  readonly system_prompt_insights?: string;
  readonly sleep_matrix_override_json?: Record<string, unknown>;
  readonly ai_daily_limit_per_household?: number;
  readonly created: string;
  readonly updated: string;
}
