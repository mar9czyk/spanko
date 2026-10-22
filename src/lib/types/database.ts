import type {
  DailyTask,
  GoalBaseline,
  GoalMethod,
  GoalPlan,
  GoalStatus,
  GoalType,
  ProgressDecision,
} from "@/lib/goals-engine/types";
import type { TravelPlan } from "@/lib/sleep-engine/travel";
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

export type DayContextEventType = "feeding" | "diaper" | "tag";

export type DiaperKind = "wet" | "dirty" | "both";

export type BottleContent = "breast_milk" | "formula";

export type ParentFeedback = "accepted" | "rejected" | "adjusted" | "pending";

export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly avatar?: string;
  readonly is_admin: boolean;
  readonly is_blocked?: boolean;
  readonly last_seen_at?: string;
  readonly household_id?: string;
  readonly created: string;
  readonly updated: string;
}

export interface HouseholdRecord {
  readonly id: string;
  readonly name: string;
  readonly invite_code?: string;
  readonly invite_expires_at?: string;
  /** Nadpisanie dziennego limitu AI dla gospodarstwa (ustawia wyłącznie admin) */
  readonly ai_daily_limit_override?: number;
  /** Wyłączenie AI dla gospodarstwa (ustawia wyłącznie admin) */
  readonly ai_disabled?: boolean;
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
  /** Strefa IANA dziecka (granica doby fizjologicznej); domyślnie Europe/Warsaw */
  readonly timezone?: string;
  /** Plan podróży ze zmianą strefy (strategia przestawiania snu); brak = bez podróży */
  readonly travel_json?: TravelPlan | null;
  /** Nazwa pliku zdjęcia w PocketBase (chronione, URL wymaga tokenu plików); pusta, gdy brak */
  readonly photo?: string;
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
  /** Strefa IANA, w której zapisano sen (podróż); brak w starych rekordach */
  readonly timezone?: string;
  readonly created: string;
  readonly updated: string;
}

