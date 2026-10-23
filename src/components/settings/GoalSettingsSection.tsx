"use client";

import { Pause, Play, Target } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { ChooseGoalCard } from "@/components/goals/GoalPathCard";
import { useGoalState } from "@/components/goals/useGoalState";
import { useI18n } from "@/i18n/I18nProvider";
import { loadActiveChild } from "@/lib/client-data";
import { GOAL_TITLES, localize, METHOD_TITLES } from "@/lib/goal-copy";
import type { ChildRecord } from "@/lib/types/database";

const MS_PER_DAY = 86_400_000;

function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayNumber(startedOn: string, today: string): number {
  const diff = Math.round(
    (new Date(`${today}T12:00:00Z`).getTime() - new Date(`${startedOn}T12:00:00Z`).getTime()) /
      MS_PER_DAY,
  );
  return Math.max(1, diff + 1);
}

/**
 * Sekcja „Cel snu” w ustawieniach: podgląd aktywnego lub wstrzymanego celu wybranego dziecka
 * (z akcjami wstrzymaj/wznów/zakończ) albo zachęta do wyboru celu, gdy dziecko go nie ma.
 *
 * @returns {ReactNode} Podgląd celu lub karta „Zacznij cel snu”
 */
export function GoalSettingsSection(): ReactNode {
  const { t, locale } = useI18n();
  const [child, setChild] = useState<ChildRecord | null>(null);
  const [childLoaded, setChildLoaded] = useState(false);

  useEffect(() => {
    loadActiveChild()
      .then(setChild)
      .catch(() => setChild(null))
      .finally(() => setChildLoaded(true));
  }, []);

  const { goal, status, error, changeStatus } = useGoalState({
    childId: child?.id,
    physiologicalDate: null,
    locale,
    enabled: childLoaded && child !== null,
  });

  if (!childLoaded || (child && (status === "idle" || status === "loading"))) {
    return <p className="text-sm text-slate-400">{t("settings.goalLoading")}</p>;
  }
  if (!child || !goal) return <ChooseGoalCard />;

  const total = goal.plan_json.totalDays;
  const day = Math.min(dayNumber(goal.started_on, localDateKey(new Date())), total);
  const isPaused = goal.status === "paused";

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <Target className="w-4 h-4 mt-1 text-amber-400 shrink-0" />
        <div>
          <h3 className="text-base font-semibold text-ink leading-tight">
            {localize(GOAL_TITLES[goal.goal_type], locale)}
          </h3>
          <p className="text-sm text-slate-400">
            {t("goal.card.day", {
              method: localize(METHOD_TITLES[goal.method], locale),
              day,
              total,
            })}
          </p>
          <p className={`text-xs mt-0.5 ${isPaused ? "text-violet-300" : "text-emerald-300"}`}>
            {isPaused ? t("settings.goalStatusPaused") : t("settings.goalStatusActive")}
          </p>
        </div>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {isPaused && <p className="text-sm text-violet-300">{t("goal.card.paused")}</p>}
      <Link
        href="/dashboard"
        className="min-h-[44px] flex items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-sm font-semibold text-amber-200"
      >
        {t("settings.goalOpenTasks")}
      </Link>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => changeStatus(isPaused ? "active" : "paused")}
          className="min-h-[44px] px-3 rounded-xl bg-[#1E2738] border border-[#263348] text-sm text-slate-300 flex items-center gap-1.5"
        >
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          {isPaused ? t("goal.card.resume") : t("goal.card.pause")}
        </button>
        <button
          type="button"
          onClick={() => changeStatus("abandoned")}
          className="min-h-[44px] px-2 text-sm text-slate-400 underline"
        >
          {t("goal.card.end")}
        </button>
      </div>
    </section>
  );
}
