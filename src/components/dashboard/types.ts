import type {
  BreastSide,
  ChildInsightRecord,
  ChildRecord,
  DiaperKind,
  FeedingType,
  InterventionLevel,
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
  readonly durationMinutes?: number;
  readonly mood?: SleepMood;
  readonly interventions?: readonly InterventionLevel[];
}

export interface TimelineFeedingEvent {
  readonly id: string;
  readonly kind: "feeding";
  readonly time: string;
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
  readonly diaperKind: DiaperKind;
}

export interface TimelineTagEvent {
  readonly id: string;
  readonly kind: "tag";
  readonly time: string;
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