export interface DayContextRecord {
  readonly id: string;
  readonly child_id: string;
  readonly physiological_date: string;
  readonly timestamp: string;
  /** Brak w rekordach sprzed Fazy 7 — wtedy wnioskowane z `feeding_type`/`diaper_kind`. */
  readonly event_type?: DayContextEventType;
  readonly feeding_type: FeedingType;
  readonly bottle_ml?: number;
  readonly bottle_content?: BottleContent;
  readonly breast_side?: BreastSide;
  readonly breast_left_min?: number;
  readonly breast_right_min?: number;
  readonly diaper_kind?: DiaperKind;
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

export interface AppSecretRecord {
  readonly id: string;
  readonly name: string;
  /** Szyfrogram `v1:<iv>:<tag>:<dane>` — nigdy nie trafia do przeglądarki */
  readonly ciphertext: string;
  readonly key_suffix: string;
  readonly key_version: number;
  readonly updated_by?: string;
  readonly created: string;
  readonly updated: string;
}

export interface AdminSettingsRecord {
  readonly id: string;
  readonly openrouter_fast_model?: string;
  readonly openrouter_reasoning_model?: string;
  readonly system_prompt_insights?: string;
  readonly system_prompt_goal_coach?: string;
  /** Tablica przedziałów wiekowych lub `{ brackets: [...] }`; walidowana w resolveSleepMatrix */
  readonly sleep_matrix_override_json?: unknown;
  readonly ai_daily_limit_per_household?: number;
  /** Globalny wyłącznik AI (true = tylko silnik deterministyczny) */
  readonly ai_disabled?: boolean;
  readonly openrouter_fallback_model?: string;
  /** 0 / brak = domyślna */
  readonly ai_temperature?: number;
  /** 0 / brak = domyślny limit modelu */
  readonly ai_max_tokens?: number;
  /** 0 / brak = domyślny */
  readonly ai_timeout_ms?: number;
  readonly created: string;
  readonly updated: string;
}

export interface PromptVersionRecord {
  readonly id: string;
  readonly version: number;
  readonly system_prompt: string;
  readonly note?: string;
  readonly author_id?: string;
  readonly is_active: boolean;
  readonly created: string;
  readonly updated: string;
}

export type AiCallKind = "evaluate" | "sandbox" | "goal_coach";
export type AiCallStatus = "ok" | "error" | "invalid_json";

export interface AiCallRecord {
  readonly id: string;
  readonly child_id?: string;
  readonly household_id?: string;
  readonly kind: AiCallKind;
  readonly model?: string;
  readonly request_snapshot_json?: Record<string, unknown>;
  readonly response_json?: unknown;
  readonly status: AiCallStatus;
  readonly error_message?: string;
  readonly prompt_tokens?: number;
  readonly completion_tokens?: number;
  readonly latency_ms?: number;
  readonly insight_id?: string;
  readonly fallback_used?: boolean;
  readonly prompt_version?: number;
  /** Kategoria główna wniosku (np. CAT1_…) lub GOAL dla coacha */
  readonly category?: string;
  readonly created: string;
  readonly updated: string;
}

/** Pomiar trafności prognozy SweetSpot dla jednego snu (kolekcja `sleep_predictions`). */
export interface SleepPredictionRecord {
  readonly id: string;
  readonly child_id: string;
  /** Unikalny — jeden pomiar na sen. */
  readonly sleep_log_id: string;
  readonly type: SleepType;
  readonly physiological_date: string;
  readonly effective_age_days: number;
  readonly predicted_sweet_spot_at: string;
  readonly compass_start_at: string;
  readonly compass_end_at: string;
  readonly target_ww_min: number;
  readonly reason_code: string;
  readonly insight_ww_offset_min: number;
  readonly actual_put_down_at: string;
  readonly actual_fell_asleep_at: string;
  /** Odłożenie minus SweetSpot w minutach (dodatni = później niż prognoza). */
  readonly put_down_error_min: number;
  readonly fell_asleep_error_min: number;
  readonly latency_min: number;
  readonly duration_min: number;
  readonly within_compass: boolean;
  /** `replay` — odtworzone po fakcie z logów; `live` — zapis prognozy z pulpitu w chwili odłożenia. */
  readonly source: "replay" | "live";
  readonly created: string;
  readonly updated: string;
}

export interface ChildGoalRecord {
  readonly id: string;
  readonly child_id: string;
  readonly goal_type: GoalType;
  readonly method: GoalMethod;
  readonly status: GoalStatus;
  /** Doba fizjologiczna startu celu (YYYY-MM-DD) */
  readonly started_on: string;
  readonly step_started_on: string;
  readonly last_evaluated_on?: string;
  readonly current_step: number;
  readonly baseline_json: GoalBaseline;
  readonly plan_json: GoalPlan;
  readonly red_flags_ack_at?: string;
  readonly achieved_at?: string;
  readonly created: string;
  readonly updated: string;
}

export interface GoalCoachMessage {
  readonly headline: string;
  readonly todayAdvice: readonly string[];
  readonly nightTip: string;
  readonly encouragement: string;
  readonly why: string;
}

export interface GoalDailyTaskRecord {
  readonly id: string;
  readonly goal_id: string;
  readonly physiological_date: string;
  readonly tasks_json: readonly DailyTask[];
  readonly done_json?: readonly string[];
  readonly night_tip_json?: DailyTask | null;
  readonly progress_json?: ProgressDecision;
  readonly coach_json?: GoalCoachMessage;
  readonly created: string;
  readonly updated: string;
}

export interface AdminAuditLogRecord {
  readonly id: string;
  readonly actor_id?: string;
  readonly actor_email?: string;
  readonly action: string;
  readonly target_collection?: string;
  readonly target_id?: string;
  readonly before_json?: unknown;
  readonly after_json?: unknown;
  readonly created: string;
  readonly updated: string;
}
