"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/messages";
import type { TranslateParams } from "@/i18n/translate";
import { pickActiveChild, readStoredActiveChildId, storeActiveChildId } from "@/lib/active-child";
import { prepareChildPhoto } from "@/lib/child-photo";
import { authorizedFetch, loadChildren } from "@/lib/client-data";
import { repairMisdatedEntries } from "@/lib/misdatedEntries";
import { pb } from "@/lib/pocketbase";
import { subscribeToCollection } from "@/lib/realtime";
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
import { normalizeDayTag } from "@/lib/sleep-engine/dayTags";
import type { InterventionType } from "@/lib/sleep-engine/types";
import type { SleepPlace } from "@/lib/sleep-environment";
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
  NightWakingDetail,
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

/** Wybór w toście pobudki nocnej: pierś lewa/prawa, butelka albo bez karmienia. */

/** Ostatnio zapisane karmienie lub pielucha — toast „zapisano” z cofnięciem i dopiskiem. */
export interface EntryToast {
  readonly id: string;
  readonly kind: "breast" | "bottle" | "diaper";
  readonly side?: BreastSide;
  readonly bottleMl?: number;
  readonly diaperKind?: DiaperKind;
}

/** Dane pierwszego wpisu day_context, zanim dostanie id. */
type DayContextDraft = {
  event_type: DayContextRecord["event_type"];
  feeding_type: FeedingType;
  bottle_ml?: number;
  breast_side?: BreastSide;
  breast_left_min?: number;
  breast_right_min?: number;
  diaper_kind?: DiaperKind;
  tags?: readonly string[];
  notes?: string;
};

