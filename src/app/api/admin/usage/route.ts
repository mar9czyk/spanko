import { NextResponse } from "next/server";
import { MS_PER_DAY } from "@/lib/admin/stats";
import { aggregateUsageByUser, type UsageCall, type UsageLog } from "@/lib/admin/usage";
import { UsageQuerySchema } from "@/lib/server/adminSchemas";
import { toErrorResponse } from "@/lib/server/apiResponse";
import { ApiAuthError, requireAdmin, requireServiceClient } from "@/lib/server/auth";
import type { HouseholdRecord, UserRecord } from "@/lib/types/database";

/**
 * GET /api/admin/usage?days=7|30|90 — użycie AI i aktywność per użytkownik.
 *
 * @description
 * Czyta tylko potrzebne pola (bez treści promptów i odpowiedzi). Aktywność = wpisy snu z autorem
 * i wywołania AI, bez osobnego logu zdarzeń.
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Wiersze użytkowników i sumy
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const query = UsageQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) throw new ApiAuthError("Niepoprawny okres (7, 30 lub 90 dni).", 400);
    const { days } = query.data;

    const service = await requireServiceClient();
    const nowMs = Date.now();
    const since = new Date(nowMs - days * MS_PER_DAY).toISOString();
    const [calls, logs, users, households] = await Promise.all([
      service.collection("ai_calls").getFullList<UsageCall>({
        fields:
          "created,user_id,household_id,kind,status,model,prompt_tokens,completion_tokens,cost_usd",
        filter: service.filter("created >= {:since}", { since }),
      }),
      service.collection("sleep_logs").getFullList<UsageLog>({
        fields: "created,created_by",
        filter: service.filter("created >= {:since} && created_by != ''", { since }),
      }),
      service
        .collection("users")
        .getFullList<UserRecord>({ fields: "id,email,household_id,last_seen_at" }),
      service.collection("households").getFullList<HouseholdRecord>({ fields: "id,name" }),
    ]);

    const report = aggregateUsageByUser(calls, logs, users, nowMs, days);
    const householdNames = new Map(households.map((h) => [h.id, h.name]));
    return NextResponse.json({
      success: true,
      days,
      totals: report.totals,
      rows: report.rows.map((row) => ({
        ...row,
        householdName: row.householdId ? (householdNames.get(row.householdId) ?? null) : null,
      })),
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać telemetrii.");
  }
}
