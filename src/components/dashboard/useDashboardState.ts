"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/messages";
import type { TranslateParams } from "@/i18n/translate";
import { pickActiveChild, readStoredActiveChildId, storeActiveChildId } from "@/lib/active-child";
import { prepareChildPhoto } from "@/lib/child-photo";
import { authorizedFetch, loadChildren } from "@/lib/client-data";
import { pb } from "@/lib/pocketbase";
import {
  calculateChronicDrive,
  calculateCircadianParameters,
  calculateEffectiveAgeDays,
  DEFAULT_TIME_ZONE,
  formatDateToCalendarString,
  getAgeBracket,
  getMinutesFromMidnightInTimeZone,
  minutesSinceLastFeeding,
  predictNextSleepSlot,
  resolveInsightWwOffset,
  resolvePhysiologicalDate,
  resolveSleepRestedness,
} from "@/lib/sleep-engine";
import { aggregateDailySleepSummaries, calculateDurationInMinutes } from "@/lib/sleep-summary";
import type {
  ActiveDayMode,
  BreastSide,
  ChildInsightRecord,
  ChildRecord,
  DayContextRecord,
  DiaperKind,
  FeedingType,
  InterventionLevel,
  SleepLogRecord,
  SleepMood,
} from "@/lib/types/database";
import { DEFAULT_BOTTLE_ML, FALLBACK_LAST_NAP_CAPPING } from "./constants";
import {
  DEV_FIXTURE_CHILD,
  DEV_FIXTURE_INSIGHT,
  DEV_FIXTURE_TIMELINE,
  IS_DEV_FIXTURES_ENABLED,
} from "./devFixtures";
import type { TimelineEvent } from "./types";

export type DashboardLoadStatus = "loading" | "ready" | "empty" | "error";

// Czas bieżący ustawiany po zamontowaniu (new Date() w stanie początkowym blokuje prerender)
const EPOCH_ISO = "1970-01-01T00:00:00.000Z";
const MS_PER_SECOND = 1000;
const PLACEHOLDER_TIME = "—";
const RECENT_LOGS_LIMIT = 100;
const MORNING_WAKE_SAMPLE_SIZE = 5;

/**
 * Zwraca czytelny ciąg wieku dziecka w tygodniach i miesiącach.
 *
 * @param {number} days - Wiek w dniach
 * @param {Function} t - Funkcja tłumaczeń
 * @returns {string} Sformatowany wiek
 */
export function formatChildAge(
  days: number,
  t: (key: MessageKey, params?: TranslateParams) => string,
): string {
  const weeks = Math.floor(days / 7);
  if (weeks < 16) {
    return t("age.weeks", { n: weeks });
  }
  return t("age.months", { n: Math.floor(days / 30.4) });
}

/**
 * Formatuje moment ISO do zegara HH:mm w czasie lokalnym urządzenia.
 *
 * @param {string | undefined} iso - Moment w formacie ISO
 * @returns {string} Godzina lub znak zastępczy
 */
