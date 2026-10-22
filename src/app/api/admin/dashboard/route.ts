import { NextResponse } from "next/server";
import {
  type AiCallStat,
  aggregateAiWindow,
  buildDailySeries,
  buildDashboardAlerts,
  findHouseholdsNearLimit,
  MS_PER_DAY,
} from "@/lib/admin/stats";
import { fetchAdminSettings } from "@/lib/openrouter";
import { resolveDailyAiLimit } from "@/lib/server/aiLimit";
import { toErrorResponse } from "@/lib/server/apiResponse";
import { getServiceClient, requireAdmin } from "@/lib/server/auth";
import { resolveOpenRouterKey } from "@/lib/server/openrouterKey";
import type { HouseholdRecord } from "@/lib/types/database";

const CHART_DAYS = 14;
const STATS_DAYS = 30;

/**
 * GET /api/admin/dashboard — liczby, aktywność, statystyki AI (24h/7d/30d), koszt i alerty.
 *
 * @description
 * Bez konta serwisowego zwraca tylko liczbę użytkowników widocznych dla admina oraz alert
 * o braku konfiguracji (pozostałe liczby wymagają dostępu do wszystkich gospodarstw).
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Dane pulpitu
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { pb } = await requireAdmin(request);
    const service = await getServiceClient();
    const nowMs = Date.now();
    const sinceIso = (days: number) => new Date(nowMs - days * MS_PER_DAY).toISOString();
    const openRouterKey = await resolveOpenRouterKey();
    const hasOpenRouterKey = openRouterKey.source !== "none";

    const activeUsers = async (days: number) =>
      (
        await pb.collection("users").getList(1, 1, {
          filter: pb.filter("last_seen_at >= {:since}", { since: sinceIso(days) }),
        })
      ).totalItems;

    const [totalUsers, active1d, active7d, active30d] = await Promise.all([
      pb.collection("users").getList(1, 1),
      activeUsers(1),
      activeUsers(7),
      activeUsers(30),
    ]);

    const empty = aggregateAiWindow([], nowMs, MS_PER_DAY);
    if (!service) {
      return NextResponse.json({
        success: true,
        counts: { households: null, children: null, users: totalUsers.totalItems },
        activeUsers: { d1: active1d, d7: active7d, d30: active30d },
        ai: { h24: empty, d7: empty, d30: empty, daily: [] },
        alerts: buildDashboardAlerts({
          hasOpenRouterKey,
          openRouterKeyProblem: openRouterKey.panelError,
          hasServiceAccount: false,
          stats24h: empty,
          householdsNearLimit: [],
        }),
      });
    }

    const [households, childrenTotal, calls, settings] = await Promise.all([
      service
        .collection("households")
        .getFullList<HouseholdRecord>({ fields: "id,name,ai_daily_limit_override" }),
      service.collection("children").getList(1, 1),
      service.collection("ai_calls").getFullList<AiCallStat>({
        fields:
          "created,model,status,kind,prompt_tokens,completion_tokens,cost_usd,latency_ms,household_id",
        filter: service.filter("created >= {:since}", { since: sinceIso(STATS_DAYS) }),
      }),
      fetchAdminSettings(),
    ]);

    const dayCalls = calls.filter(
      (call) => call.kind !== "sandbox" && nowMs - new Date(call.created).getTime() <= MS_PER_DAY,
    );
    const usage = households.map((household) => ({
      name: household.name,
      used: dayCalls.filter((call) => call.household_id === household.id).length,
      limit: resolveDailyAiLimit(
        household.ai_daily_limit_override,
        settings?.ai_daily_limit_per_household,
      ),
    }));

    const stats24h = aggregateAiWindow(calls, nowMs, MS_PER_DAY);
    return NextResponse.json({
      success: true,
      counts: {
        households: households.length,
        children: childrenTotal.totalItems,
        users: totalUsers.totalItems,
      },
      activeUsers: { d1: active1d, d7: active7d, d30: active30d },
      ai: {
        h24: stats24h,
        d7: aggregateAiWindow(calls, nowMs, 7 * MS_PER_DAY),
        d30: aggregateAiWindow(calls, nowMs, STATS_DAYS * MS_PER_DAY),
        daily: buildDailySeries(calls, nowMs, CHART_DAYS),
      },
      alerts: buildDashboardAlerts({
        hasOpenRouterKey,
        openRouterKeyProblem: openRouterKey.panelError,
        hasServiceAccount: true,
        stats24h,
        householdsNearLimit: findHouseholdsNearLimit(usage),
      }),
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać pulpitu.");
  }
}
