"use client";

import Link from "next/link";
import { useState } from "react";
import { AnnouncementBanner } from "@/components/dashboard/AnnouncementBanner";
import { BackdatedSleepSheet } from "@/components/dashboard/BackdatedSleepSheet";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import {
  DAY_DETAIL_TAB_ORDER,
  DayBubbles,
  type DayDetailTab,
} from "@/components/dashboard/DayBubbles";
import { DayDetailSheet } from "@/components/dashboard/DayDetailSheet";
import { DayModeGuidanceCard } from "@/components/dashboard/DayModeGuidanceCard";
import { pastDayStripNowIso, shiftPhysiologicalDate } from "@/components/dashboard/dayHistory";
import { axisStartFor, sharedAxisHour } from "@/components/dashboard/dayStripModel";
import { findNightSleep } from "@/components/dashboard/daySummary";
import { EntryToast } from "@/components/dashboard/EntryToast";
import { FeedingSheet } from "@/components/dashboard/FeedingSheet";
import { FellAsleepCard } from "@/components/dashboard/FellAsleepCard";
import { FloatingActionBar } from "@/components/dashboard/FloatingActionBar";
import { HeroWidget } from "@/components/dashboard/HeroWidget";
import { LastNapPanel } from "@/components/dashboard/LastNapPanel";
import { MorningNightSummaryBanner } from "@/components/dashboard/MorningNightSummaryBanner";
import { NightWakeToast } from "@/components/dashboard/NightWakeToast";
import { PhysiologicalTimeline } from "@/components/dashboard/PhysiologicalTimeline";
import { QuickEntryBottomSheet } from "@/components/dashboard/QuickEntryBottomSheet";
import { SleepBatteryIndicator } from "@/components/dashboard/SleepBatteryIndicator";
import { isInsightShown, SmartInsightCard } from "@/components/dashboard/SmartInsightCard";
import { TravelTimeZoneCard } from "@/components/dashboard/TravelTimeZoneCard";
import { formatClock } from "@/components/dashboard/timelineMapping";
import type { TimelineEvent } from "@/components/dashboard/types";
import { useDashboardState } from "@/components/dashboard/useDashboardState";
import { usePastDays } from "@/components/dashboard/usePastDays";
import { WakeListenerCard } from "@/components/dashboard/WakeListenerCard";
import { countGoalTasks, GoalPathCard } from "@/components/goals/GoalPathCard";
import { NightTipCard } from "@/components/goals/NightTipCard";
import { useGoalState } from "@/components/goals/useGoalState";
import { useI18n } from "@/i18n/I18nProvider";
import { dateLocaleTag, formatDuration, pluralSuffix } from "@/i18n/translate";
import { describeTask, describeTaskShort } from "@/lib/goal-copy";
import { DEFAULT_TIME_ZONE } from "@/lib/sleep-engine";
import { nightAdviceFor } from "@/lib/sleep-engine/nightAdvice";
import { parseSleepEnvironment } from "@/lib/sleep-environment";

/**
 * Główny widok aplikacji Spanko w stylistyce 3 AM One-Thumb Dark UX.
 *
 * @description
 * Skupia 5 kluczowych stref interfejsu zoptymalizowanych pod kątem ciemności chroniącej
 * melatoninę (#0B0F17), obsługi jedną ręką w nocy oraz deterministycznego silnika snu.
 *
 * @returns {JSX.Element} Główny ekran dashboardu
 */
