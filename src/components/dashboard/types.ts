import type {
  BreastSide,
  ChildInsightRecord,
  ChildRecord,
  DiaperKind,
  FeedingType,
  InterventionLevel,
  NightWakingDetail,
  SleepLogRecord,
  SleepMood,
  SleepStatus,
  SleepType,
} from "@/lib/types/database";

export interface TimelineNapEvent {
  readonly id: string;
  readonly kind: "nap";
  readonly type: SleepType;
  readonly status: SleepStatus;
  readonly startTime: string;
  readonly endTime?: string;
  readonly startIso?: string;
  /** Pole logu, które wyznacza start (zaśnięcie albo samo odłożenie). */
  readonly startField?: "fell_asleep_at" | "put_down_at";
  readonly putDownIso?: string;
  /** Ile minut trwało usypianie (odłożenie → zaśnięcie); brak, gdy nie zapisano obu momentów. */
  readonly fallAsleepMinutes?: number;
  readonly endIso?: string;
  readonly durationMinutes?: number;
  readonly mood?: SleepMood;
  readonly interventions?: readonly InterventionLevel[];
  /** Momenty pobudek nocnych zapisanych w tym śnie. */
  readonly nightWakingIsos?: readonly string[];
  /** Pełne wpisy pobudek nocnych (edycja zachowuje ich pozostałe pola). */
  readonly nightWakings?: readonly NightWakingDetail[];
}

export interface TimelineFeedingEvent {
  readonly id: string;
  readonly kind: "feeding";
  readonly time: string;
  readonly timeIso?: string;
  readonly feedingType: FeedingType;
  readonly breastSide?: BreastSide;
  readonly bottleMl?: number;
  readonly breastMinutes?: number;
  readonly notes?: string;
}

export interface TimelineDiaperEvent {
  readonly id: string;
  readonly kind: "diaper";
  readonly time: string;
  readonly timeIso?: string;
  readonly diaperKind: DiaperKind;
}

export interface TimelineTagEvent {
  readonly id: string;
  readonly kind: "tag";
  readonly time: string;
  readonly timeIso?: string;
  readonly tags: readonly string[];
  readonly notes?: string;
}

export type TimelineEvent =
  | TimelineNapEvent
  | TimelineFeedingEvent
  | TimelineDiaperEvent
  | TimelineTagEvent;

export interface DashboardState {
  readonly child: ChildRecord;
  readonly activeInsight: ChildInsightRecord | null;
  readonly currentSleepLog: SleepLogRecord | null;
  readonly timelineEvents: readonly TimelineEvent[];
  readonly sleepBatteryPercent: number;
  readonly sleepNeedsProfile: "low_sleep_needs" | "average" | "high_sleep_needs";
  readonly latestLastNapEndAt: string;
  readonly sweetSpotIso: string;
  readonly compassWindowStartIso: string;
  readonly compassWindowEndIso: string;
  readonly reasonDescription: string;
  readonly pendingMorningWakingReview: readonly string[];
}
