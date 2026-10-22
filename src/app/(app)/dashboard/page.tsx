"use client";

import { useState } from "react";
import { AnnouncementBanner } from "@/components/dashboard/AnnouncementBanner";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DayModeGuidanceCard } from "@/components/dashboard/DayModeGuidanceCard";
import { pastDayStripNowIso, shiftPhysiologicalDate } from "@/components/dashboard/dayHistory";
import { FloatingActionBar } from "@/components/dashboard/FloatingActionBar";
import { HeroWidget } from "@/components/dashboard/HeroWidget";
import { MorningNightSummaryBanner } from "@/components/dashboard/MorningNightSummaryBanner";
import { PhysiologicalTimeline } from "@/components/dashboard/PhysiologicalTimeline";
import { QuickEntryBottomSheet } from "@/components/dashboard/QuickEntryBottomSheet";
import { SmartInsightCard } from "@/components/dashboard/SmartInsightCard";
import { TravelTimeZoneCard } from "@/components/dashboard/TravelTimeZoneCard";
import { formatClock } from "@/components/dashboard/timelineMapping";
import { useDashboardState } from "@/components/dashboard/useDashboardState";
import { usePastDays } from "@/components/dashboard/usePastDays";
import { WakeListenerCard } from "@/components/dashboard/WakeListenerCard";
import { GoalPathCard } from "@/components/goals/GoalPathCard";
import { NightTipCard } from "@/components/goals/NightTipCard";
import { useGoalState } from "@/components/goals/useGoalState";
import { useI18n } from "@/i18n/I18nProvider";
import { DEFAULT_TIME_ZONE } from "@/lib/sleep-engine";

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
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const state = useDashboardState();
  const { child } = state;
  const goalState = useGoalState({
    childId: child?.id,
    physiologicalDate: state.physiologicalDate,
    locale: locale,
    enabled: Boolean(child) && !state.isDemoData,
  });
  // Oglądana wcześniejsza doba; null = bieżąca
  const [viewedDate, setViewedDate] = useState<string | null>(null);
  const pastDays = usePastDays(child?.id, viewedDate, 1);
  const pastDay = pastDays.days[0];
  const today = state.physiologicalDate;
  const navigation =
    today && !state.isDemoData
      ? {
          onPrevious: () => setViewedDate(shiftPhysiologicalDate(viewedDate ?? today, -1)),
          onNext: viewedDate
            ? () => {
                const next = shiftPhysiologicalDate(viewedDate, 1);
                setViewedDate(next >= today ? null : next);
              }
            : undefined,
          onToday: viewedDate ? () => setViewedDate(null) : undefined,
        }
      : undefined;
  const handleSelectChild = (childId: string) => {
    setViewedDate(null);
    state.handleSelectChild(childId);
  };
  const isNightSleepActive =
    state.currentSleepLog?.type === "night" && state.currentSleepLog.status !== "completed";

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
    <main className="w-full flex flex-col gap-3 pb-8">
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
        onToggleAntiOrthosomnia={state.handleToggleAntiOrthosomnia}
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
      {/* Wybór nowego celu jest w /settings, żeby nie zaśmiecać pulpitu */}
      {goalState.goal && (
        <GoalPathCard
          goal={goalState.goal}
          daily={goalState.daily}
          physiologicalDate={state.physiologicalDate}
          error={goalState.error}
          locale={locale}
          onToggleTask={goalState.toggleTask}
          onChangeStatus={goalState.changeStatus}
        />
      )}
      {isNightSleepActive && goalState.daily?.night_tip_json && (
        <NightTipCard tip={goalState.daily.night_tip_json} locale={locale} />
      )}
      <SmartInsightCard
        insight={state.activeInsight}
        justAcceptedInsightId={state.justAcceptedInsightId}
        onAccept={state.handleAcceptInsight}
        onUndoAccept={state.handleUndoAcceptInsight}
      />
      <MorningNightSummaryBanner
        wakingTimes={state.pendingMorningWakingReview}
        onSelectDuration={state.handleResolveMorningWaking}
        onDismiss={() => state.handleResolveMorningWaking(15)}
      />
      <HeroWidget
        currentSleepLog={state.currentSleepLog}
        isAntiOrthosomnia={child.anti_orthosomnia_mode}
        countdownDisplay={state.countdownDisplay}
        sweetSpotTimeDisplay={state.sweetSpotTimeDisplay}
        compassRangeDisplay={state.compassRangeDisplay}
        reasonDescription={state.reasonDescription}
        effectiveAgeDays={state.effectiveAgeDays}
        batteryPercent={state.sleepBatteryPercent}
        sleepRestedness={state.sleepRestedness}
        sleepNeedsProfile={state.sleepNeedsProfile}
        latestLastNapEndAt={state.latestLastNapEndAt}
        napWakeSuggestion={state.napWakeSuggestionDisplay}
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
      {viewedDate ? (
        <PhysiologicalTimeline
          key={viewedDate}
          physiologicalDateDisplay={t("dashboard.dayPrefix", { date: viewedDate })}
          morningWakeTimeDisplay={formatClock(pastDay?.dayStartIso)}
          events={pastDay?.events ?? []}
          morningWakeIso={pastDay?.dayStartIso}
          nowIso={(pastDay && pastDayStripNowIso(pastDay)) ?? state.nowIso}
          currentSleepLog={null}
          navigation={navigation}
          onEntryEdited={pastDays.reload}
          emptyText={
            pastDays.status === "error"
              ? t("timeline.loadPastError")
              : pastDays.status === "ready"
                ? t("timeline.emptyPast")
                : t("common.loading")
          }
        />
      ) : (
        <PhysiologicalTimeline
          physiologicalDateDisplay={t("dashboard.dayPrefix", {
            date: state.physiologicalDateDisplay,
          })}
          morningWakeTimeDisplay={state.morningWakeTimeDisplay}
          events={state.timelineEvents}
          morningWakeIso={state.morningWakeIso}
          nowIso={state.nowIso}
          currentSleepLog={state.currentSleepLog}
          navigation={navigation}
          onEntryEdited={state.isDemoData ? undefined : state.handleEntryEdited}
        />
      )}
      <FloatingActionBar
        currentSleepLog={state.currentSleepLog}
        onCycleSleepStatus={state.handleCycleSleepStatus}
        onQuickNightWake={state.handleQuickNightWake}
        onOpenQuickEntry={() => setIsQuickEntryOpen(true)}
        onQuickBottle={state.handleQuickBottle}
        onQuickDiaper={state.handleQuickDiaper}
      />
      <QuickEntryBottomSheet
        isOpen={isQuickEntryOpen}
        onClose={() => setIsQuickEntryOpen(false)}
        onSaveFeeding={state.handleSaveFeeding}
        onSaveDiaper={state.handleSaveDiaper}
        onSaveMoodAndIntervention={state.handleSaveMoodAndIntervention}
        onSaveDayTag={state.handleSaveDayTag}
      />
    </main>
  );
}
