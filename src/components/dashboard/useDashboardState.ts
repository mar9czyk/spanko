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
  applyObservedNapsCount,
  calculateChronicDrive,
  calculateCircadianParameters,
  calculateEffectiveAgeDays,
  collectCircadianSamples,
  DEFAULT_TIME_ZONE,
  formatDateToCalendarString,
  getAgeBracket,
  isIllnessDay,
  minutesSinceLastFeeding,
  needsWakeCheck,
  predictNextSleepSlot,
  resolveDayModeGuidance,
  resolveInsightDayAdjustments,
  resolveInsightWwOffset,
  resolvePhysiologicalDate,
  resolveScheduleClock,
  resolveSleepRestedness,
  resolveUsualNapStats,
  suggestNapWakeTime,
  type TravelPlan,
  type TravelStrategy,
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
import { FALLBACK_LAST_NAP_CAPPING } from "./constants";
import {
  DEV_FIXTURE_CHILD,
  DEV_FIXTURE_INSIGHT,
  DEV_FIXTURE_TIMELINE,
  IS_DEV_FIXTURES_ENABLED,
} from "./devFixtures";
import type { EditedEntry } from "./EditEntrySheet";
import {
  formatClock,
  mapDayContextToTimelineEvent,
  mapSleepLogToTimelineEvent,
  sortTimelineEventsAsc,
} from "./timelineMapping";
import type { TimelineEvent } from "./types";

export type DashboardLoadStatus = "loading" | "ready" | "empty" | "error";

