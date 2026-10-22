import { NextResponse } from "next/server";
import { MS_PER_DAY } from "@/lib/admin/stats";
import {
  aggregateUsageByUser,
  buildUserDailySeries,
  type UsageCall,
  type UsageLog,
} from "@/lib/admin/usage";
import { UsageQuerySchema } from "@/lib/server/adminSchemas";
import { toErrorResponse } from "@/lib/server/apiResponse";
import { ApiAuthError, requireAdmin, requireServiceClient } from "@/lib/server/auth";
import type { UserRecord } from "@/lib/types/database";

interface RouteContext {
  readonly params: Promise<{ userId: string }>;
}

/**
 * GET /api/admin/usage/[userId]?days=… — szczegóły jednego użytkownika: sumy, rozbicie na rodzaje
 * wywołań i dzienna seria (wywołania, koszt, wpisy snu).
 *
 * @param {Request} request - Żądanie HTTP
 * @param {RouteContext} context - Parametry ścieżki
 * @returns {Promise<NextResponse>} Szczegóły użycia
 */
export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { userId } = await context.params;
    const query = UsageQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) throw new ApiAuthError("Niepoprawny okres (7, 30 lub 90 dni).", 400);
    const { days } = query.data;

    const service = await requireServiceClient();
    const nowMs = Date.now();
    const since = new Date(nowMs - days * MS_PER_DAY).toISOString();
    const [user, calls, logs] = await Promise.all([
      service
        .collection("users")
        .getOne<UserRecord>(userId, { fields: "id,email,household_id,last_seen_at" })
        .catch(() => null),
      service.collection("ai_calls").getFullList<UsageCall>({
        fields:
          "created,user_id,household_id,kind,status,model,prompt_tokens,completion_tokens,cost_usd",
        filter: service.filter("created >= {:since} && user_id = {:userId}", { since, userId }),
      }),
      service.collection("sleep_logs").getFullList<UsageLog>({
        fields: "created,created_by",
        filter: service.filter("created >= {:since} && created_by = {:userId}", { since, userId }),
      }),
    ]);
    if (!user) throw new ApiAuthError("Nie znaleziono użytkownika.", 404);

    const report = aggregateUsageByUser(calls, logs, [user], nowMs, days);
    return NextResponse.json({
      success: true,
      days,
      user: { id: user.id, email: user.email },
      usage: report.rows[0] ?? null,
      daily: buildUserDailySeries(calls, logs, nowMs, days),
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać szczegółów użycia.");
  }
}
