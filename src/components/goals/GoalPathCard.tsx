import { Check, ChevronDown, Info, Pause, Play, Target } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import {
  type CopyLocale,
  describeTask,
  describeTaskShort,
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
 * Zlicza dziś odhaczone zadania celu (do bąbelka na pulpicie).
 *
 * @param {GoalDailyTaskRecord | null} daily - Zadania dnia
 * @returns {{ done: number; total: number }} Liczba odhaczonych i wszystkich zadań
 */
export function countGoalTasks(daily: GoalDailyTaskRecord | null): {
  done: number;
  total: number;
} {
  const tasks = daily?.tasks_json ?? [];
  const done = tasks.filter((task, index) =>
    daily?.done_json?.includes(`${task.kind}:${index}`),
  ).length;
  return { done, total: tasks.length };
}

/**
 * Zawartość zakładki „Cel” w arkuszu szczegółów: postęp planu, zadania do odhaczenia,
 * zwinięte rady coacha oraz wstrzymanie i zakończenie celu.
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
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const tasks = daily?.tasks_json ?? [];

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-start gap-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <h2 className="text-base font-semibold text-ink leading-tight">
              {localize(GOAL_TITLES[goal.goal_type], locale)}
            </h2>
            <p className="text-sm text-slate-400">
              {t("goal.card.day", {
                method: localize(METHOD_TITLES[goal.method], locale),
                day,
                total,
              })}
            </p>
          </div>
        </div>
      </header>

      <div className="h-1.5 rounded-full bg-[#1E2738] overflow-hidden" aria-hidden>
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-violet-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {isPaused && <p className="text-sm text-violet-300">{t("goal.card.paused")}</p>}

      {!isPaused && coach && (
        <>
          <p className="text-sm font-medium text-amber-200">{coach.headline}</p>
          {tasks.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {tasks.map((task, index) => {
                const key = `${task.kind}:${index}`;
                const done = daily?.done_json?.includes(key) ?? false;
                const isExpanded = expandedTask === key;
                return (
                  <li
                    key={key}
                    className={`rounded-xl border ${done ? "bg-emerald-950/30 border-emerald-500/30" : "bg-[#1E2738] border-[#263348]"}`}
                  >
                    <div className="flex items-stretch">
                      <button
                        type="button"
                        onClick={() => onToggleTask(key)}
                        aria-pressed={done}
                        className={`flex-1 flex items-center gap-2.5 text-left p-2.5 min-h-[48px] ${done ? "text-slate-400" : "text-ink"}`}
                      >
                        <span
                          className={`w-6 h-6 shrink-0 rounded-md border flex items-center justify-center ${done ? "bg-emerald-500 border-emerald-500 text-slate-950" : "border-slate-500"}`}
                        >
                          {done && <Check className="w-4 h-4" />}
                        </span>
                        <span className={`text-sm leading-snug ${done ? "line-through" : ""}`}>
                          {describeTaskShort(task, locale)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedTask(isExpanded ? null : key)}
                        aria-expanded={isExpanded}
                        aria-label={t("bubble.goal.how")}
                        className="w-12 shrink-0 flex items-center justify-center text-slate-400"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </div>
                    {isExpanded && (
                      <p className="px-3 pb-3 text-sm text-slate-300 leading-snug">
                        {describeTask(task, locale)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">{t("bubble.goal.noTasks")}</p>
          )}
          <details className="text-sm text-slate-300">
            <summary className="cursor-pointer flex items-center gap-1 list-none min-h-[44px] text-slate-400">
              <ChevronDown className="w-4 h-4" /> {t("bubble.goal.advice")}
            </summary>
            <div className="flex flex-col gap-2 pb-1">
              {coach.todayAdvice.length > 0 && (
                <ul className="list-disc pl-5 flex flex-col gap-1">
                  {coach.todayAdvice.map((advice) => (
                    <li key={advice}>{advice}</li>
                  ))}
                </ul>
              )}
              <p className="text-violet-300">
                {coach.encouragement}
                {reasonText && localize(reasonText, locale) !== coach.encouragement
                  ? ` ${localize(reasonText, locale)}`
                  : ""}
              </p>
              {progressNote && !isTargetMet && <p className="text-slate-400">{progressNote}</p>}
              {coach.why && <p className="text-slate-400">{coach.why}</p>}
            </div>
          </details>
          {isTargetMet && (
            <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/30 p-2.5 flex flex-col gap-2">
              <p className="text-sm text-emerald-200">{t("goal.card.confirmQuestion")}</p>
              <button
                type="button"
                onClick={() => onChangeStatus("achieved")}
                className="self-start px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 text-sm font-semibold min-h-[48px]"
              >
                {t("goal.card.confirmAchieved")}
              </button>
            </div>
          )}
        </>
      )}

      {!isPaused && !coach && (
        <p className={`text-sm ${error ? "text-red-300" : "text-slate-400"}`}>
          {error ?? t("goal.card.preparing")}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => onChangeStatus(isPaused ? "active" : "paused")}
          className="min-h-[44px] px-3 rounded-xl bg-[#1E2738] border border-[#263348] text-sm text-slate-300 flex items-center gap-1.5"
        >
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          {isPaused ? t("goal.card.resume") : t("goal.card.pause")}
        </button>
        <button
          type="button"
          onClick={() => onChangeStatus("abandoned")}
          className="min-h-[44px] px-2 text-sm text-slate-400 underline"
        >
          {t("goal.card.end")}
        </button>
      </div>
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