// Czas bieżący ustawiany po zamontowaniu (new Date() w stanie początkowym blokuje prerender)
const EPOCH_ISO = "1970-01-01T00:00:00.000Z";
const MS_PER_SECOND = 1000;
const PLACEHOLDER_TIME = "—";
const RECENT_LOGS_LIMIT = 100;
const MORNING_WAKE_SAMPLE_SIZE = 5;
const INSIGHT_UNDO_WINDOW_MS = 10_000;

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
  const [nightWakeToast, setNightWakeToast] = useState<{
    readonly logId: string;
    readonly wokeAt: string;
  } | null>(null);
  const [isDemoData, setIsDemoData] = useState(false);
  const [children, setChildren] = useState<readonly ChildRecord[]>([]);
  const [child, setChild] = useState<ChildRecord | null>(null);
  const [activeInsight, setActiveInsight] = useState<ChildInsightRecord | null>(null);
  // Wniosek potwierdzony w tej sesji: przez chwilę karta pokazuje „Zapisane · Cofnij”
  const [justAcceptedInsightId, setJustAcceptedInsightId] = useState<string | null>(null);
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

  const scheduleClock = useMemo(
    () => resolveScheduleClock(child?.timezone || DEFAULT_TIME_ZONE, child?.travel_json, nowIso),
    [child?.timezone, child?.travel_json, nowIso],
  );
  const timeZone = scheduleClock.timeZone;
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
        // Edycja dawnego, zakończonego snu nie może zamknąć trwającego
        setCurrentSleepLog((prev) =>
          updatedLog.status !== "completed" ? updatedLog : prev?.id === updatedLog.id ? null : prev,
        );
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
  // Pełne doby (bez bieżącej): norma, dług i wykrywanie mniejszej liczby drzemek
  const completedDays = useMemo(
    () =>
      aggregateDailySleepSummaries(recentLogs).filter(
        (day) => day.physiologicalDate !== physiologicalDate,
      ),
    [recentLogs, physiologicalDate],
  );
  const ageBracket = useMemo(
    () => applyObservedNapsCount(getAgeBracket(effectiveAgeDays), completedDays),
    [effectiveAgeDays, completedDays],
  );

  const chronicDrive = useMemo(
    () => calculateChronicDrive(completedDays, ageBracket),
    [completedDays, ageBracket],
  );

  const completedNightLogs = recentLogs.filter(
    (log) => log.type === "night" && log.status === "completed" && log.woke_up_at,
  );
  // Pobudki i zaśnięcia w zegarze harmonogramu (podróż: strefa wpisu albo przestawianie)
  const circadianSamples = collectCircadianSamples(
    completedNightLogs.map((log) => ({
      wokeUpAt: log.woke_up_at ?? nowIso,
      fellAsleepAt: log.fell_asleep_at || log.put_down_at || nowIso,
      timeZone: log.timezone || undefined,
    })),
    scheduleClock,
    MORNING_WAKE_SAMPLE_SIZE,
  );
  const morningWakeTimes = circadianSamples.wakeMinutes;
  const nightBedtimes = circadianSamples.bedtimeMinutes;

  // Korekty z drzew diagnostycznych (bedtime fading, nap capping) z limitami silnika
  const dayAdjustments = resolveInsightDayAdjustments(activeInsight);

  const circadianParams = calculateCircadianParameters({
    morningWakeTimesLast5DaysMinutesFromMidnight: morningWakeTimes,
    bedtimesLast5DaysMinutesFromMidnight: nightBedtimes,
    bracket: ageBracket,
    bedtimeShiftMin: dayAdjustments.bedtimeShiftMin,
    daytimeSleepCapOffsetMin: dayAdjustments.daytimeSleepCapOffsetMin,
  });

  const lastCompletedLog = recentLogs.find((log) => log.status === "completed" && log.woke_up_at);
  const todayCompletedNaps = recentLogs.filter(
    (log) =>
      log.type === "nap" &&
      log.status === "completed" &&
      log.physiological_date === physiologicalDate,
  );
  const todayNapsCount = todayCompletedNaps.length;

  const activeNapStartIso =
    currentSleepLog?.type === "nap" && currentSleepLog.status === "sleeping"
      ? currentSleepLog.fell_asleep_at || currentSleepLog.put_down_at
      : undefined;
  const todayDaytimeSleepMin = todayCompletedNaps.reduce(
    (sum, log) =>
      sum + calculateDurationInMinutes(log.fell_asleep_at || log.put_down_at, log.woke_up_at),
    0,
  );
  const usualNapStats = useMemo(() => resolveUsualNapStats(completedDays), [completedDays]);
  const napWakeSuggestionIso = activeNapStartIso
    ? suggestNapWakeTime({
        napStartIso: activeNapStartIso,
        daytimeSleepBeforeNapMin: todayDaytimeSleepMin,
        bracket: ageBracket,
        daytimeSleepCapOffsetMin: dayAdjustments.daytimeSleepCapOffsetMin,
      })
    : null;

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
          todayDaytimeSleepMin,
          usualDaytimeSleepMin: usualNapStats.daytimeMin,
        })
      : null;

  // Tryby dnia: podpowiedzi i pytanie o budzenie przy długim śnie w chorobie
  const todayTags = dayContext.flatMap((entry) => entry.tags ?? []);
  const dayModeGuidance = child
    ? resolveDayModeGuidance({ dayMode: child.active_day_mode, tags: todayTags, effectiveAgeDays })
    : null;
  const lastTodayNap = todayCompletedNaps[0];
  const wakeCheckNapMin = activeNapStartIso
    ? calculateDurationInMinutes(activeNapStartIso, nowIso)
    : lastTodayNap
      ? calculateDurationInMinutes(
          lastTodayNap.fell_asleep_at || lastTodayNap.put_down_at,
          lastTodayNap.woke_up_at,
        )
      : 0;
  const isWakeCheckNeeded = needsWakeCheck({
    isIllness: isIllnessDay(child?.active_day_mode, todayTags),
    napDurationMin: wakeCheckNapMin,
    usualLongestNapMin: usualNapStats.longestNapMin,
  });

  const timelineEvents = useMemo<readonly TimelineEvent[]>(() => {
    const todayLogs = recentLogs
      .filter((log) => log.physiological_date === physiologicalDate && log.status === "completed")
      .map(mapSleepLogToTimelineEvent);
    return sortTimelineEventsAsc([
      ...localTimelineEvents,
      ...dayContext.map(mapDayContextToTimelineEvent),
      ...todayLogs,
    ]);
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

  /** Zapisuje strategię podróży: na czasie domowym strefa dziecka się nie zmienia. */
  const handleApplyTravel = (toTimeZone: string, strategy: TravelStrategy) => {
    if (!child) return;
    const fromTimeZone = child.timezone || DEFAULT_TIME_ZONE;
    const plan: TravelPlan = {
      fromTimeZone,
      toTimeZone,
      startedAt: new Date().toISOString(),
      strategy,
    };
    persistChildPatch({
      timezone: strategy === "stay_home" ? fromTimeZone : toTimeZone,
      travel_json: plan,
    });
  };

  /** Kończy przestawianie od razu: dalej liczymy w strefie lokalnej. */
  const handleFinishTravelAdaptation = () => {
    const plan = child?.travel_json;
    if (!plan) return;
    persistChildPatch({ travel_json: { ...plan, strategy: "local_now" } });
  };

  const handleToggleAntiOrthosomnia = () =>
    persistChildPatch({ anti_orthosomnia_mode: !child?.anti_orthosomnia_mode });

  useEffect(() => {
    if (!justAcceptedInsightId) return;
    const timer = setTimeout(() => setJustAcceptedInsightId(null), INSIGHT_UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [justAcceptedInsightId]);

  /**
   * Zapisuje opinię rodzica o wniosku; przy błędzie przywraca stan z serwera.
   */
  const sendInsightFeedback = async (
    insightId: string,
    patch: Pick<ChildInsightRecord, "status" | "parent_feedback">,
  ) => {
    setActiveInsight((prev) => (prev?.id === insightId ? { ...prev, ...patch } : prev));
    if (isDemoData) return;
    try {
      const response = await authorizedFetch("/api/ai/correct-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insightId, feedback: patch.parent_feedback }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      setJustAcceptedInsightId(null);
      reportError(error, t("dashboard.saveInsightError"));
      await loadDashboardData();
    }
  };

  const handleAcceptInsight = async (insightId: string) => {
    setJustAcceptedInsightId(insightId);
    await sendInsightFeedback(insightId, { status: "validated", parent_feedback: "accepted" });
  };

  const handleUndoAcceptInsight = async (insightId: string) => {
    setJustAcceptedInsightId(null);
    await sendInsightFeedback(insightId, { status: "active", parent_feedback: "pending" });
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
      // Strefa, w której powstał wpis: po podróży godziny starych nocy zostają poprawne
      timezone: child.timezone || DEFAULT_TIME_ZONE,
      // Autor wpisu — do telemetrii per użytkownik w panelu admina
      created_by: pb.authStore.record?.id,
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
    const previousWakings = currentSleepLog.night_wakings || [];
    const wokeAt = new Date().toISOString();
    const updatedWakings = [
      ...previousWakings,
      {
        wokeAt,
        estimatedDurationMin: 15,
        fedMilk: true,
        interventions: ["bottle" as const],
      },
    ];
    await saveSleepLog(currentSleepLog, { night_wakings: updatedWakings });
    setNightWakeToast({ logId: currentSleepLog.id, wokeAt });
  };

  /** Cofa ostatnio zapisaną szybką pobudkę (usuwa wpis o tym samym czasie). */
  const handleUndoNightWake = async () => {
    const toast = nightWakeToast;
    setNightWakeToast(null);
    if (!toast || !currentSleepLog || currentSleepLog.id !== toast.logId) return;
    const remaining = (currentSleepLog.night_wakings || []).filter(
      (wake) => wake.wokeAt !== toast.wokeAt,
    );
    await saveSleepLog(currentSleepLog, { night_wakings: remaining });
  };

  /** Pobudka nocna wykryta nasłuchem mikrofonu — bez założeń o karmieniu. */
  const handleDetectedNightWake = async () => {
    if (!currentSleepLog) return;
    const updatedWakings = [
      ...(currentSleepLog.night_wakings || []),
      {
        wokeAt: new Date().toISOString(),
        estimatedDurationMin: 15,
        fedMilk: false,
        interventions: [],
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

  /** 1-tap: butelka bez ilości; ilość da się uzupełnić później w edycji wpisu. */
  const handleQuickBottle = () => handleSaveFeeding("bottle", {});

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

  /** Po edycji godzin wpisu z osi czasu bieżącej doby podmienia rekord w stanie. */
  const handleEntryEdited = (entry: EditedEntry) => {
    if (entry.collection === "day_context") {
      setDayContext((prev) =>
        prev
          .map((record) => (record.id === entry.record.id ? entry.record : record))
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
      );
      return;
    }
    setRecentLogs((prev) => prev.map((log) => (log.id === entry.record.id ? entry.record : log)));
  };

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
    justAcceptedInsightId,
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
    napWakeSuggestionDisplay: napWakeSuggestionIso ? formatClock(napWakeSuggestionIso) : null,
    sweetSpotTimeDisplay: formatClock(sweetSpotPrediction?.sweetSpotIso),
    compassRangeDisplay: sweetSpotPrediction
      ? `${formatClock(sweetSpotPrediction.compassWindowStartIso)} — ${formatClock(sweetSpotPrediction.compassWindowEndIso)}`
      : PLACEHOLDER_TIME,
    countdownDisplay: sweetSpotPrediction ? formatCountdown(secondsToSweetSpot) : PLACEHOLDER_TIME,
    reasonDescription: sweetSpotPrediction
      ? tDynamic(`reason.${sweetSpotPrediction.reasonCode}`, sweetSpotPrediction.reasonCode)
      : t("dashboard.noWakeYet"),
    handleSelectDayMode,
    scheduleClock,
    handleApplyTravel,
    handleFinishTravelAdaptation,
    dayModeGuidance,
    isWakeCheckNeeded,
    handleToggleAntiOrthosomnia,
    handleAcceptInsight,
    handleUndoAcceptInsight,
    handleCycleSleepStatus,
    handleQuickNightWake,
    nightWakeToast,
    dismissNightWakeToast: () => setNightWakeToast(null),
    handleUndoNightWake,
    handleDetectedNightWake,
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
    handleEntryEdited,
  };
}
