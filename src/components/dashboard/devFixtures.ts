import type { ChildInsightRecord, ChildRecord } from "@/lib/types/database";
import type { TimelineEvent } from "./types";

/**
 * Dane demonstracyjne wyłącznie dla `NODE_ENV === "development"`.
 * W produkcji dashboard pokazuje pusty stan lub błąd zamiast danych zastępczych.
 */
export const IS_DEV_FIXTURES_ENABLED = process.env.NODE_ENV === "development";

const FIXTURE_TIMESTAMP = "2026-10-18T12:00:00.000Z";

export const DEV_FIXTURE_CHILD: ChildRecord = {
  id: "dev_child_tymon",
  household_id: "dev_household",
  name: "Tymon (demo)",
  birth_date: "2026-07-15T08:00:00.000Z",
  active_day_mode: "home",
  anti_orthosomnia_mode: false,
  created: FIXTURE_TIMESTAMP,
  updated: FIXTURE_TIMESTAMP,
};

export const DEV_FIXTURE_INSIGHT: ChildInsightRecord = {
  id: "dev_insight_1",
  child_id: DEV_FIXTURE_CHILD.id,
  category: "Korekta okna czuwania",
  diagnosis_code: "SHORT_CYCLE_COMPENSATION",
  status: "active",
  title: "Skróć okno czuwania po krótkiej drzemce",
  explanation:
    "Poprzednia drzemka trwała tylko 35 min. Kolejne okno czuwania skrócone o 20 min, by zapobiec przemęczeniu.",
  confidence_score: 0.92,
  parent_feedback: "pending",
  created: FIXTURE_TIMESTAMP,
  updated: FIXTURE_TIMESTAMP,
};

export const DEV_FIXTURE_TIMELINE: readonly TimelineEvent[] = [
  {
    id: "dev_event_1",
    kind: "nap",
    type: "nap",
    status: "completed",
    startTime: "09:30",
    endTime: "10:15",
    durationMinutes: 45,
    mood: "easy",
  },
  {
    id: "dev_event_2",
    kind: "feeding",
    time: "10:25",
    feedingType: "breast",
    breastSide: "left",
  },
];
