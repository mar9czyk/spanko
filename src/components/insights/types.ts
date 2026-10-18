import type { ChildInsightRecord } from "@/lib/types/database";

export interface CategoryPresentationConfig {
  readonly label: string;
  readonly badgeStyle: string;
}

export interface InsightCorrectionFormValues {
  readonly feedback: "accepted" | "rejected" | "adjusted";
  readonly parentCorrectionNote: string;
  readonly isAnomalyException: boolean;
  readonly wakeWindowOffsetMinutes: number;
}

export interface InsightsPageData {
  readonly activeInsights: readonly ChildInsightRecord[];
  readonly hypothesisInsights: readonly ChildInsightRecord[];
  readonly historyTimelineInsights: readonly ChildInsightRecord[];
}
