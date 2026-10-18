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

  return (
    <main className="w-full flex flex-col gap-3 pb-8">
      <DashboardHeader
        child={state.child}
        ageDisplay={state.ageDisplay}
        onSelectDayMode={state.handleSelectDayMode}
        onToggleAntiOrthosomnia={state.handleToggleAntiOrthosomnia}
      />
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
        isAntiOrthosomnia={state.child.anti_orthosomnia_mode}
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
        physiologicalDateDisplay="Doba: Poniedziałek, 18 października"
        morningWakeTimeDisplay="07:15"
        events={state.timelineEvents}
      />
      <FloatingActionBar
        currentSleepLog={state.currentSleepLog}
        onCycleSleepStatus={state.handleCycleSleepStatus}
        onQuickNightWake={state.handleQuickNightWake}
        onOpenQuickEntry={() => setIsQuickEntryOpen(true)}
      />
      <QuickEntryBottomSheet
        isOpen={isQuickEntryOpen}
        onClose={() => setIsQuickEntryOpen(false)}
        onSaveFeeding={state.handleSaveFeeding}
        onSaveMoodAndIntervention={state.handleSaveMoodAndIntervention}
        onSaveDayTag={state.handleSaveDayTag}
      />
    </main>
  );
}
