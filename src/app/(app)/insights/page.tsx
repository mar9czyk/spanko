"use client";

import type { ReactNode } from "react";
import { ActiveInsightsSection } from "@/components/insights/ActiveInsightsSection";
import { GoalProgressSection } from "@/components/insights/GoalProgressSection";
import { HypothesesSection } from "@/components/insights/HypothesesSection";
import { InsightCorrectionModal } from "@/components/insights/InsightCorrectionModal";
import { InsightsHeader } from "@/components/insights/InsightsHeader";
import { InsightsTimelineSection } from "@/components/insights/InsightsTimelineSection";
import { SafeSleepNotice } from "@/components/insights/SafeSleepNotice";
import { SleepFoundationsCard } from "@/components/insights/SleepFoundationsCard";
import { useInsightsState } from "@/components/insights/useInsightsState";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * Widok Karta Rozwoju Snu Dziecka + Kalendarz Historii Ewolucji Wniosków (/insights).
 *
 * @description
 * Prezentuje aktywne reguły adaptacyjne silnika snu, hipotezy w trakcie zbierania danych
 * oraz pełną oś czasu ewolucji wzorców i korekt wprowadzonych przez rodzica.
 *
 * @returns {ReactNode} Wyrenderowana strona wniosków
 */
export default function InsightsPage(): ReactNode {
  const { t } = useI18n();
  const {
    child,
    loadStatus,
    errorMessage,
    activeInsights,
    hypothesisInsights,
    historyTimelineInsights,
    isEvaluating,
    selectedCorrectionInsight,
    isCorrectionModalOpen,
    handleOpenCorrection,
    handleCloseCorrection,
    handleAcceptInsight,
    handleUndoAcceptInsight,
    handleSubmitCorrection,
    handleTriggerAiEvaluation,
  } = useInsightsState();

  return (
    <main className="w-full flex flex-col gap-4 pb-8">
      <InsightsHeader isEvaluating={isEvaluating} onTriggerEvaluation={handleTriggerAiEvaluation} />

      {errorMessage && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
        >
          {errorMessage}
        </p>
      )}
      {loadStatus === "loading" && (
        <p className="text-sm text-slate-400">{t("insights.loading")}</p>
      )}
      {loadStatus === "empty" && <p className="text-sm text-slate-400">{t("dashboard.noChild")}</p>}

      <SafeSleepNotice child={child} />
      <GoalProgressSection child={child} />
      <SleepFoundationsCard child={child} />

      <ActiveInsightsSection
        insights={activeInsights}
        onAccept={handleAcceptInsight}
        onUndoAccept={handleUndoAcceptInsight}
        onOpenCorrection={handleOpenCorrection}
      />

      <HypothesesSection hypotheses={hypothesisInsights} />

      <InsightsTimelineSection historyInsights={historyTimelineInsights} />

      <InsightCorrectionModal
        insight={selectedCorrectionInsight}
        isOpen={isCorrectionModalOpen}
        onClose={handleCloseCorrection}
        onSubmitCorrection={handleSubmitCorrection}
      />
    </main>
  );
}
