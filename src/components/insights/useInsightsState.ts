import { useEffect, useState } from "react";
import { pb } from "@/lib/pocketbase";
import type { ChildInsightRecord } from "@/lib/types/database";
import { INITIAL_MOCK_INSIGHTS } from "./constants";
import type { InsightCorrectionFormValues } from "./types";

export const DEFAULT_CHILD_ID = "child_leo_01";

/**
 * Filtruje listę wniosków na aktywne, hipotezy i wpisy historyczne.
 *
 * @param {readonly ChildInsightRecord[]} allInsights - Wszystkie rekordy wniosków
 * @returns {object} Pogrupowane wnioski
 */
function partitionInsights(allInsights: readonly ChildInsightRecord[]) {
  const activeInsights = allInsights.filter(
    (item) => item.status === "active" || item.status === "validated",
  );
  const hypothesisInsights = allInsights.filter((item) => item.status === "hypothesis");
  const historyTimelineInsights = allInsights.filter(
    (item) => item.status === "superseded" || item.status === "corrected_by_parent",
  );

  return { activeInsights, hypothesisInsights, historyTimelineInsights };
}

/**
 * Hook zarządzający stanem widoku Karta Rozwoju Snu Dziecka oraz komunikacją z API.
 *
 * @param {string} [childId=DEFAULT_CHILD_ID] - Identyfikator aktywnego dziecka
 * @returns {object} Zestaw danych i operacji dla interfejsu wniosków
 */
export function useInsightsState(childId = DEFAULT_CHILD_ID) {
  const [allInsights, setAllInsights] =
    useState<readonly ChildInsightRecord[]>(INITIAL_MOCK_INSIGHTS);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [selectedCorrectionInsight, setSelectedCorrectionInsight] =
    useState<ChildInsightRecord | null>(null);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);

  useEffect(() => {
    async function loadFromPocketBase() {
      try {
        const records = await pb.collection("child_insights").getList<ChildInsightRecord>(1, 50, {
          filter: pb.filter("child_id = {:childId}", { childId }),
          sort: "-created",
        });
        if (records.items.length > 0) {
          setAllInsights(records.items);
        }
      } catch {
        // Fallback do INITIAL_MOCK_INSIGHTS w trybie offline
      }
    }
    loadFromPocketBase();
  }, [childId]);

  const handleOpenCorrection = (insight: ChildInsightRecord) => {
    setSelectedCorrectionInsight(insight);
    setIsCorrectionModalOpen(true);
  };

  const handleAcceptInsight = async (insightId: string) => {
    setAllInsights((prev) =>
      prev.map((item) =>
        item.id === insightId
          ? { ...item, status: "validated", parent_feedback: "accepted" }
          : item,
      ),
    );

    try {
      await fetch("/api/ai/correct-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insightId, feedback: "accepted" }),
      });
    } catch {
      // Optymistyczna zmiana stanu lokalnego
    }
  };

  const handleSubmitCorrection = async (values: InsightCorrectionFormValues) => {
    if (!selectedCorrectionInsight) return;
    const targetId = selectedCorrectionInsight.id;

    setAllInsights((prev) =>
      prev.map((item) =>
        item.id === targetId
          ? {
              ...item,
              status: "corrected_by_parent",
              parent_feedback: values.feedback,
              parent_correction_note: values.parentCorrectionNote,
              algorithm_override_json:
                values.wakeWindowOffsetMinutes !== 0
                  ? { wwOffsetMin: values.wakeWindowOffsetMinutes }
                  : item.algorithm_override_json,
            }
          : item,
      ),
    );

    try {
      await fetch("/api/ai/correct-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insightId: targetId,
          feedback: values.feedback,
          parentCorrectionNote: values.parentCorrectionNote,
          isAnomalyException: values.isAnomalyException,
          algorithmOverrideJson:
            values.wakeWindowOffsetMinutes !== 0
              ? { wwOffsetMin: values.wakeWindowOffsetMinutes }
              : undefined,
        }),
      });
    } catch {
      // Stan lokalny zaktualizowany optymistycznie
    }
  };

  const handleTriggerAiEvaluation = async () => {
    setIsEvaluating(true);
    try {
      const response = await fetch("/api/ai/evaluate-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId }),
      });
      const data = await response.json();
      if (data.success && data.insight) {
        setAllInsights((prev) => [data.insight, ...prev]);
      }
    } catch {
      // Ignorowanie błędu w trybie offline
    } finally {
      setIsEvaluating(false);
    }
  };

  const { activeInsights, hypothesisInsights, historyTimelineInsights } =
    partitionInsights(allInsights);

  return {
    activeInsights,
    hypothesisInsights,
    historyTimelineInsights,
    isEvaluating,
    selectedCorrectionInsight,
    isCorrectionModalOpen,
    handleOpenCorrection,
    handleCloseCorrection: () => setIsCorrectionModalOpen(false),
    handleAcceptInsight,
    handleSubmitCorrection,
    handleTriggerAiEvaluation,
  };
}
