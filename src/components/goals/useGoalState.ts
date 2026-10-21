"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { authorizedFetch } from "@/lib/client-data";
import type { CopyLocale } from "@/lib/goal-copy";
import { pb } from "@/lib/pocketbase";
import type { ChildGoalRecord, GoalDailyTaskRecord } from "@/lib/types/database";

export type GoalLoadStatus = "idle" | "loading" | "ready" | "error";

interface UseGoalStateArgs {
  readonly childId: string | undefined;
  /** Doba fizjologiczna dashboardu (null, dopóki zegar klienta nie jest gotowy). */
  readonly physiologicalDate: string | null;
  readonly locale: CopyLocale;
  readonly enabled: boolean;
}

/**
 * Ładuje aktywny cel dziecka oraz dzienne zadania i rady coacha (generowane raz na dobę).
 *
 * @param {UseGoalStateArgs} args - Dziecko, doba, język i flaga włączenia (wyłączona w trybie demo)
 * @returns {object} Cel, zadania dnia, status ładowania i akcje
 */
export function useGoalState({ childId, physiologicalDate, locale, enabled }: UseGoalStateArgs) {
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const [goal, setGoal] = useState<ChildGoalRecord | null>(null);
  const [daily, setDaily] = useState<GoalDailyTaskRecord | null>(null);
  const [status, setStatus] = useState<GoalLoadStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !childId) return;
    let cancelled = false;
    setStatus("loading");
    setError(null);
    pb.collection("child_goals")
      .getList<ChildGoalRecord>(1, 1, {
        filter: pb.filter("child_id = {:childId} && (status = 'active' || status = 'paused')", {
          childId,
        }),
        sort: "-created",
      })
      .then((result) => {
        if (cancelled) return;
        setGoal(result.items[0] ?? null);
        setStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : tRef.current("goal.error.load"));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [childId, enabled]);

  const goalId = goal?.id;
  const goalIsActive = goal?.status === "active";

  useEffect(() => {
    if (!goalId || !goalIsActive || !physiologicalDate) return;
    let cancelled = false;
    (async () => {
      try {
        const existing = await pb
          .collection("goal_daily_tasks")
          .getList<GoalDailyTaskRecord>(1, 1, {
            filter: pb.filter("goal_id = {:goalId} && physiological_date = {:date}", {
              goalId,
              date: physiologicalDate,
            }),
          });
        if (cancelled) return;
        if (existing.items[0]) {
          setDaily(existing.items[0]);
          return;
        }
        const response = await authorizedFetch("/api/ai/goal-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goalId, locale }),
        });
        const json = await response.json();
        if (cancelled) return;
        if (!response.ok || !json.success) throw new Error(json.error ?? `HTTP ${response.status}`);
        setDaily(json.daily as GoalDailyTaskRecord);
        setGoal(json.goal as ChildGoalRecord);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : tRef.current("goal.error.daily"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [goalId, goalIsActive, physiologicalDate, locale]);

  const toggleTask = useCallback(
    async (taskKey: string) => {
      if (!daily) return;
      const done = daily.done_json ?? [];
      const next = done.includes(taskKey) ? done.filter((k) => k !== taskKey) : [...done, taskKey];
      setDaily({ ...daily, done_json: next });
      try {
        await pb.collection("goal_daily_tasks").update(daily.id, { done_json: next });
      } catch (e) {
        setDaily(daily);
        setError(e instanceof Error ? e.message : tRef.current("goal.error.task"));
      }
    },
    [daily],
  );

  const changeStatus = useCallback(
    async (next: "active" | "paused" | "abandoned" | "achieved") => {
      if (!goal) return;
      try {
        const response = await authorizedFetch("/api/goals/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goalId: goal.id, status: next }),
        });
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error ?? `HTTP ${response.status}`);
        const isClosed = next === "abandoned" || next === "achieved";
        setGoal(isClosed ? null : (json.goal as ChildGoalRecord));
        if (isClosed) setDaily(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : tRef.current("goal.error.status"));
      }
    },
    [goal],
  );

  return { goal, daily, status, error, toggleTask, changeStatus };
}
