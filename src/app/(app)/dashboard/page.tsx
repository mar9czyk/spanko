"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { FloatingActionBar } from "@/components/dashboard/FloatingActionBar";
import { HeroWidget } from "@/components/dashboard/HeroWidget";
import { MorningNightSummaryBanner } from "@/components/dashboard/MorningNightSummaryBanner";
import { PhysiologicalTimeline } from "@/components/dashboard/PhysiologicalTimeline";
import { QuickEntryBottomSheet } from "@/components/dashboard/QuickEntryBottomSheet";
import { SmartInsightCard } from "@/components/dashboard/SmartInsightCard";
import { useDashboardState } from "@/components/dashboard/useDashboardState";
import { ChooseGoalCard, GoalPathCard } from "@/components/goals/GoalPathCard";
import { NightTipCard } from "@/components/goals/NightTipCard";
import { useGoalState } from "@/components/goals/useGoalState";
import type { CopyLocale } from "@/lib/goal-copy";

// Zastąpione wykrywaniem języka w Fazie 10 (i18n).
const GOAL_LOCALE: CopyLocale = "pl";

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
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const state = useDashboardState();
  const { child } = state;
  const goalState = useGoalState({
    childId: child?.id,
    physiologicalDate: state.physiologicalDate,
    locale: GOAL_LOCALE,
    enabled: Boolean(child) && !state.isDemoData,
  });
  const isNightSleepActive =
    state.currentSleepLog?.type === "night" && state.currentSleepLog.status !== "completed";

  if (!child) {
    const message =
      state.loadStatus === "loading"
        ? "Ładowanie…"
        : state.loadStatus === "error"
          ? `Nie udało się pobrać danych: ${state.errorMessage ?? "nieznany błąd"}`
          : "Nie dodano jeszcze dziecka do Twojego gospodarstwa domowego.";
    return (
      <main className="w-full p-6 text-sm text-slate-400" role="status">
        {message}
      </main>
    );
  }

  return (
    <main className="w-full flex flex-col gap-3 pb-8">
      {state.isDemoData && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
          Dane demonstracyjne (tryb developerski) —{" "}
          <a href="/login" className="underline">
            zaloguj się
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
        ageDisplay={state.ageDisplay}
        onSelectDayMode={state.handleSelectDayMode}
        onToggleAntiOrthosomnia={state.handleToggleAntiOrthosomnia}
      />
      {goalState.goal ? (
        <GoalPathCard
          goal={goalState.goal}
          daily={goalState.daily}
          physiologicalDate={state.physiologicalDate}
          locale={GOAL_LOCALE}
          onToggleTask={goalState.toggleTask}
          onChangeStatus={goalState.changeStatus}
        />
      ) : (
        goalState.status === "ready" && <ChooseGoalCard />
      )}
      {isNightSleepActive && goalState.daily?.night_tip_json && (
        <NightTipCard tip={goalState.daily.night_tip_json} locale={GOAL_LOCALE} />
      )}
      <SmartInsightCard
        insight={state.activeInsight}
        onAccept={state.handleAcceptInsight}
        onAdjust={state.handleAdjustInsight}
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
        sleepNeedsProfile={state.sleepNeedsProfile}
        latestLastNapEndAt={state.latestLastNapEndAt}
      />
      <PhysiologicalTimeline
        physiologicalDateDisplay={`Doba: ${state.physiologicalDateDisplay}`}
        morningWakeTimeDisplay={state.morningWakeTimeDisplay}
        events={state.timelineEvents}
      />
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
