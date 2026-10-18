import { useCallback, useEffect, useState } from "react";
import { authorizedFetch, loadActiveChild } from "@/lib/client-data";
import { pb } from "@/lib/pocketbase";
import type { ChildInsightRecord, ChildRecord } from "@/lib/types/database";
import type { InsightCorrectionFormValues } from "./types";

export type InsightsLoadStatus = "loading" | "ready" | "empty" | "error";

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
 * @description
 * Ładuje aktywne dziecko gospodarstwa i jego wnioski z PocketBase. Przy braku danych lub błędzie
 * udostępnia jawny status (`empty` / `error`) zamiast danych zastępczych.
 *
 * @returns {object} Zestaw danych i operacji dla interfejsu wniosków
 */
export function useInsightsState() {
  const [child, setChild] = useState<ChildRecord | null>(null);
  const [loadStatus, setLoadStatus] = useState<InsightsLoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [allInsights, setAllInsights] = useState<readonly ChildInsightRecord[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [selectedCorrectionInsight, setSelectedCorrectionInsight] =
    useState<ChildInsightRecord | null>(null);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);

  const loadInsights = useCallback(async () => {
    try {
      const activeChild = await loadActiveChild();
      setChild(activeChild);
      if (!activeChild) {
        setAllInsights([]);
        setLoadStatus("empty");
        return;
      }
      const records = await pb.collection("child_insights").getList<ChildInsightRecord>(1, 50, {
        filter: pb.filter("child_id = {:childId}", { childId: activeChild.id }),
        sort: "-created",
      });
      setAllInsights(records.items);
      setLoadStatus("ready");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nie udało się pobrać wniosków.");
      setLoadStatus("error");
    }
  }, []);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  /**
   * Wysyła korektę wniosku do API; przy niepowodzeniu przywraca stan z serwera.
   */
  const postCorrection = async (body: Record<string, unknown>) => {
    try {
      const response = await authorizedFetch("/api/ai/correct-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nie udało się zapisać korekty.");
      await loadInsights();
    }
  };

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

    await postCorrection({ insightId, feedback: "accepted" });
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

    await postCorrection({
      insightId: targetId,
      feedback: values.feedback,
      parentCorrectionNote: values.parentCorrectionNote,
      isAnomalyException: values.isAnomalyException,
      algorithmOverrideJson:
        values.wakeWindowOffsetMinutes !== 0
          ? { wwOffsetMin: values.wakeWindowOffsetMinutes }
          : undefined,
    });
  };

  const handleTriggerAiEvaluation = async () => {
    if (!child) return;
    setIsEvaluating(true);
    setErrorMessage(null);
    try {
      const response = await authorizedFetch("/api/ai/evaluate-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: child.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      await loadInsights();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Ewaluacja AI nie powiodła się.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const { activeInsights, hypothesisInsights, historyTimelineInsights } =
    partitionInsights(allInsights);

  return {
    loadStatus,
    errorMessage,
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
