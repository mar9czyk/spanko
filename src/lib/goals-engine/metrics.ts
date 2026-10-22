/**
 * Budowanie dobowych metryk celów z logów snu i karmień oraz wyliczanie punktu odniesienia.
 */

import { hasDayTag } from "../sleep-engine/dayTags";
import { type FeedingEvent, summarizeNightFeedings } from "../sleep-engine/feedingSignals";
import { parseTimestampToMilliseconds } from "../sleep-engine/physiologicalDay";
import type { InterventionType, SleepLog } from "../sleep-engine/types";
import { BASELINE_WINDOW_DAYS, ILLNESS_TAGS, rungForIntervention } from "./catalog";
import type { DailyGoalMetrics, GoalBaseline, InterventionRung } from "./types";

const MS_PER_MINUTE = 60_000;

export interface DailyMetricsInput {
  readonly date: string;
  readonly nightLog?: SleepLog;
  readonly feedings: readonly FeedingEvent[];
  readonly tags: readonly string[];
}

function mode<T>(values: readonly T[]): T | null {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Buduje metryki jednej doby fizjologicznej dla Silnika Celów.
 *
 * @param {DailyMetricsInput} input - Sen nocny, karmienia i tagi doby
 * @returns {DailyGoalMetrics} Metryki doby
 */
export function buildDailyGoalMetrics(input: DailyMetricsInput): DailyGoalMetrics {
  const { date, nightLog, feedings, tags } = input;
  const illness = ILLNESS_TAGS.some((key) => hasDayTag(tags, key));
  if (nightLog?.status !== "completed" || !nightLog.wokeUpAt) {
    return {
      date,
      hasData: false,
      nightWakings: 0,
      nightFeedCount: 0,
      nightMilkMl: 0,
      sleepOnsetLatencyMin: null,
      independentOnset: null,
      dominantIntervention: null,
      illness,
    };
  }

  const fedWakings = nightLog.nightWakings.filter((w) => w.fedMilk).length;
  const nightFeedings = summarizeNightFeedings(feedings, nightLog.fellAsleepAt, nightLog.wokeUpAt);
  const latency = Math.max(
    0,
    Math.round(
      (parseTimestampToMilliseconds(nightLog.fellAsleepAt) -
        parseTimestampToMilliseconds(nightLog.putDownAt)) /
        MS_PER_MINUTE,
    ),
  );
  const interventions: InterventionType[] = [
    ...nightLog.interventions,
    ...nightLog.nightWakings.flatMap((w) => w.interventions),
  ];

  return {
    date,
    hasData: true,
    nightWakings: nightLog.nightWakings.length,
    nightFeedCount: Math.max(nightFeedings.count, fedWakings),
    nightMilkMl: nightFeedings.totalMl,
    sleepOnsetLatencyMin: latency,
    independentOnset: nightLog.interventions.includes("independent"),
    dominantIntervention: mode(interventions),
    illness,
  };
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Punkt odniesienia z ostatnich 7 zdrowych dób z danymi.
 *
 * @param {readonly DailyGoalMetrics[]} days - Doby rosnąco po dacie
 * @returns {GoalBaseline} Średnie startowe
 */
export function computeBaseline(days: readonly DailyGoalMetrics[]): GoalBaseline {
  const usable = days.filter((d) => d.hasData && !d.illness).slice(-BASELINE_WINDOW_DAYS);
  const latencies = usable
    .map((d) => d.sleepOnsetLatencyMin)
    .filter((v): v is number => v !== null);
  const rungs = usable
    .map((d) => d.dominantIntervention)
    .filter((v): v is InterventionType => v !== null)
    .map(rungForIntervention);
  const dominant: InterventionRung | null = mode(rungs);
  return {
    dayCount: usable.length,
    avgNightWakings: average(usable.map((d) => d.nightWakings)),
    avgNightFeedCount: average(usable.map((d) => d.nightFeedCount)),
    avgNightMilkMl: average(usable.map((d) => d.nightMilkMl)),
    avgLatencyMin: latencies.length ? average(latencies) : null,
    dominantRung: dominant,
  };
}
