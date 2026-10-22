import { useEffect, useState } from "react";
import { authorizedFetch } from "@/lib/client-data";
import type { GoalProgressSeries } from "@/lib/goals-engine/progress";
import type { ChildGoalRecord } from "@/lib/types/database";

export interface GoalProgressData {
  readonly goals: readonly ChildGoalRecord[];
  readonly featured: ChildGoalRecord | null;
  readonly series: GoalProgressSeries | null;
}

export type GoalProgressStatus = "loading" | "ready" | "error";

/**
 * Pobiera serię postępu bieżącego (lub ostatniego) celu dziecka dla sekcji „Postęp celu”.
 *
 * @param {string | undefined} childId - Aktywne dziecko
 * @returns {{ status: GoalProgressStatus; data: GoalProgressData | null }} Stan i dane
 */
export function useGoalProgress(childId: string | undefined) {
  const [status, setStatus] = useState<GoalProgressStatus>("loading");
  const [data, setData] = useState<GoalProgressData | null>(null);

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const response = await authorizedFetch(
          `/api/goals/progress?childId=${encodeURIComponent(childId)}`,
        );
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error ?? `HTTP ${response.status}`);
        if (cancelled) return;
        setData(json as GoalProgressData);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childId]);

  return { status, data };
}