export default function DashboardPage() {
  const { t, locale } = useI18n();
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [isFeedingOpen, setIsFeedingOpen] = useState(false);
  const [isBackdatedOpen, setIsBackdatedOpen] = useState(false);
  const state = useDashboardState();
  const { child } = state;
  const goalState = useGoalState({
    childId: child?.id,
    physiologicalDate: state.physiologicalDate,
    locale: locale,
    enabled: Boolean(child) && !state.isDemoData,
  });
  // Wczoraj i przedwczoraj jednym zapytaniem; w demo tylko bieżąca doba
  const today = state.physiologicalDate;
  const pastDays = usePastDays(
    child?.id,
    today && !state.isDemoData ? shiftPhysiologicalDate(today, -1) : null,
    2,
  );
  const [yesterday, dayBefore] = pastDays.days;
  // Akordeon: naraz rozwinięta jedna doba
  const [openDay, setOpenDay] = useState<"today" | "yesterday" | "before" | null>(null);
  const toggleDay = (day: "today" | "yesterday" | "before") =>
    setOpenDay((current) => (current === day ? null : day));
  const handleSelectChild = (childId: string) => {
    setOpenDay(null);
    state.handleSelectChild(childId);
  };
  // Wspólna oś zegarowa: ta sama kolumna = ta sama pora dnia we wszystkich trzech dobach
  const axisHour = sharedAxisHour(
    [state.morningWakeIso, yesterday?.dayStartIso, dayBefore?.dayStartIso].filter(
      (iso): iso is string => Boolean(iso),
    ),
  );
  const axisFor = (wakeIso: string | undefined) =>
    wakeIso && axisHour !== null ? axisStartFor(wakeIso, axisHour) : undefined;
  const formatShortDate = (date: string) => {
    const day = new Date(`${date}T12:00:00Z`);
    const weekday = day
      .toLocaleDateString(dateLocaleTag(locale), { timeZone: "UTC", weekday: "short" })
      .replace(/\.$/, "");
    return `${weekday} ${day.getUTCDate()}.${day.getUTCMonth() + 1}`;
  };
  const describeNightBefore = (events: readonly TimelineEvent[] | undefined) => {
    const night = events && findNightSleep(events);
    if (!night?.durationMinutes) return undefined;
    const wakings = night.nightWakingIsos?.length ?? 0;
    return (
      t("timeline.nightNote", {
        start: night.startTime,
        end: night.endTime ?? "",
        duration: formatDuration(night.durationMinutes),
      }) +
      (wakings > 0
        ? t(`timeline.nightNoteWakings.${pluralSuffix(locale, wakings)}`, { n: wakings })
        : "")
    );
  };
  const pastEmptyText =
    pastDays.status === "error"
      ? t("timeline.loadPastError")
      : pastDays.status === "ready"
        ? t("timeline.emptyPast")
        : t("common.loading");
  const [detailTab, setDetailTab] = useState<DayDetailTab | null>(null);
  const isNightSleepActive =
    state.currentSleepLog?.type === "night" && state.currentSleepLog.status !== "completed";

  const sleepEnvironment = parseSleepEnvironment(child?.sleep_environment);
  const defaultSleepPlace =
    state.currentSleepLog?.type === "night"
      ? sleepEnvironment.nightPlace
      : sleepEnvironment.napPlace;

  const isSleepInProgress =
    state.currentSleepLog !== null && state.currentSleepLog.status !== "completed";
  const insightShown = isInsightShown(state.activeInsight, state.justAcceptedInsightId);
  const nightTipTask = goalState.daily?.night_tip_json;
  const insightAdvice =
    insightShown && state.activeInsight
      ? nightAdviceFor(state.activeInsight.diagnosis_code, locale)
      : null;
  const nightTip = nightTipTask
    ? { short: describeTaskShort(nightTipTask, locale), full: describeTask(nightTipTask, locale) }
    : insightAdvice
      ? { short: insightAdvice, full: undefined }
      : null;
  const availableTabs = DAY_DETAIL_TAB_ORDER.filter((tab) => {
    if (tab === "goal") return Boolean(goalState.goal);
    if (tab === "insight") return insightShown;
    return true;
  });
  // Arkusz zamyka się sam, gdy jego zakładka znika (np. wniosek po „Działa”) lub zaczyna się sen
  const openTab =
    detailTab && !isSleepInProgress && availableTabs.includes(detailTab) ? detailTab : null;

  if (!child) {
    const message =
      state.loadStatus === "loading"
        ? t("common.loading")
        : state.loadStatus === "error"
          ? t("dashboard.loadError", {
              message: state.errorMessage ?? t("common.unknownError"),
            })
          : t("dashboard.noChild");
    return (
      <main className="w-full p-6 text-sm text-slate-400" role="status">
        {message}
      </main>
    );
  }

  return (
    <main className="w-full flex flex-col gap-3">
      {!state.isDemoData && <AnnouncementBanner />}
      {state.isDemoData && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
          {t("dashboard.demo")}{" "}
          <a href="/login" className="underline">
            {t("dashboard.demoLogin")}
          </a>
        </p>
      )}
      {state.errorMessage && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-1 text-xs text-red-300">
          {state.errorMessage}
        </p>
      )}
      <DashboardHeader
        child={child}
        householdChildren={state.children}
        ageDisplay={state.ageDisplay}
        onSelectChild={handleSelectChild}
        onSelectDayMode={state.handleSelectDayMode}
        onChangeChildPhoto={state.isDemoData ? undefined : state.handleChangeChildPhoto}
      />
      <DayModeGuidanceCard
        guidance={state.dayModeGuidance}
        isWakeCheckNeeded={state.isWakeCheckNeeded}
        locale={locale}
      />
      <TravelTimeZoneCard
        childTimeZone={child.timezone || DEFAULT_TIME_ZONE}
        plan={child.travel_json}
        clock={state.scheduleClock}
        isOnTheGo={child.active_day_mode === "on_the_go"}
        nowIso={state.nowIso}
        onApply={state.handleApplyTravel}
        onFinishAdaptation={state.handleFinishTravelAdaptation}
      />
      {isNightSleepActive && nightTip && (
        <NightTipCard short={nightTip.short} full={nightTip.full} />
      )}
      <MorningNightSummaryBanner
        wakingTimes={state.pendingMorningWakingReview}
        onSave={(answer) => void state.handleResolveMorningWaking(answer)}
        onDismiss={() => void state.handleResolveMorningWaking(null)}
      />
      <HeroWidget
        currentSleepLog={state.currentSleepLog}
        isAntiOrthosomnia={child.anti_orthosomnia_mode}
        countdownDisplay={state.countdownDisplay}
        sweetSpotTimeDisplay={state.sweetSpotTimeDisplay}
        compassRangeDisplay={state.compassRangeDisplay}
        onToggleAntiOrthosomnia={state.handleToggleAntiOrthosomnia}
        effectiveAgeDays={state.effectiveAgeDays}
        napWakeSuggestion={state.napWakeSuggestionDisplay}
        bubbles={
          <DayBubbles
            data={{
              restedness: state.sleepRestedness,
              batteryPercent: state.sleepBatteryPercent,
              goalTasks: goalState.goal ? countGoalTasks(goalState.daily) : null,
              insightPending: insightShown
                ? state.activeInsight?.id !== state.justAcceptedInsightId
                : null,
              lastNapEnd: state.latestLastNapEndAt,
            }}
            onOpen={setDetailTab}
          />
        }
      />
      {!state.isDemoData && state.currentSleepLog && (
        <WakeListenerCard
          childId={child.id}
          isSleeping={state.currentSleepLog.status === "sleeping"}
          sleepType={state.currentSleepLog.type}
          onConfirmWake={
            state.currentSleepLog.type === "night"
              ? state.handleDetectedNightWake
              : state.handleCycleSleepStatus
          }
        />
      )}
      <PhysiologicalTimeline
        label={t("timeline.dayToday")}
        dateText={today ? formatShortDate(today) : undefined}
        isCurrentDay
        morningWakeTimeDisplay={state.morningWakeTimeDisplay}
        events={state.timelineEvents}
        morningWakeIso={state.morningWakeIso}
        axisStartIso={axisFor(state.morningWakeIso)}
        wakeNote={describeNightBefore(yesterday?.events)}
        nowIso={state.nowIso}
        currentSleepLog={state.currentSleepLog}
        isExpanded={openDay === "today"}
        onToggle={() => toggleDay("today")}
        onEntryEdited={state.isDemoData ? undefined : state.handleEntryEdited}
      />
      {today &&
        !state.isDemoData &&
        (
          [
            ["yesterday", yesterday, t("timeline.dayYesterday"), -1, dayBefore?.events],
            ["before", dayBefore, t("timeline.dayBefore"), -2, undefined],
          ] as const
        ).map(([key, day, label, offset, nightBeforeEvents]) => (
          <PhysiologicalTimeline
            key={key}
            label={label}
            dateText={formatShortDate(shiftPhysiologicalDate(today, offset))}
            morningWakeTimeDisplay={formatClock(day?.dayStartIso)}
            events={day?.events ?? []}
            morningWakeIso={day?.dayStartIso}
            axisStartIso={axisFor(day?.dayStartIso)}
            wakeNote={describeNightBefore(nightBeforeEvents)}
            nowIso={(day && pastDayStripNowIso(day)) ?? state.nowIso}
            currentSleepLog={null}
            isExpanded={openDay === key}
            onToggle={() => toggleDay(key)}
            onEntryEdited={pastDays.reload}
            emptyText={pastEmptyText}
          />
        ))}
      {!state.isDemoData && (
        <Link
          href="/history"
          className="flex min-h-11 items-center justify-center text-xs font-medium text-slate-400 hover:text-amber-300"
        >
          {t("timeline.olderInHistory")}
        </Link>
      )}
      <div
        className={`pointer-events-none fixed inset-x-0 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-md flex-col gap-2 ${isNightSleepActive ? "bottom-40" : "bottom-28"}`}
      >
        {state.fellAsleepPromptLogId &&
          state.fellAsleepPromptLogId === state.currentSleepLog?.id && (
            <FellAsleepCard
              key={state.fellAsleepPromptLogId}
              onSave={state.handleSaveFellAsleep}
              onDismiss={state.dismissFellAsleepPrompt}
              defaultPlace={defaultSleepPlace}
              onSavePlace={(place) => void state.handleSaveSleepPlace(place)}
            />
          )}
        <EntryToast
          toast={state.entryToast}
          onBreastMinutes={(minutes) => void state.handleToastBreastMinutes(minutes)}
          onDiaperKind={(kind) => void state.handleToastDiaperKind(kind)}
          onUndo={() => void state.handleUndoEntryToast()}
          onDismiss={state.dismissEntryToast}
        />
        <NightWakeToast
          wokeAtIso={state.nightWakeToast?.wokeAt ?? null}
          onUndo={() => void state.handleUndoNightWake()}
          onDismiss={state.dismissNightWakeToast}
        />
      </div>
      <FloatingActionBar
        currentSleepLog={state.currentSleepLog}
        onCycleSleepStatus={state.handleCycleSleepStatus}
        onQuickNightWake={state.handleQuickNightWake}
        onOpenFeeding={() => setIsFeedingOpen(true)}
        onOpenTags={() => setIsTagsOpen(true)}
        onQuickDiaper={state.handleQuickDiaper}
      />
      <DayDetailSheet
        activeTab={openTab}
        tabs={availableTabs}
        onChangeTab={setDetailTab}
        onClose={() => setDetailTab(null)}
        panels={{
          battery: (
            <SleepBatteryIndicator
              batteryPercent={state.sleepBatteryPercent}
              sleepRestedness={state.sleepRestedness}
              sleepNeedsProfile={state.sleepNeedsProfile}
            />
          ),
          goal: goalState.goal ? (
            <GoalPathCard
              goal={goalState.goal}
              daily={goalState.daily}
              physiologicalDate={state.physiologicalDate}
              error={goalState.error}
              locale={locale}
              onToggleTask={goalState.toggleTask}
              onChangeStatus={goalState.changeStatus}
            />
          ) : null,
          insight: (
            <SmartInsightCard
              insight={state.activeInsight}
              justAcceptedInsightId={state.justAcceptedInsightId}
              onAccept={state.handleAcceptInsight}
              onUndoAccept={state.handleUndoAcceptInsight}
            />
          ),
          nap: <LastNapPanel time={state.latestLastNapEndAt} reason={state.reasonDescription} />,
        }}
      />
      <FeedingSheet
        isOpen={isFeedingOpen}
        suggestedSide={state.suggestedBreastSide}
        onClose={() => setIsFeedingOpen(false)}
        onSaveBreast={(side) => void state.handleSaveFeeding("breast", { side })}
        onSaveBottle={(ml) => void state.handleSaveFeeding("bottle", { ml })}
        onSaveSolid={() => void state.handleSaveFeeding("solid", {})}
      />
      <QuickEntryBottomSheet
        isOpen={isTagsOpen}
        activeTags={state.activeDayTags}
        onClose={() => setIsTagsOpen(false)}
        onToggleTag={(tag) => void state.handleToggleDayTag(tag)}
        onStartEarlier={
          state.currentSleepLog && state.currentSleepLog.status !== "completed"
            ? undefined
            : () => {
                setIsTagsOpen(false);
                setIsBackdatedOpen(true);
              }
        }
      />
      <BackdatedSleepSheet
        isOpen={isBackdatedOpen}
        onClose={() => setIsBackdatedOpen(false)}
        onStart={(startIso) => void state.handleStartSleepEarlier(startIso)}
      />
    </main>
  );
}
