import { Check, ChevronDown, Pause, Play, Target } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import {
  type CopyLocale,
  describeTask,
  GOAL_TITLES,
  localize,
  METHOD_TITLES,
  methodProgressNote,
  REASON_TEXT,
} from "@/lib/goal-copy";
import type { ChildGoalRecord, GoalDailyTaskRecord } from "@/lib/types/database";

const MS_PER_DAY = 86_400_000;
const PERCENT = 100;

interface GoalPathCardProps {
  readonly goal: ChildGoalRecord;
  readonly daily: GoalDailyTaskRecord | null;
  readonly physiologicalDate: string | null;
  readonly error?: string | null;
  readonly locale: CopyLocale;
  readonly onToggleTask: (taskKey: string) => void;
  readonly onChangeStatus: (status: "active" | "paused" | "abandoned" | "achieved") => void;
}

function dayNumber(startedOn: string, today: string | null): number {
  if (!today) return 1;
  const diff = Math.round(
    (new Date(`${today}T12:00:00Z`).getTime() - new Date(`${startedOn}T12:00:00Z`).getTime()) /
      MS_PER_DAY,
  );
  return Math.max(1, diff + 1);
}

/**
 * Karta „Ścieżka Celu”: postęp planu, zadania na dziś i rady coacha.
 *
 * @param {GoalPathCardProps} props - Cel, zadania dnia i akcje
 * @returns {ReactNode} Karta aktywnego celu
 */
export function GoalPathCard({
  goal,
  daily,
  physiologicalDate,
  error,
  locale,
  onToggleTask,
  onChangeStatus,
}: GoalPathCardProps): ReactNode {
  const { t } = useI18n();
  const total = goal.plan_json.totalDays;
  const day = Math.min(dayNumber(goal.started_on, physiologicalDate), total);
  const progress = Math.round((day / total) * PERCENT);
  const decision = daily?.progress_json;
  const isPaused = goal.status === "paused";
  const coach = daily?.coach_json;
  const reasonText = decision ? REASON_TEXT[decision.reason] : undefined;
  const isTargetMet = decision?.action === "achieved";
  const progressNote = methodProgressNote(goal.method, day, locale);

  return (
    <section className="rounded-2xl bg-[#151B28] border border-amber-500/20 p-3.5 flex flex-col gap-3">
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-ink leading-tight">
              {localize(GOAL_TITLES[goal.goal_type], locale)}
            </h2>
            <p className="text-xs text-slate-400">
              {t("goal.card.day", {
                method: localize(METHOD_TITLES[goal.method], locale),
                day,
                total,
              })}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChangeStatus(isPaused ? "active" : "paused")}
          className="p-1.5 rounded-lg bg-[#1E2738] border border-[#263348] text-slate-300"
          title={isPaused ? t("goal.card.resume") : t("goal.card.pause")}
        >
          {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
        </button>
      </header>

      <div className="h-1.5 rounded-full bg-[#1E2738] overflow-hidden" aria-hidden>
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-violet-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {isPaused && <p className="text-xs text-violet-300">{t("goal.card.paused")}</p>}

      {!isPaused && coach && (
        <>
          <p className="text-sm font-medium text-amber-200">{coach.headline}</p>
          <ul className="flex flex-col gap-1.5">
            {(daily?.tasks_json ?? []).map((task, index) => {
              const key = `${task.kind}:${index}`;
              const done = daily?.done_json?.includes(key) ?? false;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => onToggleTask(key)}
                    className={`w-full flex items-start gap-2.5 text-left p-2.5 rounded-xl border min-h-[44px] ${done ? "bg-emerald-950/30 border-emerald-500/30 text-slate-400" : "bg-[#1E2738] border-[#263348] text-ink"}`}
                  >
                    <span
                      className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border flex items-center justify-center ${done ? "bg-emerald-500 border-emerald-500 text-slate-950" : "border-slate-500"}`}
                    >
                      {done && <Check className="w-3.5 h-3.5" />}
                    </span>
                    <span className={`text-xs leading-snug ${done ? "line-through" : ""}`}>
                      {describeTask(task, locale)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {coach.todayAdvice.length > 0 && (
            <ul className="list-disc pl-4 text-xs text-slate-300 flex flex-col gap-1">
              {coach.todayAdvice.map((advice) => (
                <li key={advice}>{advice}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-violet-300">
            {coach.encouragement}
            {reasonText && localize(reasonText, locale) !== coach.encouragement
              ? ` ${localize(reasonText, locale)}`
              : ""}
          </p>
          {progressNote && !isTargetMet && <p className="text-xs text-slate-400">{progressNote}</p>}
          {isTargetMet && (
            <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/30 p-2.5 flex flex-col gap-2">
              <p className="text-xs text-emerald-200">{t("goal.card.confirmQuestion")}</p>
              <button
                type="button"
                onClick={() => onChangeStatus("achieved")}
                className="self-start px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-semibold min-h-[44px]"
              >
                {t("goal.card.confirmAchieved")}
              </button>
            </div>
          )}
          {coach.why && (
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer flex items-center gap-1 list-none">
                <ChevronDown className="w-3 h-3" /> {t("goal.card.why")}
              </summary>
              <p className="pt-1">{coach.why}</p>
            </details>
          )}
        </>
      )}

      {!isPaused && !coach && (
        <p className={`text-xs ${error ? "text-red-300" : "text-slate-400"}`}>
          {error ?? t("goal.card.preparing")}
        </p>
      )}

      <button
        type="button"
        onClick={() => onChangeStatus("abandoned")}
        className="self-end text-xs text-slate-400 underline"
      >
        {t("goal.card.end")}
      </button>
    </section>
  );
}

/**
 * Zachęta do wyboru celu, gdy dziecko nie ma aktywnego planu.
 *
 * @returns {ReactNode} Karta z linkiem do kreatora celu
 */
export function ChooseGoalCard(): ReactNode {
  const { t } = useI18n();
  return (
    <Link
      href="/goals/new"
      className="rounded-2xl bg-gradient-to-r from-amber-500/10 to-violet-500/10 border border-amber-500/30 p-3.5 flex items-center gap-3"
    >
      <Target className="w-5 h-5 text-amber-400 shrink-0" />
      <span className="text-sm text-ink">
        <strong className="block text-amber-200">{t("goal.choose.title")}</strong>
        <span className="text-xs text-slate-400">{t("goal.choose.text")}</span>
      </span>
    </Link>
  );
}