function formatClock(iso?: string): string {
  if (!iso) return PLACEHOLDER_TIME;
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Formatuje liczbę sekund jako HH:MM:SS (wartości ujemne zwracają 00:00:00).
 *
 * @param {number} totalSeconds - Liczba sekund
 * @returns {string} Sformatowany czas
 */
function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

/**
 * Zamienia log snu na element osi czasu.
 *
 * @param {SleepLogRecord} log - Zakończony wpis snu
 * @returns {TimelineEvent} Zdarzenie osi czasu
 */
function mapSleepLogToTimelineEvent(log: SleepLogRecord): TimelineEvent {
  const startIso = log.fell_asleep_at || log.put_down_at;
  return {
    id: log.id,
    kind: "nap",
    type: log.type,
    status: log.status,
    startTime: formatClock(startIso),
    endTime: log.woke_up_at ? formatClock(log.woke_up_at) : undefined,
    startIso: startIso || undefined,
    endIso: log.woke_up_at || undefined,
    durationMinutes: calculateDurationInMinutes(startIso, log.woke_up_at),
    mood: log.mood,
  };
}

/**
 * Zamienia wpis day_context na element osi czasu (karmienie lub tagi dnia).
 *
 * @param {DayContextRecord} record - Rekord day_context
 * @returns {TimelineEvent} Zdarzenie osi czasu
 */
function mapDayContextToTimelineEvent(record: DayContextRecord): TimelineEvent {
  if (record.event_type === "diaper" && record.diaper_kind) {
    return {
      id: record.id,
      kind: "diaper",
      time: formatClock(record.timestamp),
      timeIso: record.timestamp,
      diaperKind: record.diaper_kind,
    };
  }
  if (record.feeding_type === "none") {
    return {
      id: record.id,
      kind: "tag",
      time: formatClock(record.timestamp),
      tags: record.tags ?? [],
      notes: record.notes,
    };
  }
  return {
    id: record.id,
    kind: "feeding",
    time: formatClock(record.timestamp),
    timeIso: record.timestamp,
    feedingType: record.feeding_type,
    breastSide: record.breast_side,
    bottleMl: record.bottle_ml,
    breastMinutes: (record.breast_left_min ?? 0) + (record.breast_right_min ?? 0) || undefined,
    notes: record.notes,
  };
}

/**
 * Główny hook zarządzający stanem widoku Dashboard oraz subskrypcją SSE PocketBase.
 *
 * @description
 * Ładuje dziecko, wnioski, logi snu i kontekst dnia z PocketBase, wylicza predykcje
 * deterministycznym silnikiem snu i synchronizuje stoper przez
 * `pb.collection('sleep_logs').subscribe('*')`. Przy braku danych lub błędzie zwraca jawny
 * status (`empty` / `error`); dane demonstracyjne są dostępne wyłącznie w trybie developerskim.
 *
 * @returns {object} Stan i funkcje sterujące pulpitem
 */
export function useDashboardState() {
  const { t, tDynamic } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const [loadStatus, setLoadStatus] = useState<DashboardLoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDemoData, setIsDemoData] = useState(false);
  const [children, setChildren] = useState<readonly ChildRecord[]>([]);
  const [child, setChild] = useState<ChildRecord | null>(null);
  const [activeInsight, setActiveInsight] = useState<ChildInsightRecord | null>(null);
  const [recentLogs, setRecentLogs] = useState<readonly SleepLogRecord[]>([]);
  const [dayContext, setDayContext] = useState<readonly DayContextRecord[]>([]);
  const [localTimelineEvents, setLocalTimelineEvents] = useState<readonly TimelineEvent[]>([]);
  const [currentSleepLog, setCurrentSleepLog] = useState<SleepLogRecord | null>(null);
  const [pendingMorningWakingReview, setPendingMorningWakingReview] = useState<readonly string[]>(
    [],
  );
  const [nowIso, setNowIso] = useState<string>(EPOCH_ISO);

  useEffect(() => {
    setNowIso(new Date().toISOString());
    const timer = setInterval(() => setNowIso(new Date().toISOString()), MS_PER_SECOND);
    return () => clearInterval(timer);
  }, []);

  // Szybkie przełączanie dzieci: liczy się tylko odpowiedź na ostatnie żądanie
  const loadRequestRef = useRef(0);

  const loadDashboardData = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    try {
      const householdChildren = await loadChildren();
      if (requestId !== loadRequestRef.current) return;
      setChildren(householdChildren);
      const activeChild = pickActiveChild(householdChildren, readStoredActiveChildId());
      if (!activeChild) {
        if (IS_DEV_FIXTURES_ENABLED && !pb.authStore.isValid) {
          setChild(DEV_FIXTURE_CHILD);
          setActiveInsight(DEV_FIXTURE_INSIGHT);
          setLocalTimelineEvents(DEV_FIXTURE_TIMELINE);
          setIsDemoData(true);
          setLoadStatus("ready");
        } else {
          setLoadStatus("empty");
        }
        return;
      }

      const childFilter = pb.filter("child_id = {:childId}", { childId: activeChild.id });
      const [logsResult, insightResult] = await Promise.all([
        pb.collection("sleep_logs").getList<SleepLogRecord>(1, RECENT_LOGS_LIMIT, {
          filter: childFilter,
          sort: "-created",
        }),
        pb.collection("child_insights").getList<ChildInsightRecord>(1, 1, {
          // Wniosek obowiązujący: aktywny, potwierdzony albo skorygowany przez rodzica (hipoteza nie zmienia prognoz)
          filter: pb.filter(
            "child_id = {:childId} && (status = 'active' || status = 'validated' || status = 'corrected_by_parent')",
            { childId: activeChild.id },
          ),
          sort: "-created",
        }),
      ]);
      if (requestId !== loadRequestRef.current) return;

      setChild(activeChild);
      setRecentLogs(logsResult.items);
      setCurrentSleepLog(logsResult.items.find((log) => log.status !== "completed") ?? null);
      setActiveInsight(insightResult.items[0] ?? null);
      setLoadStatus("ready");
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : tRef.current("dashboard.noData"));
      setLoadStatus("error");
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleSelectChild = (childId: string) => {
    if (childId === child?.id) return;
    storeActiveChildId(childId);
    setErrorMessage(null);
    setDayContext([]);
    setPendingMorningWakingReview([]);
    loadDashboardData();
  };

  const timeZone = child?.timezone || DEFAULT_TIME_ZONE;
  const latestNightLog = recentLogs.find((log) => log.type === "night");
  const physiologicalDate = useMemo(
    () =>
      resolvePhysiologicalDate({
        eventTimestamp: nowIso,
        timeZone,
        activeOrRecentNightSleep: latestNightLog
          ? {
              physiologicalDate: latestNightLog.physiological_date,
              fellAsleepAt: latestNightLog.fell_asleep_at || latestNightLog.put_down_at || nowIso,
              wokeUpAt: latestNightLog.woke_up_at,
            }
          : null,
      }),
    [nowIso, timeZone, latestNightLog],
  );

  useEffect(() => {
    if (!child || isDemoData) return;
    pb.collection("day_context")
      .getList<DayContextRecord>(1, 100, {
        filter: pb.filter("child_id = {:childId} && physiological_date = {:date}", {
          childId: child.id,
          date: physiologicalDate,
        }),
        sort: "-timestamp",
      })
      .then((result) => setDayContext(result.items))
      .catch((error) =>
        setErrorMessage(
          error instanceof Error ? error.message : tRef.current("dashboard.contextError"),
        ),
      );
  }, [child, isDemoData, physiologicalDate]);

  useEffect(() => {
    if (!child || isDemoData) return;
    const childId = child.id;
    pb.collection("sleep_logs")
      .subscribe<SleepLogRecord>("*", (eventRecord) => {
        const updatedLog = eventRecord.record;
        if (updatedLog.child_id !== childId) return;
        if (eventRecord.action === "delete") {
          setRecentLogs((prev) => prev.filter((log) => log.id !== updatedLog.id));
          setCurrentSleepLog((prev) => (prev?.id === updatedLog.id ? null : prev));
          return;
        }
        setRecentLogs((prev) => [updatedLog, ...prev.filter((log) => log.id !== updatedLog.id)]);
        setCurrentSleepLog(updatedLog.status !== "completed" ? updatedLog : null);
      })
      .catch((error) =>
        setErrorMessage(error instanceof Error ? error.message : tRef.current("dashboard.noSync")),
      );

    return () => {
      pb.collection("sleep_logs").unsubscribe("*");
    };
  }, [child, isDemoData]);

  const effectiveAgeDays = child
    ? calculateEffectiveAgeDays(child.birth_date, child.due_date, nowIso)
    : 0;
  const ageBracket = getAgeBracket(effectiveAgeDays);

  const chronicDrive = useMemo(
    () =>
      calculateChronicDrive(
        aggregateDailySleepSummaries(recentLogs).filter(
          (day) => day.physiologicalDate !== physiologicalDate,
        ),
        ageBracket,
      ),
    [recentLogs, physiologicalDate, ageBracket],
  );

  const morningWakeTimes = recentLogs
    .filter((log) => log.type === "night" && log.status === "completed" && log.woke_up_at)
    .slice(0, MORNING_WAKE_SAMPLE_SIZE)
    .map((log) => getMinutesFromMidnightInTimeZone(log.woke_up_at ?? nowIso, timeZone));

  const circadianParams = calculateCircadianParameters({
    morningWakeTimesLast5DaysMinutesFromMidnight: morningWakeTimes,
    bracket: ageBracket,
  });

  const lastCompletedLog = recentLogs.find((log) => log.status === "completed" && log.woke_up_at);
  const todayNapsCount = recentLogs.filter(
    (log) =>
      log.type === "nap" &&
      log.status === "completed" &&
      log.physiological_date === physiologicalDate,
  ).length;

  const sweetSpotPrediction =
    child && lastCompletedLog?.woke_up_at
      ? predictNextSleepSlot({
          lastWakeUpIso: lastCompletedLog.woke_up_at,
          previousNapDurationMin:
            lastCompletedLog.type === "nap"
              ? calculateDurationInMinutes(
                  lastCompletedLog.fell_asleep_at || lastCompletedLog.put_down_at,
                  lastCompletedLog.woke_up_at,
                )
              : null,
          napIndexToday: todayNapsCount,
          bracket: ageBracket,
          effectiveAgeDays,
          chronicSleepDebtMin: chronicDrive.chronicSleepDebtMin,
          dayMode: child.active_day_mode,
          biologicalBedtimeMinFromMidnight: circadianParams.biologicalBedtimeMinFromMidnight,
          insightWwOffsetMin: resolveInsightWwOffset(activeInsight),
          timeZone,
        })
      : null;

  const timelineEvents = useMemo<readonly TimelineEvent[]>(() => {
    const todayLogs = recentLogs
      .filter((log) => log.physiological_date === physiologicalDate && log.status === "completed")
      .map(mapSleepLogToTimelineEvent);
    return [...localTimelineEvents, ...dayContext.map(mapDayContextToTimelineEvent), ...todayLogs];
  }, [recentLogs, dayContext, localTimelineEvents, physiologicalDate]);

  const reportError = (error: unknown, fallback: string) =>
    setErrorMessage(error instanceof Error ? error.message : fallback);

  const persistChildPatch = async (patch: Partial<ChildRecord>) => {
    if (!child) return;
    setChild({ ...child, ...patch });
    if (isDemoData) return;
    try {
      await pb.collection("children").update(child.id, patch);
    } catch (error) {
      setChild(child);
      reportError(error, t("dashboard.saveChildError"));
    }
  };

  const handleChangeChildPhoto = async (file: File | null): Promise<boolean> => {
    if (!child || isDemoData) return false;
    try {
      const photo = file ? await prepareChildPhoto(file) : null;
      const updated = await pb.collection("children").update<ChildRecord>(child.id, { photo });
      setChild(updated);
      setChildren((list) => list.map((item) => (item.id === updated.id ? updated : item)));
      return true;
    } catch {
      return false;
    }
  };

  const handleSelectDayMode = (mode: ActiveDayMode) => persistChildPatch({ active_day_mode: mode });

  const handleToggleAntiOrthosomnia = () =>
    persistChildPatch({ anti_orthosomnia_mode: !child?.anti_orthosomnia_mode });

  const handleAcceptInsight = async (insightId: string) => {
    setActiveInsight((prev) =>
      prev?.id === insightId ? { ...prev, parent_feedback: "accepted" } : prev,
    );
    if (isDemoData) return;
    try {
      const response = await authorizedFetch("/api/ai/correct-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insightId, feedback: "accepted" }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      reportError(error, t("dashboard.saveInsightError"));
      await loadDashboardData();
    }
  };

  const handleAdjustInsight = (insightId: string) => {
    setActiveInsight((prev) =>
      prev?.id === insightId ? { ...prev, parent_feedback: "adjusted" } : prev,
    );
  };

  const saveSleepLog = async (log: SleepLogRecord, patch: Partial<SleepLogRecord>) => {
    const next = { ...log, ...patch };
    setCurrentSleepLog(next.status === "completed" ? null : next);
    if (isDemoData) return;
    try {
      await pb.collection("sleep_logs").update(log.id, patch);
    } catch (error) {
      setCurrentSleepLog(log);
      reportError(error, t("dashboard.saveSleepError"));
    }
  };

  const startSleepLog = async () => {
    if (!child) return;
    const nowIsoValue = new Date().toISOString();
    const hour = new Date().getHours();
    const draft = {
      child_id: child.id,
      physiological_date: physiologicalDate,
      type: hour >= 18 || hour < 6 ? ("night" as const) : ("nap" as const),
      status: "falling_asleep" as const,
      put_down_at: nowIsoValue,
      interventions: [],
      night_wakings: [],
      is_rebound_sleep: false,
      ignore_in_calibration: false,
    };
    if (isDemoData) {
      setCurrentSleepLog({
        ...draft,
        id: `dev_sleep_${Date.now()}`,
        created: nowIsoValue,
        updated: nowIsoValue,
      });
      return;
    }
    try {
      setCurrentSleepLog(await pb.collection("sleep_logs").create<SleepLogRecord>(draft));
    } catch (error) {
      reportError(error, t("dashboard.startSleepError"));
    }
  };

  const handleCycleSleepStatus = async () => {
    if (!currentSleepLog || currentSleepLog.status === "completed") {
      await startSleepLog();
      return;
    }

    if (currentSleepLog.status === "falling_asleep") {
      await saveSleepLog(currentSleepLog, {
        status: "sleeping",
        fell_asleep_at: new Date().toISOString(),
      });
      return;
    }

    if (currentSleepLog.status === "sleeping") {
      if (currentSleepLog.type === "night" && currentSleepLog.night_wakings?.length) {
        setPendingMorningWakingReview(
          currentSleepLog.night_wakings.map((wake) => formatClock(wake.wokeAt)),
        );
      }
      await saveSleepLog(currentSleepLog, {
        status: "completed",
        woke_up_at: new Date().toISOString(),
      });
    }
  };

  const handleQuickNightWake = async () => {
    if (!currentSleepLog) return;
    const updatedWakings = [
      ...(currentSleepLog.night_wakings || []),
      {
        wokeAt: new Date().toISOString(),
        estimatedDurationMin: 15,
        fedMilk: true,
        interventions: ["bottle" as const],
      },
    ];
    await saveSleepLog(currentSleepLog, { night_wakings: updatedWakings });
  };

  const handleResolveMorningWaking = (_minutes: number) => {
    setPendingMorningWakingReview([]);
  };

  const saveDayContext = async (draft: {
    event_type: DayContextRecord["event_type"];
    feeding_type: FeedingType;
    bottle_ml?: number;
    breast_side?: BreastSide;
    breast_left_min?: number;
    breast_right_min?: number;
    diaper_kind?: DiaperKind;
    tags?: readonly string[];
    notes?: string;
  }) => {
    if (!child) return;
    const timestamp = new Date().toISOString();
    if (isDemoData) {
      const record = {
        ...draft,
        id: `dev_ctx_${Date.now()}`,
        child_id: child.id,
        physiological_date: physiologicalDate,
        timestamp,
        created: timestamp,
        updated: timestamp,
      };
      setDayContext((prev) => [record, ...prev]);
      return;
    }
    try {
      const created = await pb.collection("day_context").create<DayContextRecord>({
        ...draft,
        child_id: child.id,
        physiological_date: physiologicalDate,
        timestamp,
      });
      setDayContext((prev) => [created, ...prev]);
    } catch (error) {
      reportError(error, t("dashboard.saveEntryError"));
    }
  };

  const handleSaveFeeding = (
    type: FeedingType,
    details: { side?: BreastSide; ml?: number; minutes?: number; notes?: string },
  ) =>
    saveDayContext({
      event_type: "feeding",
      feeding_type: type,
      breast_side: details.side,
      bottle_ml: details.ml,
      breast_left_min: details.side === "left" ? details.minutes : undefined,
      breast_right_min: details.side === "right" ? details.minutes : undefined,
      notes: details.notes,
    });

  const handleSaveDiaper = (kind: DiaperKind) =>
    saveDayContext({ event_type: "diaper", feeding_type: "none", diaper_kind: kind });

  /** 1-tap: butelka z ostatnio użytą objętością (domyślnie 120 ml). */
  const handleQuickBottle = () => {
    const lastBottle = dayContext.find((r) => r.feeding_type === "bottle" && r.bottle_ml);
    return handleSaveFeeding("bottle", { ml: lastBottle?.bottle_ml ?? DEFAULT_BOTTLE_ML });
  };

  /** 1-tap: mokra pielucha. */
  const handleQuickDiaper = () => handleSaveDiaper("wet");

  const handleSaveMoodAndIntervention = async (
    mood: SleepMood,
    interventions: readonly InterventionLevel[],
  ) => {
    if (!currentSleepLog) return;
    await saveSleepLog(currentSleepLog, { mood, interventions });
  };

  const handleSaveDayTag = (tag: string) =>
    saveDayContext({ event_type: "tag", feeding_type: "none", tags: [tag] });

  const minutesSinceFeeding = minutesSinceLastFeeding(
    dayContext
      .filter((r) => r.feeding_type !== "none")
      .map((r) => ({
        timestamp: r.timestamp,
        kind: r.feeding_type as "breast" | "bottle" | "solid",
      })),
    nowIso,
  );

  const sweetSpotTime = sweetSpotPrediction?.sweetSpotIso;
  const secondsToSweetSpot = sweetSpotTime
    ? (new Date(sweetSpotTime).getTime() - new Date(nowIso).getTime()) / MS_PER_SECOND
    : 0;

  return {
    loadStatus,
    errorMessage,
    isDemoData,
    child,
    children,
    handleSelectChild,
    handleChangeChildPhoto,
    effectiveAgeDays,
    ageDisplay: formatChildAge(effectiveAgeDays, t),
    activeInsight,
    currentSleepLog,
    timelineEvents,
    pendingMorningWakingReview,
    physiologicalDateDisplay: formatDateToCalendarString(
      new Date(`${physiologicalDate}T12:00:00Z`),
      "UTC",
    ),
    morningWakeTimeDisplay: formatClock(latestNightLog?.woke_up_at),
    morningWakeIso: recentLogs.find(
      (log) => log.type === "night" && log.status === "completed" && log.woke_up_at,
    )?.woke_up_at,
    sleepBatteryPercent: chronicDrive.sleepBatteryPercent,
    sleepRestedness: resolveSleepRestedness(chronicDrive.chronicSleepDebtMin),
    sleepNeedsProfile: chronicDrive.sleepNeedsProfile,
    latestLastNapEndAt: circadianParams.latestLastNapEndAt || FALLBACK_LAST_NAP_CAPPING,
    sweetSpotTimeDisplay: formatClock(sweetSpotPrediction?.sweetSpotIso),
    compassRangeDisplay: sweetSpotPrediction
      ? `${formatClock(sweetSpotPrediction.compassWindowStartIso)} — ${formatClock(sweetSpotPrediction.compassWindowEndIso)}`
      : PLACEHOLDER_TIME,
    countdownDisplay: sweetSpotPrediction ? formatCountdown(secondsToSweetSpot) : PLACEHOLDER_TIME,
    reasonDescription: sweetSpotPrediction
      ? tDynamic(`reason.${sweetSpotPrediction.reasonCode}`, sweetSpotPrediction.reasonCode)
      : t("dashboard.noWakeYet"),
    handleSelectDayMode,
    handleToggleAntiOrthosomnia,
    handleAcceptInsight,
    handleAdjustInsight,
    handleCycleSleepStatus,
    handleQuickNightWake,
    handleResolveMorningWaking,
    handleSaveFeeding,
    handleSaveDiaper,
    handleQuickBottle,
    handleQuickDiaper,
    minutesSinceFeeding,
    physiologicalDate: nowIso === EPOCH_ISO ? null : physiologicalDate,
    nowIso,
    handleSaveMoodAndIntervention,
    handleSaveDayTag,
  };
}
