"use client";

import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { authorizedFetch, loadActiveChild } from "@/lib/client-data";
import {
  BLOCKER_TEXT,
  type CopyLocale,
  describeTask,
  GOAL_SUMMARIES,
  GOAL_TITLES,
  localize,
  METHOD_DESCRIPTIONS,
  METHOD_TITLES,
  RED_FLAGS,
  WARNING_TEXT,
} from "@/lib/goal-copy";
import { GOAL_CATALOG, METHOD_CATALOG } from "@/lib/goals-engine/catalog";
import { buildDailyTasks } from "@/lib/goals-engine/dailyTasks";
import type { GoalMethod, GoalPlan, GoalType, ReadinessResult } from "@/lib/goals-engine/types";
import type { ChildRecord } from "@/lib/types/database";

const LOCALE: CopyLocale = "pl";
const GOALS: readonly GoalType[] = [
  "reduce_night_wakings",
  "night_weaning",
  "independent_sleep_onset",
];
const PLAN_PREVIEW_STEPS = 4;

type Step = "goal" | "method" | "check";

interface PreviewResponse {
  readonly readiness: ReadinessResult;
  readonly plan: GoalPlan;
}

/**
 * Kreator celu: wybór celu → metody → czerwone flagi, gotowość i podgląd planu → start.
 *
 * @returns {JSX.Element} Strona /goals/new
 */
