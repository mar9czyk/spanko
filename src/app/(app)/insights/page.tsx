"use client";

import type { ReactNode } from "react";
import { ActiveInsightsSection } from "@/components/insights/ActiveInsightsSection";
import { HypothesesSection } from "@/components/insights/HypothesesSection";
import { InsightCorrectionModal } from "@/components/insights/InsightCorrectionModal";
import { InsightsHeader } from "@/components/insights/InsightsHeader";
import { InsightsTimelineSection } from "@/components/insights/InsightsTimelineSection";
import { useInsightsState } from "@/components/insights/useInsightsState";

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
  const {
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
      {loadStatus === "loading" && <p className="text-sm text-slate-400">Ładowanie wniosków…</p>}
      {loadStatus === "empty" && (
        <p className="text-sm text-slate-400">
          Nie dodano jeszcze dziecka do Twojego gospodarstwa domowego.
        </p>
      )}

      <ActiveInsightsSection
        insights={activeInsights}
        onAccept={handleAcceptInsight}
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
