import { estimateCallCostUsd } from "./pricing";

export interface AiCallStat {
  readonly created: string;
  readonly model?: string;
  readonly status: "ok" | "error" | "invalid_json";
  readonly kind: string;
  readonly prompt_tokens?: number;
  readonly completion_tokens?: number;
  readonly latency_ms?: number;
  readonly household_id?: string;
}

export interface AiWindowStats {
  readonly calls: number;
  readonly errors: number;
  readonly invalidJson: number;
  readonly errorRate: number;
  readonly avgLatencyMs: number;
  readonly costUsd: number;
}

export interface DailyAiPoint {
  readonly date: string;
  readonly calls: number;
  readonly costUsd: number;
}

export interface HouseholdUsage {
  readonly name: string;
  readonly used: number;
  readonly limit: number;
}

export interface DashboardAlert {
  readonly level: "warning" | "critical";
  readonly code: string;
  readonly message: string;
}

export const MS_PER_DAY = 86_400_000;
export const ERROR_RATE_ALERT_THRESHOLD = 0.1;
export const LIMIT_ALERT_RATIO = 0.8;
export const MIN_CALLS_FOR_ERROR_ALERT = 5;
const COST_PRECISION = 10_000;

/**
 * Agreguje statystyki wywołań AI z ostatnich `windowMs` ms (bez wywołań sandbox).
 *
 * @param {readonly AiCallStat[]} calls - Wpisy z ai_calls
 * @param {number} nowMs - Bieżący czas w ms
 * @param {number} windowMs - Długość okna w ms
 * @returns {AiWindowStats} Zagregowane statystyki
 */
export function aggregateAiWindow(
  calls: readonly AiCallStat[],
  nowMs: number,
  windowMs: number,
): AiWindowStats {
  const inWindow = calls.filter(
    (call) => call.kind !== "sandbox" && nowMs - new Date(call.created).getTime() <= windowMs,
  );
  const errors = inWindow.filter((call) => call.status === "error").length;
  const invalidJson = inWindow.filter((call) => call.status === "invalid_json").length;
  const withLatency = inWindow.filter((call) => (call.latency_ms ?? 0) > 0);
  const totalLatency = withLatency.reduce((sum, call) => sum + (call.latency_ms ?? 0), 0);
  const costUsd = inWindow.reduce(
    (sum, call) =>
      sum + estimateCallCostUsd(call.model, call.prompt_tokens, call.completion_tokens),
    0,
  );
  return {
    calls: inWindow.length,
    errors,
    invalidJson,
    errorRate: inWindow.length === 0 ? 0 : (errors + invalidJson) / inWindow.length,
    avgLatencyMs: withLatency.length === 0 ? 0 : Math.round(totalLatency / withLatency.length),
    costUsd: Math.round(costUsd * COST_PRECISION) / COST_PRECISION,
  };
}

/**
 * Buduje serię dzienną (UTC) wywołań i kosztu dla ostatnich `days` dni, od najstarszego.
 *
 * @param {readonly AiCallStat[]} calls - Wpisy z ai_calls
 * @param {number} nowMs - Bieżący czas w ms
 * @param {number} days - Liczba dni
 * @returns {DailyAiPoint[]} Punkty wykresu
 */
export function buildDailySeries(
  calls: readonly AiCallStat[],
  nowMs: number,
  days: number,
): DailyAiPoint[] {
  const points: DailyAiPoint[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(nowMs - offset * MS_PER_DAY).toISOString().slice(0, 10);
    const dayCalls = calls.filter(
      (call) => call.kind !== "sandbox" && call.created.slice(0, 10) === date,
    );
    const costUsd = dayCalls.reduce(
      (sum, call) =>
        sum + estimateCallCostUsd(call.model, call.prompt_tokens, call.completion_tokens),
      0,
    );
    points.push({
      date,
      calls: dayCalls.length,
      costUsd: Math.round(costUsd * COST_PRECISION) / COST_PRECISION,
    });
  }
  return points;
}

/**
 * Wybiera gospodarstwa, które zużyły co najmniej 80% dziennego limitu AI.
 *
 * @param {readonly HouseholdUsage[]} households - Gospodarstwa z zużyciem 24h i limitem
 * @returns {HouseholdUsage[]} Gospodarstwa blisko limitu
 */
export function findHouseholdsNearLimit(households: readonly HouseholdUsage[]): HouseholdUsage[] {
  return households.filter((h) => h.limit > 0 && h.used / h.limit >= LIMIT_ALERT_RATIO);
}

/**
 * Wylicza alerty pulpitu: brak konta serwisowego/klucza OpenRouter, wysoki odsetek błędów AI,
 * gospodarstwa blisko limitu. Krytyczne alerty są pierwsze.
 *
 * @param {object} input - Dane wejściowe alertów
 * @returns {DashboardAlert[]} Lista alertów
 */
export function buildDashboardAlerts(input: {
  readonly hasOpenRouterKey: boolean;
  readonly hasServiceAccount: boolean;
  readonly stats24h: AiWindowStats;
  readonly householdsNearLimit: readonly HouseholdUsage[];
}): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  if (!input.hasServiceAccount) {
    alerts.push({
      level: "critical",
      code: "NO_SERVICE_ACCOUNT",
      message: "Brak konta serwisowego PocketBase — audyt, limity i logi AI nie działają.",
    });
  }
  if (!input.hasOpenRouterKey) {
    alerts.push({
      level: "warning",
      code: "NO_OPENROUTER_KEY",
      message: "Brak OPENROUTER_API_KEY — wnioski działają wyłącznie na silniku deterministycznym.",
    });
  }
  if (
    input.stats24h.calls >= MIN_CALLS_FOR_ERROR_ALERT &&
    input.stats24h.errorRate > ERROR_RATE_ALERT_THRESHOLD
  ) {
    alerts.push({
      level: "critical",
      code: "AI_ERROR_RATE",
      message: `Wysoki odsetek błędów AI w 24 h: ${Math.round(input.stats24h.errorRate * 100)}%.`,
    });
  }
  for (const household of input.householdsNearLimit) {
    alerts.push({
      level: "warning",
      code: "HOUSEHOLD_NEAR_LIMIT",
      message: `Gospodarstwo "${household.name}" zużyło ${household.used}/${household.limit} zapytań AI.`,
    });
  }
  return [
    ...alerts.filter((a) => a.level === "critical"),
    ...alerts.filter((a) => a.level === "warning"),
  ];
}

/**
 * Sprawdza, czy zmiana roli admina nie odbierze uprawnień ostatniemu adminowi lub sobie samemu.
 *
 * @param {object} input - Aktor, cel, liczba adminów i docelowa wartość
 * @returns {string | null} Komunikat błędu (HTTP 409) albo null, gdy zmiana jest dozwolona
 */
export function checkAdminDemotion(input: {
  readonly actorId: string;
  readonly targetId: string;
  readonly targetIsAdmin: boolean;
  readonly adminCount: number;
  readonly nextIsAdmin: boolean;
}): string | null {
  if (!input.targetIsAdmin || input.nextIsAdmin) return null;
  if (input.actorId === input.targetId) {
    return "Nie możesz odebrać uprawnień administratora samemu sobie.";
  }
  if (input.adminCount <= 1) {
    return "Nie można odebrać uprawnień ostatniemu administratorowi.";
  }
  return null;
}