// Czas bieżący ustawiany po zamontowaniu (new Date() w stanie początkowym blokuje prerender)
export interface MorningWakingAnswer {
  readonly durationMin: number;
  readonly interventions: readonly InterventionType[];
}

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
  const [entryToast, setEntryToast] = useState<EntryToast | null>(null);
  // Sen, po którego rozpoczęciu pokazujemy kartę „Jak zasnął?”
  const [fellAsleepPromptLogId, setFellAsleepPromptLogId] = useState<string | null>(null);
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
  const [pendingMorningReview, setPendingMorningReview] = useState<{
    readonly logId: string;
    readonly wakings: readonly NightWakingDetail[];
  } | null>(null);
  const pendingMorningWakingReview = useMemo(
    () => (pendingMorningReview?.wakings ?? []).map((wake) => formatClock(wake.wokeAt)),
    [pendingMorningReview],
  );
  const [nowIso, setNowIso] = useState<string>(EPOCH_ISO);

  useEffect(() => {
    setNowIso(new Date().toISOString());
    const timer = setInterval(() => setNowIso(new Date().toISOString()), MS_PER_SECOND);
    return () => clearInterval(timer);
  }, []);

  // Szybkie przełączanie dzieci: liczy się tylko odpowiedź na ostatnie żądanie
  const loadRequestRef = useRef(0);
  const [repairTick, setRepairTick] = useState(0);

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
      // Samonaprawa: wpisy po pobudce, zapisane pod datą doby nocy (noc zamknięta z opóźnieniem)
      const lastNight = logsResult.items.find((log) => log.type === "night");
      if (lastNight) {
        repairMisdatedEntries(
          activeChild.id,
          lastNight,
          activeChild.timezone || DEFAULT_TIME_ZONE,
        ).then((moved) => {
          if (moved > 0 && requestId === loadRequestRef.current) setRepairTick((n) => n + 1);
        });
      }
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
    setPendingMorningReview(null);
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: repairTick celowo odświeża wpisy po samonaprawie dat
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
  }, [child, isDemoData, physiologicalDate, repairTick]);

  const childId = child?.id;

  useEffect(() => {
    if (!childId || isDemoData) return;
    const reportSyncError = (error: unknown) =>
      setErrorMessage(error instanceof Error ? error.message : tRef.current("dashboard.noSync"));

    const stopSleepLogs = subscribeToCollection<SleepLogRecord>(
      pb.collection("sleep_logs"),
      (eventRecord) => {
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
      },
      reportSyncError,
    );

    // Karmienia, pieluchy i reszta kontekstu dnia z drugiego urządzenia
    const stopDayContext = subscribeToCollection<DayContextRecord>(
      pb.collection("day_context"),
      (eventRecord) => {
        const record = eventRecord.record;
        if (record.child_id !== childId) return;
        if (eventRecord.action === "delete") {
          setDayContext((prev) => prev.filter((entry) => entry.id !== record.id));
          return;
        }
        setDayContext((prev) =>
          prev.some((entry) => entry.id === record.id)
            ? prev.map((entry) => (entry.id === record.id ? record : entry))
            : [record, ...prev],
        );
      },
      reportSyncError,
    );

    return () => {
      stopSleepLogs();
      stopDayContext();
    };
  }, [childId, isDemoData]);

  // Telefon w kieszeni zrywa SSE, a PocketBase nie odtwarza zdarzeń z przerwy: po powrocie dociągamy stan
  useEffect(() => {
    if (!childId || isDemoData) return;
    const resync = () => {
      if (document.visibilityState === "visible") loadDashboardData();
    };
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("online", resync);
    return () => {
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("online", resync);
    };
  }, [childId, isDemoData, loadDashboardData]);

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
  const activeDayTags = useMemo(
    () => [...new Set(todayTags.map((tag) => normalizeDayTag(tag)))],
    [todayTags],
  );
  // Strona następnej piersi: przeciwna do ostatniej zapisanej dziś
  const lastBreastSide = [...dayContext]
    .filter((entry) => entry.feeding_type === "breast" && entry.breast_side)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.breast_side;
  const suggestedBreastSide: BreastSide | undefined =
    lastBreastSide === "left" ? "right" : lastBreastSide === "right" ? "left" : undefined;
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

  /**
   * Zakłada sen. Z `backdatedStartIso` powstaje od razu trwający sen („śpi”), który zaczął się
   * w przeszłości — licznik liczy od tej pory, a koniec zapisuje „Wstał”.
   */
  const startSleepLog = async (backdatedStartIso?: string) => {
    if (!child) return;
    const nowIsoValue = new Date().toISOString();
    const startIso = backdatedStartIso ?? nowIsoValue;
    const hour = new Date(startIso).getHours();
    const draft = {
      child_id: child.id,
      physiological_date: physiologicalDate,
      type: hour >= 18 || hour < 6 ? ("night" as const) : ("nap" as const),
      status: backdatedStartIso ? ("sleeping" as const) : ("falling_asleep" as const),
      put_down_at: startIso,
      ...(backdatedStartIso ? { fell_asleep_at: startIso } : {}),
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

  const handleStartSleepEarlier = async (startIso: string) => {
    if (currentSleepLog && currentSleepLog.status !== "completed") return;
    await startSleepLog(startIso);
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
      setFellAsleepPromptLogId(currentSleepLog.id);
      return;
    }

    if (currentSleepLog.status === "sleeping") {
      setFellAsleepPromptLogId(null);
      if (currentSleepLog.type === "night" && currentSleepLog.night_wakings?.length) {
        setPendingMorningReview({
          logId: currentSleepLog.id,
          wakings: currentSleepLog.night_wakings,
        });
      }
      await saveSleepLog(currentSleepLog, {
        status: "completed",
        woke_up_at: new Date().toISOString(),
      });
    }
  };

  /** Zapisuje pobudkę bez założeń o karmieniu; co dostał, wybiera się w toście. */
  const handleQuickNightWake = async () => {
    if (!currentSleepLog) return;
    const previousWakings = currentSleepLog.night_wakings || [];
    const wokeAt = new Date().toISOString();
    const updatedWakings = [
      ...previousWakings,
      { wokeAt, estimatedDurationMin: 15, fedMilk: false, interventions: [] },
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

  /** Poranna odpowiedź o nocnych pobudkach: czas trwania i czym uspokojono; null = pomiń. */
  const handleResolveMorningWaking = async (answer: MorningWakingAnswer | null): Promise<void> => {
    const review = pendingMorningReview;
    setPendingMorningReview(null);
    if (!answer || !review || isDemoData) return;
    const wakings = review.wakings.map((wake) => ({
      ...wake,
      estimatedDurationMin: answer.durationMin,
      interventions: answer.interventions,
      fedMilk: answer.interventions.some((item) => item === "breast" || item === "bottle"),
    }));
    try {
      await pb.collection("sleep_logs").update(review.logId, { night_wakings: wakings });
    } catch (error) {
      reportError(error, t("dashboard.saveSleepError"));
    }
  };

  const patchDayContext = async (id: string, patch: Partial<DayContextRecord>) => {
    setDayContext((prev) =>
      prev.map((record) => (record.id === id ? { ...record, ...patch } : record)),
    );
    if (isDemoData) return;
    try {
      await pb.collection("day_context").update(id, patch);
    } catch (error) {
      reportError(error, t("dashboard.saveEntryError"));
    }
  };

  const removeDayContext = async (id: string) => {
    setDayContext((prev) => prev.filter((record) => record.id !== id));
    if (isDemoData) return;
    try {
      await pb.collection("day_context").delete(id);
    } catch (error) {
      reportError(error, t("dashboard.saveEntryError"));
    }
  };

  /** Zapisuje wpis day_context; zwraca go, gdy zapis się udał. */
  const saveDayContext = async (draft: DayContextDraft): Promise<DayContextRecord | undefined> => {
    if (!child) return undefined;
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
      return record;
    }
    try {
      const created = await pb.collection("day_context").create<DayContextRecord>({
        ...draft,
        child_id: child.id,
        physiological_date: physiologicalDate,
        timestamp,
      });
      setDayContext((prev) => [created, ...prev]);
      return created;
    } catch (error) {
      reportError(error, t("dashboard.saveEntryError"));
      return undefined;
    }
  };

  /** Zapisuje karmienie i pokazuje toast z cofnięciem (pierś: dopisek minut). */
  const handleSaveFeeding = async (
    type: FeedingType,
    details: { side?: BreastSide; ml?: number; minutes?: number; notes?: string },
  ) => {
    const record = await saveDayContext({
      event_type: "feeding",
      feeding_type: type,
      breast_side: details.side,
      bottle_ml: details.ml,
      breast_left_min: details.side === "left" ? details.minutes : undefined,
      breast_right_min: details.side === "right" ? details.minutes : undefined,
      notes: details.notes,
    });
    if (!record || (type !== "breast" && type !== "bottle")) return;
    setEntryToast({ id: record.id, kind: type, side: details.side, bottleMl: details.ml });
  };

  /** Zapisuje pieluchę i pokazuje toast z cofnięciem (zmiana rodzaju). */
  const handleSaveDiaper = async (kind: DiaperKind) => {
    const record = await saveDayContext({
      event_type: "diaper",
      feeding_type: "none",
      diaper_kind: kind,
    });
    if (record) setEntryToast({ id: record.id, kind: "diaper", diaperKind: kind });
  };

  /** 1-tap: mokra pielucha. */
  const handleQuickDiaper = () => handleSaveDiaper("wet");

  /** Dopisek do toastu: minuty karmienia piersią. */
  const handleToastBreastMinutes = async (minutes: number) => {
    const toast = entryToast;
    setEntryToast(null);
    if (toast?.kind !== "breast") return;
    await patchDayContext(
      toast.id,
      toast.side === "left" ? { breast_left_min: minutes } : { breast_right_min: minutes },
    );
  };

  /** Dopisek do toastu: rodzaj pieluchy. */
  const handleToastDiaperKind = async (kind: DiaperKind) => {
    const toast = entryToast;
    setEntryToast(null);
    if (toast?.kind !== "diaper") return;
    await patchDayContext(toast.id, { diaper_kind: kind });
  };

  const handleUndoEntryToast = async () => {
    const toast = entryToast;
    setEntryToast(null);
    if (toast) await removeDayContext(toast.id);
  };

  /** Karta „Jak zasnął?”: nastrój i co pomogło trafiają do trwającego snu. */
  const handleSaveFellAsleep = async (
    mood: SleepMood | undefined,
    interventions: readonly InterventionLevel[],
  ) => {
    if (!currentSleepLog || currentSleepLog.id !== fellAsleepPromptLogId) return;
    await saveSleepLog(currentSleepLog, mood ? { mood, interventions } : { interventions });
  };

  /** Zapisuje wyjątek „dziś gdzie indziej”; pusty tekst czyści wybór. */
  const handleSaveSleepPlace = async (place: SleepPlace | "") => {
    if (!currentSleepLog || currentSleepLog.id !== fellAsleepPromptLogId) return;
    await saveSleepLog(currentSleepLog, { sleep_place: place });
  };

  /** Włącza lub wyłącza tag dnia; wyłączenie usuwa dzisiejsze wpisy z tym tagiem. */
  const handleToggleDayTag = async (tag: string) => {
    const matching = dayContext.filter((entry) =>
      (entry.tags ?? []).some((value) => normalizeDayTag(value) === tag),
    );
    if (matching.length === 0) {
      await saveDayContext({ event_type: "tag", feeding_type: "none", tags: [tag] });
      return;
    }
    for (const entry of matching) {
      const rest = (entry.tags ?? []).filter((value) => normalizeDayTag(value) !== tag);
      if (rest.length === 0) await removeDayContext(entry.id);
      else await patchDayContext(entry.id, { tags: rest });
    }
  };

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
    handleStartSleepEarlier,
    handleQuickNightWake,
    nightWakeToast,
    dismissNightWakeToast: () => setNightWakeToast(null),
    handleUndoNightWake,
    handleDetectedNightWake,
    handleResolveMorningWaking,
    handleSaveFeeding,
    handleSaveDiaper,
    handleQuickDiaper,
    entryToast,
    dismissEntryToast: () => setEntryToast(null),
    handleToastBreastMinutes,
    handleToastDiaperKind,
    handleUndoEntryToast,
    suggestedBreastSide,
    activeDayTags,
    fellAsleepPromptLogId,
    dismissFellAsleepPrompt: () => setFellAsleepPromptLogId(null),
    handleSaveFellAsleep,
    handleSaveSleepPlace,
    minutesSinceFeeding,
    physiologicalDate: nowIso === EPOCH_ISO ? null : physiologicalDate,
    nowIso,
    handleToggleDayTag,
    handleEntryEdited,
  };
}
