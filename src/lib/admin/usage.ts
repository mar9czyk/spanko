import { type AiCallStat, callCostUsd, MS_PER_DAY } from "./stats";

export const USAGE_PERIODS = [7, 30, 90] as const;
export type UsagePeriod = (typeof USAGE_PERIODS)[number];

const COST_PRECISION = 10_000;
const roundCost = (value: number) => Math.round(value * COST_PRECISION) / COST_PRECISION;

export interface UsageUser {
  readonly id: string;
  readonly email: string;
  readonly household_id?: string;
  readonly last_seen_at?: string;
}

export interface UsageLog {
  readonly created: string;
  readonly created_by?: string;
}

export interface KindUsage {
  calls: number;
  costUsd: number;
}

export interface UserUsage {
  /** null = wywołania sprzed telemetrii (znamy tylko gospodarstwo) */
  readonly userId: string | null;
  readonly email: string | null;
  readonly householdId: string | null;
  readonly calls: number;
  readonly errors: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly costUsd: number;
  readonly byKind: Readonly<Record<string, KindUsage>>;
  readonly sleepLogs: number;
  readonly activeDays: number;
  readonly lastSeenAt: string | null;
  readonly lastActivityAt: string | null;
}

export interface UsageTotals {
  readonly calls: number;
  readonly tokens: number;
  readonly costUsd: number;
}

export interface UsageReport {
  readonly rows: readonly UserUsage[];
  readonly totals: UsageTotals;
}

interface Accumulator {
  userId: string | null;
  email: string | null;
  householdId: string | null;
  lastSeenAt: string | null;
  calls: number;
  errors: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  byKind: Record<string, KindUsage>;
  sleepLogs: number;
  days: Set<string>;
  lastActivityAt: string | null;
}

const newAccumulator = (
  userId: string | null,
  email: string | null,
  householdId: string | null,
  lastSeenAt: string | null,
): Accumulator => ({
  userId,
  email,
  householdId,
  lastSeenAt,
  calls: 0,
  errors: 0,
  promptTokens: 0,
  completionTokens: 0,
  costUsd: 0,
  byKind: {},
  sleepLogs: 0,
  days: new Set(),
  lastActivityAt: null,
});

const touch = (acc: Accumulator, created: string) => {
  acc.days.add(created.slice(0, 10));
  if (!acc.lastActivityAt || created > acc.lastActivityAt) acc.lastActivityAt = created;
};

const isInWindow = (created: string, nowMs: number, days: number) =>
  nowMs - new Date(created).getTime() <= days * MS_PER_DAY;

/**
 * Agreguje użycie per użytkownik z wywołań AI i wpisów snu z ostatnich `days` dni.
 *
 * @description
 * Bez wywołań `sandbox`. Wywołania bez `user_id` (sprzed telemetrii) trafiają do osobnego wiersza
 * na gospodarstwo. Koszt = `cost_usd` z OpenRouter, a gdy go brak — szacunek z tabeli cen.
 * „Dni aktywne” to różne dni UTC z wpisem snu lub wywołaniem AI użytkownika.
 *
 * @param {readonly UsageCall[]} calls - Wpisy z ai_calls
 * @param {readonly UsageLog[]} logs - Wpisy snu z autorem
 * @param {readonly UsageUser[]} users - Użytkownicy (e-mail, gospodarstwo, last_seen_at)
 * @param {number} nowMs - Bieżący czas w ms
 * @param {number} days - Długość okna w dniach
 * @returns {UsageReport} Wiersze posortowane po koszcie malejąco oraz sumy
 */
