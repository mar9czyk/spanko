"use client";

import { useEffect, useState } from "react";
import { pb } from "@/lib/pocketbase";
import {
  calculateCircadianParameters,
  calculateEffectiveAgeDays,
  getAgeBracket,
  predictNextSleepSlot,
} from "@/lib/sleep-engine";
import type {
  ActiveDayMode,
  BreastSide,
  ChildInsightRecord,
  ChildRecord,
  FeedingType,
  InterventionLevel,
  SleepLogRecord,
  SleepMood,
} from "@/lib/types/database";
import { DEFAULT_BATTERY_PERCENT, FALLBACK_LAST_NAP_CAPPING } from "./constants";
import type { TimelineEvent } from "./types";

const INITIAL_CHILD: ChildRecord = {
  id: "mock_child_tymon",
  household_id: "mock_household",
  name: "Tymon",
  birth_date: "2026-07-15T08:00:00.000Z",
  active_day_mode: "home",
  anti_orthosomnia_mode: false,
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
};

const INITIAL_INSIGHT: ChildInsightRecord = {
  id: "mock_insight_1",
  child_id: "mock_child_tymon",
  category: "Korekta okna czuwania",
  diagnosis_code: "SHORT_CYCLE_COMPENSATION",
  status: "active",
  title: "Skróć okno czuwania po krótkiej drzemce",
  explanation:
    "Poprzednia drzemka trwała tylko 35 min. Kolejne okno czuwania skrócone o 20 min, by zapobiec przemęczeniu.",
  confidence_score: 0.92,
  parent_feedback: "pending",
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
};

const INITIAL_TIMELINE: readonly TimelineEvent[] = [
  {
    id: "event_1",
    kind: "nap",
    type: "nap",
    status: "completed",
    startTime: "09:30",
    endTime: "10:15",
    durationMinutes: 45,
    mood: "easy",
  },
  {
    id: "event_2",
    kind: "feeding",
    time: "10:25",
    feedingType: "breast",
    breastSide: "left",
  },
  {
    id: "event_3",
    kind: "tag",
    time: "11:00",
    tags: ["spacer", "wózek"],
  },
];

/**
 * Zwraca czytelny ciąg wieku dziecka w tygodniach i miesiącach.
 *
 * @param {number} days - Wiek w dniach
 * @returns {string} Sformatowany wiek
 */
export function formatChildAge(days: number): string {
  const weeks = Math.floor(days / 7);
  if (weeks < 16) {
    return `${weeks} tyg.`;
  }
  const months = Math.floor(days / 30.4);
  return `${months} mies.`;
}

/**
 * Główny hook zarządzający stanem widoku Dashboard oraz subskrypcją SSE PocketBase.
 *
 * @description
 * Koordynuje deterministyczny silnik snu (SweetSpot, Capping, Bateria) z subskrypcją
 * `pb.collection('sleep_logs').subscribe('*')`, zapewniając natychmiastową synchronizację
 * między urządzeniami obojga rodziców w czasie rzeczywistym.
 *
 * @returns {object} Stan i funkcje sterujące pulpitem
 */