export default function NewGoalPage() {
  const router = useRouter();
  const [child, setChild] = useState<ChildRecord | null>(null);
  const [step, setStep] = useState<Step>("goal");
  const [goal, setGoal] = useState<GoalType | null>(null);
  const [method, setMethod] = useState<GoalMethod | null>(null);
  const [redFlagsAck, setRedFlagsAck] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    loadActiveChild()
      .then(setChild)
      .catch((e) => setError(e instanceof Error ? e.message : "Nie udało się pobrać dziecka."));
  }, []);

  const fetchPreview = useCallback(async () => {
    if (!child || !goal || !method) return;
    try {
      const response = await authorizedFetch("/api/goals/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId: child.id,
          goal,
          method,
          redFlagsAcknowledged: redFlagsAck,
          locale: LOCALE,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error ?? `HTTP ${response.status}`);
      setPreview({ readiness: json.readiness, plan: json.plan });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się sprawdzić gotowości.");
    }
  }, [child, goal, method, redFlagsAck]);

  useEffect(() => {
    if (step === "check") void fetchPreview();
  }, [step, fetchPreview]);

  const startGoal = async () => {
    if (!child || !goal || !method) return;
    setIsStarting(true);
    try {
      const response = await authorizedFetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId: child.id,
          goal,
          method,
          redFlagsAcknowledged: redFlagsAck,
          locale: LOCALE,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error ?? `HTTP ${response.status}`);
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się rozpocząć celu.");
      setIsStarting(false);
    }
  };

  const goBack = () => {
    setPreview(null);
    setStep(step === "check" ? "method" : "goal");
  };

  return (
    <main className="w-full flex flex-col gap-4 pb-8">
      <header className="flex items-center gap-2 pt-1">
        {step === "goal" ? (
          <Link href="/dashboard" className="p-1.5 text-slate-400" aria-label="Wróć">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        ) : (
          <button type="button" onClick={goBack} className="p-1.5 text-slate-400" aria-label="Wróć">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-base font-semibold text-slate-100">Nowy cel snu</h1>
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-300">
          {error}
        </p>
      )}

      {step === "goal" && (
        <section className="flex flex-col gap-2.5">
          <p className="text-sm text-slate-400">Co chcesz osiągnąć?</p>
          {GOALS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                setGoal(g);
                setMethod(null);
                setStep("method");
              }}
              className="text-left rounded-2xl bg-[#151B28] border border-[#263348] hover:border-amber-500/40 p-3.5 min-h-[64px]"
            >
              <span className="block text-sm font-semibold text-amber-200">
                {localize(GOAL_TITLES[g], LOCALE)}
              </span>
              <span className="block text-xs text-slate-400 pt-0.5">
                {localize(GOAL_SUMMARIES[g], LOCALE)}
              </span>
            </button>
          ))}
        </section>
      )}

      {step === "method" && goal && (
        <section className="flex flex-col gap-2.5">
          <p className="text-sm text-slate-400">
            Wybierz metodę — to Ty decydujesz, jak stanowczo.
          </p>
          {GOAL_CATALOG[goal].methods.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMethod(m);
                setStep("check");
              }}
              className="text-left rounded-2xl bg-[#151B28] border border-[#263348] hover:border-violet-500/40 p-3.5 min-h-[64px]"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                {localize(METHOD_TITLES[m], LOCALE)}
                {METHOD_CATALOG[m].isFirm && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-300">
                    stanowcza · od 6 mies.
                  </span>
                )}
              </span>
              <span className="block text-xs text-slate-400 pt-0.5">
                {localize(METHOD_DESCRIPTIONS[m], LOCALE)}
              </span>
            </button>
          ))}
        </section>
      )}

      {step === "check" && goal && method && (
        <section className="flex flex-col gap-3">
          <div className="rounded-2xl bg-[#151B28] border border-[#263348] p-3.5 flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-100">Zanim zaczniemy</h2>
            <p className="text-xs text-slate-400">
              Spanko nie zastępuje porady lekarskiej. Jeśli cokolwiek z poniższych Cię dotyczy,
              porozmawiaj najpierw z pediatrą:
            </p>
            <ul className="list-disc pl-4 text-xs text-slate-300 flex flex-col gap-1">
              {RED_FLAGS.map((flag) => (
                <li key={flag.pl}>{localize(flag, LOCALE)}</li>
              ))}
            </ul>
            <label className="flex items-start gap-2.5 pt-1 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={redFlagsAck}
                onChange={(e) => setRedFlagsAck(e.target.checked)}
                className="mt-0.5 w-5 h-5 accent-amber-500"
              />
              <span className="text-xs text-slate-200">
                Żaden z powyższych sygnałów mnie nie dotyczy.
              </span>
            </label>
          </div>

          {preview && (
            <>
              {preview.readiness.blockers
                .filter((b) => b !== "RED_FLAGS_NOT_ACKNOWLEDGED" || redFlagsAck)
                .map((blocker) => (
                  <p
                    key={blocker}
                    className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-200"
                  >
                    {localize(BLOCKER_TEXT[blocker], LOCALE)}
                  </p>
                ))}
              {preview.readiness.warnings.map((warning) => (
                <p
                  key={warning}
                  className="rounded-xl bg-violet-500/10 border border-violet-500/20 px-3 py-2 text-xs text-violet-200"
                >
                  {localize(WARNING_TEXT[warning], LOCALE)}
                </p>
              ))}

              <div className="rounded-2xl bg-[#151B28] border border-[#263348] p-3.5 flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-slate-100">
                  Plan: {preview.plan.totalDays} dni
                </h2>
                <ol className="flex flex-col gap-1.5">
                  {preview.plan.steps.slice(0, PLAN_PREVIEW_STEPS).map((planStep, index) => {
                    const task = buildDailyTasks(preview.plan, index)[0];
                    return (
                      <li key={planStep.fromDay} className="text-xs text-slate-300">
                        <span className="font-mono text-amber-300">
                          dni {planStep.fromDay}–{planStep.toDay}:
                        </span>{" "}
                        {task ? describeTask(task, LOCALE) : ""}
                      </li>
                    );
                  })}
                </ol>
              </div>

              <button
                type="button"
                disabled={!preview.readiness.ready || isStarting}
                onClick={startGoal}
                className="w-full py-3.5 rounded-2xl bg-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 min-h-[52px]"
              >
                <Check className="w-4 h-4" /> Zaczynamy
              </button>
            </>
          )}
        </section>
      )}
    </main>
  );
}