export function aggregateUsageByUser(
  calls: readonly UsageCall[],
  logs: readonly UsageLog[],
  users: readonly UsageUser[],
  nowMs: number,
  days: number,
): UsageReport {
  const byKey = new Map<string, Accumulator>();
  const usersById = new Map(users.map((user) => [user.id, user]));

  const forUser = (userId: string): Accumulator => {
    const existing = byKey.get(userId);
    if (existing) return existing;
    const user = usersById.get(userId);
    const acc = newAccumulator(
      userId,
      user?.email ?? null,
      user?.household_id ?? null,
      user?.last_seen_at || null,
    );
    byKey.set(userId, acc);
    return acc;
  };
  const forLegacyHousehold = (householdId: string | undefined): Accumulator => {
    const key = `legacy:${householdId ?? ""}`;
    const existing = byKey.get(key);
    if (existing) return existing;
    const acc = newAccumulator(null, null, householdId || null, null);
    byKey.set(key, acc);
    return acc;
  };

  for (const call of calls) {
    if (call.kind === "sandbox" || !isInWindow(call.created, nowMs, days)) continue;
    const acc = call.user_id ? forUser(call.user_id) : forLegacyHousehold(call.household_id);
    const cost = callCostUsd(call);
    acc.calls += 1;
    if (call.status !== "ok") acc.errors += 1;
    acc.promptTokens += call.prompt_tokens ?? 0;
    acc.completionTokens += call.completion_tokens ?? 0;
    acc.costUsd += cost;
    const kind = acc.byKind[call.kind] ?? { calls: 0, costUsd: 0 };
    kind.calls += 1;
    kind.costUsd += cost;
    acc.byKind[call.kind] = kind;
    touch(acc, call.created);
  }

  for (const log of logs) {
    if (!log.created_by || !isInWindow(log.created, nowMs, days)) continue;
    const acc = forUser(log.created_by);
    acc.sleepLogs += 1;
    touch(acc, log.created);
  }

  const rows: UserUsage[] = [...byKey.values()].map((acc) => ({
    userId: acc.userId,
    email: acc.email,
    householdId: acc.householdId,
    calls: acc.calls,
    errors: acc.errors,
    promptTokens: acc.promptTokens,
    completionTokens: acc.completionTokens,
    costUsd: roundCost(acc.costUsd),
    byKind: Object.fromEntries(
      Object.entries(acc.byKind).map(([kind, v]) => [
        kind,
        { calls: v.calls, costUsd: roundCost(v.costUsd) },
      ]),
    ),
    sleepLogs: acc.sleepLogs,
    activeDays: acc.days.size,
    lastSeenAt: acc.lastSeenAt,
    lastActivityAt: acc.lastActivityAt,
  }));
  rows.sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls);

  return {
    rows,
    totals: {
      calls: rows.reduce((sum, r) => sum + r.calls, 0),
      tokens: rows.reduce((sum, r) => sum + r.promptTokens + r.completionTokens, 0),
      costUsd: roundCost(rows.reduce((sum, r) => sum + r.costUsd, 0)),
    },
  };
}

export interface UserDailyPoint {
  readonly date: string;
  readonly calls: number;
  readonly costUsd: number;
  readonly sleepLogs: number;
}

/**
 * Seria dzienna (UTC) jednego użytkownika: wywołania AI, koszt i wpisy snu, od najstarszego dnia.
 *
 * @param {readonly UsageCall[]} calls - Wywołania tego użytkownika
 * @param {readonly UsageLog[]} logs - Wpisy snu tego użytkownika
 * @param {number} nowMs - Bieżący czas w ms
 * @param {number} days - Liczba dni
 * @returns {UserDailyPoint[]} Punkty wykresu
 */
export function buildUserDailySeries(
  calls: readonly UsageCall[],
  logs: readonly UsageLog[],
  nowMs: number,
  days: number,
): UserDailyPoint[] {
  const points: UserDailyPoint[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(nowMs - offset * MS_PER_DAY).toISOString().slice(0, 10);
    const dayCalls = calls.filter((c) => c.kind !== "sandbox" && c.created.slice(0, 10) === date);
    points.push({
      date,
      calls: dayCalls.length,
      costUsd: roundCost(dayCalls.reduce((sum, c) => sum + callCostUsd(c), 0)),
      sleepLogs: logs.filter((l) => l.created.slice(0, 10) === date).length,
    });
  }
  return points;
}

export type UsageCall = AiCallStat & { readonly household_id?: string; readonly user_id?: string };