export function useDashboardState() {
  const [child, setChild] = useState<ChildRecord>(INITIAL_CHILD);
  const [activeInsight, setActiveInsight] = useState<ChildInsightRecord | null>(INITIAL_INSIGHT);
  const [currentSleepLog, setCurrentSleepLog] = useState<SleepLogRecord | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<readonly TimelineEvent[]>(INITIAL_TIMELINE);
  const [pendingMorningWakingReview, setPendingMorningWakingReview] = useState<readonly string[]>(
    [],
  );

  const [nowIso, setNowIso] = useState<string>("2026-10-18T12:00:00.000Z");

  useEffect(() => {
    setNowIso(new Date().toISOString());
  }, []);

  const effectiveAgeDays = calculateEffectiveAgeDays(child.birth_date, child.due_date, nowIso);
  const ageBracket = getAgeBracket(effectiveAgeDays);

  const circadianParams = calculateCircadianParameters({
    morningWakeTimesLast5DaysMinutesFromMidnight: [420, 435, 415, 425, 430],
    bracket: ageBracket,
  });

  const lastWakeUpMs = new Date(nowIso).getTime() - 60 * 60 * 1000;
  const sweetSpotPrediction = predictNextSleepSlot({
    lastWakeUpIso: new Date(lastWakeUpMs).toISOString(),
    previousNapDurationMin: 45,
    napIndexToday: 1,
    bracket: ageBracket,
    effectiveAgeDays,
    chronicSleepDebtMin: 20,
    dayMode: child.active_day_mode,
    biologicalBedtimeMinFromMidnight: circadianParams.biologicalBedtimeMinFromMidnight,
    insightWwOffsetMin: -15,
  });

  useEffect(() => {
    try {
      pb.collection("sleep_logs").subscribe("*", (eventRecord) => {
        if (eventRecord.action === "create" || eventRecord.action === "update") {
          const updatedLog = eventRecord.record as unknown as SleepLogRecord;
          if (updatedLog.status !== "completed") {
            setCurrentSleepLog(updatedLog);
          } else {
            setCurrentSleepLog(null);
          }
        }
      });
    } catch {
      // Tryb offline/development bez aktywnego serwera PocketBase
    }

    return () => {
      try {
        pb.collection("sleep_logs").unsubscribe("*");
      } catch {
        // Ignorowanie błędu odsubskrybowania w trybie offline
      }
    };
  }, []);

  const handleSelectDayMode = (mode: ActiveDayMode) => {
    setChild((prev) => ({ ...prev, active_day_mode: mode }));
  };

  const handleToggleAntiOrthosomnia = () => {
    setChild((prev) => ({ ...prev, anti_orthosomnia_mode: !prev.anti_orthosomnia_mode }));
  };

  const handleAcceptInsight = (insightId: string) => {
    setActiveInsight((prev) =>
      prev?.id === insightId ? { ...prev, parent_feedback: "accepted" } : prev,
    );
  };

  const handleAdjustInsight = (insightId: string) => {
    setActiveInsight((prev) =>
      prev?.id === insightId ? { ...prev, parent_feedback: "adjusted" } : prev,
    );
  };

  const handleCycleSleepStatus = () => {
    if (!currentSleepLog || currentSleepLog.status === "completed") {
      const isEvening = new Date().getHours() >= 18 || new Date().getHours() < 6;
      const newLog: SleepLogRecord = {
        id: `sleep_${Date.now()}`,
        child_id: child.id,
        physiological_date: "2026-10-18",
        type: isEvening ? "night" : "nap",
        status: "falling_asleep",
        put_down_at: new Date().toISOString(),
        is_rebound_sleep: false,
        ignore_in_calibration: false,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };
      setCurrentSleepLog(newLog);
      return;
    }

    if (currentSleepLog.status === "falling_asleep") {
      setCurrentSleepLog((prev) =>
        prev
          ? {
              ...prev,
              status: "sleeping",
              fell_asleep_at: new Date().toISOString(),
            }
          : null,
      );
      return;
    }

    if (currentSleepLog.status === "sleeping") {
      const wokeIso = new Date().toISOString();
      const finishedLog: SleepLogRecord = {
        ...currentSleepLog,
        status: "completed",
        woke_up_at: wokeIso,
      };

      if (currentSleepLog.type === "night" && currentSleepLog.night_wakings?.length) {
        const wakingHourLabels = currentSleepLog.night_wakings.map((wake) =>
          new Date(wake.wokeAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        );
        setPendingMorningWakingReview(wakingHourLabels);
      }

      setCurrentSleepLog(null);
      const newTimelineItem: TimelineEvent = {
        id: finishedLog.id,
        kind: "nap",
        type: finishedLog.type,
        status: "completed",
        startTime: new Date(
          finishedLog.fell_asleep_at || finishedLog.put_down_at || wokeIso,
        ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        endTime: new Date(wokeIso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        durationMinutes: 40,
        mood: "easy",
      };
      setTimelineEvents((prev) => [newTimelineItem, ...prev]);
    }
  };

  const handleQuickNightWake = () => {
    if (!currentSleepLog) return;
    const nowTime = new Date().toISOString();
    const existingWakings = currentSleepLog.night_wakings || [];
    const updatedWakings = [
      ...existingWakings,
      {
        wokeAt: nowTime,
        estimatedDurationMin: 15,
        fedMilk: true,
        interventions: ["bottle" as const],
      },
    ];
    setCurrentSleepLog({
      ...currentSleepLog,
      night_wakings: updatedWakings,
    });
  };

  const handleResolveMorningWaking = (_minutes: number) => {
    setPendingMorningWakingReview([]);
  };

  const handleSaveFeeding = (
    type: FeedingType,
    details: { side?: BreastSide; ml?: number; notes?: string },
  ) => {
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const feedingEvent: TimelineEvent = {
      id: `feed_${Date.now()}`,
      kind: "feeding",
      time: timeNow,
      feedingType: type,
      breastSide: details.side,
      bottleMl: details.ml,
      notes: details.notes,
    };
    setTimelineEvents((prev) => [feedingEvent, ...prev]);
  };

  const handleSaveMoodAndIntervention = (
    mood: SleepMood,
    interventions: readonly InterventionLevel[],
  ) => {
    if (!currentSleepLog) return;
    setCurrentSleepLog((prev) => (prev ? { ...prev, mood, interventions } : null));
  };

  const handleSaveDayTag = (tag: string) => {
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const tagEvent: TimelineEvent = {
      id: `tag_${Date.now()}`,
      kind: "tag",
      time: timeNow,
      tags: [tag],
    };
    setTimelineEvents((prev) => [tagEvent, ...prev]);
  };

  return {
    child,
    effectiveAgeDays,
    ageDisplay: formatChildAge(effectiveAgeDays),
    activeInsight,
    currentSleepLog,
    timelineEvents,
    pendingMorningWakingReview,
    sleepBatteryPercent: DEFAULT_BATTERY_PERCENT,
    sleepNeedsProfile: "average" as const,
    latestLastNapEndAt: circadianParams.latestLastNapEndAt || FALLBACK_LAST_NAP_CAPPING,
    sweetSpotTimeDisplay: new Date(sweetSpotPrediction.sweetSpotIso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    compassRangeDisplay: `${new Date(sweetSpotPrediction.compassWindowStartIso).toLocaleTimeString(
      [],
      { hour: "2-digit", minute: "2-digit" },
    )} — ${new Date(sweetSpotPrediction.compassWindowEndIso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`,
    countdownDisplay: "00:32:15",
    reasonDescription: "Krótka poprzednia drzemka (-20 min)",
    handleSelectDayMode,
    handleToggleAntiOrthosomnia,
    handleAcceptInsight,
    handleAdjustInsight,
    handleCycleSleepStatus,
    handleQuickNightWake,
    handleResolveMorningWaking,
    handleSaveFeeding,
    handleSaveMoodAndIntervention,
    handleSaveDayTag,
  };
}
