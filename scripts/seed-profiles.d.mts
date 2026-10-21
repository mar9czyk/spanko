import type { ProblemCategory } from "@/lib/sleep-engine/types";
import type { SleepLogRecord } from "@/lib/types/database";

type Range = readonly [number, number];

export interface SeedProfile {
  readonly key: string;
  readonly name: string;
  readonly ageDays: number;
  readonly morningWake: Range;
  readonly bedtime: Range;
  readonly nightLatency: Range;
  readonly naps: readonly { readonly wakeWindow: Range; readonly duration: Range }[];
  readonly napLatency: Range;
  readonly nightWakings: Range;
  readonly fedWakings: number;
  readonly wakingInterventions: readonly string[];
  readonly expectedCategories: readonly ProblemCategory[];
  readonly allowedCategories: readonly ProblemCategory[];
}

export const SEED_PROFILES: readonly SeedProfile[];

export function zonedIso(date: string, minutes: number, timeZone: string): string;

export function addDays(date: string, days: number): string;

export function generateProfileSleepLogs(
  profile: SeedProfile,
  options: { childId: string; today: string; days: number; timeZone: string },
): SleepLogRecord[];
