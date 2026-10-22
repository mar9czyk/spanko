import type PocketBase from "pocketbase";
import { z } from "zod";
import { BASELINE_WINDOW_DAYS } from "@/lib/goals-engine/catalog";
import { buildDailyGoalMetrics, computeBaseline } from "@/lib/goals-engine/metrics";
import { generatePlan } from "@/lib/goals-engine/plans";
import { evaluateReadiness } from "@/lib/goals-engine/readiness";
import type {
  DailyGoalMetrics,
  GoalBaseline,
  GoalPlan,
  ReadinessResult,
} from "@/lib/goals-engine/types";
import { ApiAuthError } from "@/lib/server/auth";
import { mapRecordToSleepLog } from "@/lib/server/sleepLogMapper";
import {
  calculateEffectiveAgeDays,
  DEFAULT_TIME_ZONE,
  resolvePhysiologicalDate,
} from "@/lib/sleep-engine";
import type { FeedingEvent } from "@/lib/sleep-engine/feedingSignals";
import type { ChildRecord, DayContextRecord, SleepLogRecord } from "@/lib/types/database";

const HISTORY_DAYS = 21;
const SLEEP_LOG_LIMIT = 200;
const DAY_CONTEXT_LIMIT = 500;
const MS_PER_DAY = 86_400_000;

export const GoalSelectionSchema = z.object({
  childId: z.string().min(1),
  goal: z.enum([
    "reduce_night_wakings",
    "night_weaning",
    "independent_sleep_onset",
    "healthy_sleep_habits",
  ]),
  method: z.enum([
    "gentle_fading",
    "chair_method",
    "pick_up_put_down",
    "check_and_console",
    "extinction",
    "habit_building",
  ]),
  redFlagsAcknowledged: z.boolean().default(false),
  locale: z.enum(["pl", "en"]).default("pl"),
});

export type GoalSelection = z.infer<typeof GoalSelectionSchema>;

export interface ChildGoalContext {
  readonly child: ChildRecord;
  readonly effectiveAgeDays: number;
  readonly todayDate: string;
  readonly days: readonly DailyGoalMetrics[];
  readonly todayTags: readonly string[];
}

export interface GoalPreview {
  readonly readiness: ReadinessResult;
  readonly baseline: GoalBaseline;
  readonly plan: GoalPlan;
  readonly context: ChildGoalContext;
}

function toFeedingEvent(record: DayContextRecord): FeedingEvent | null {
  if (record.feeding_type === "none") return null;
  return {
    timestamp: record.timestamp,
    kind: record.feeding_type,
    ml: record.bottle_ml,
    breastMinutes: (record.breast_left_min ?? 0) + (record.breast_right_min ?? 0) || undefined,
  };
}

function shiftDate(date: string, days: number): string {
  return new Date(new Date(`${date}T12:00:00Z`).getTime() + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

/**
 * Ładuje dziecko i buduje dobowe metryki celów z ostatnich 21 dób.
 *
 * @param {PocketBase} pb - Klient PocketBase użytkownika
 * @param {string} childId - Identyfikator dziecka
 * @param {string} householdId - Gospodarstwo zalogowanego użytkownika
 * @throws {ApiAuthError} 404/403 gdy dziecko niedostępne
 * @returns {Promise<ChildGoalContext>} Kontekst do oceny celów
 */
export async function loadChildGoalContext(
  pb: PocketBase,
  childId: string,
  householdId: string,
): Promise<ChildGoalContext> {
  let child: ChildRecord;
  try {
    child = await pb.collection("children").getOne<ChildRecord>(childId);
  } catch {
    throw new ApiAuthError("Nie znaleziono dziecka.", 404);
  }
  if (child.household_id !== householdId) {
    throw new ApiAuthError("Brak dostępu do tego dziecka.", 403);
  }

  const nowIso = new Date().toISOString();
  const timeZone = child.timezone || DEFAULT_TIME_ZONE;
  const [logs, context] = await Promise.all([
    pb.collection("sleep_logs").getList<SleepLogRecord>(1, SLEEP_LOG_LIMIT, {
      filter: pb.filter("child_id = {:childId}", { childId }),
      sort: "-created",
    }),
    pb.collection("day_context").getList<DayContextRecord>(1, DAY_CONTEXT_LIMIT, {
      filter: pb.filter("child_id = {:childId}", { childId }),
      sort: "-timestamp",
    }),
  ]);

  const latestNight = logs.items.find((l) => l.type === "night");
  const todayDate = resolvePhysiologicalDate({
    eventTimestamp: nowIso,
    timeZone,
    activeOrRecentNightSleep: latestNight
      ? {
          physiologicalDate: latestNight.physiological_date,
          fellAsleepAt: latestNight.fell_asleep_at || latestNight.put_down_at || nowIso,
          wokeUpAt: latestNight.woke_up_at,
        }
      : null,
  });

  const feedings = context.items.map(toFeedingEvent).filter((e): e is FeedingEvent => e !== null);

  const days: DailyGoalMetrics[] = [];
  for (let offset = HISTORY_DAYS; offset >= 1; offset--) {
    const date = shiftDate(todayDate, -offset);
    const nightRecord = logs.items.find(
      (l) => l.type === "night" && l.status === "completed" && l.physiological_date === date,
    );
    days.push(
      buildDailyGoalMetrics({
        date,
        nightLog: nightRecord ? mapRecordToSleepLog(nightRecord) : undefined,
        feedings,
        tags: context.items
          .filter((c) => c.physiological_date === date)
          .flatMap((c) => c.tags ?? []),
      }),
    );
  }

  // Tryb „Choroba” nie ma historii dób, więc oznaczamy chorobą ostatnią dobę: cel się wstrzymuje
  const lastDay = days[days.length - 1];
  if (lastDay && child.active_day_mode === "illness_regression") {
    days[days.length - 1] = { ...lastDay, illness: true };
  }

  return {
    child,
    effectiveAgeDays: calculateEffectiveAgeDays(child.birth_date, child.due_date, nowIso),
    todayDate,
    days,
    todayTags: context.items
      .filter((c) => c.physiological_date === todayDate)
      .flatMap((c) => c.tags ?? []),
  };
}

/**
 * Wylicza gotowość, baseline i podgląd planu dla wybranego celu.
 *
 * @param {ChildGoalContext} context - Kontekst dziecka
 * @param {GoalSelection} selection - Wybrany cel, metoda i potwierdzenia
 * @returns {GoalPreview} Gotowość, baseline i plan
 */
export function buildGoalPreview(context: ChildGoalContext, selection: GoalSelection): GoalPreview {
  const baseline = computeBaseline(context.days.slice(-BASELINE_WINDOW_DAYS * 2));
  const readiness = evaluateReadiness({
    goal: selection.goal,
    method: selection.method,
    effectiveAgeDays: context.effectiveAgeDays,
    baseline,
    todayTags: context.todayTags,
    illnessModeActive: context.child.active_day_mode === "illness_regression",
    redFlagsAcknowledged: selection.redFlagsAcknowledged,
  });
  const plan = generatePlan({ goal: selection.goal, method: selection.method, baseline });
  return { readiness, baseline, plan, context };
}
