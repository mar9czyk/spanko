import { toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiAuthError, requireAdmin, requireServiceClient } from "@/lib/server/auth";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

/** Pola użytkownika, które wolno wyeksportować (bez tokenów, haseł i identyfikatorów sesji). */
const USER_EXPORT_FIELDS = "id,email,name,is_admin,is_blocked,created,last_seen_at";

/**
 * GET /api/admin/households/[id]/export — pełny eksport danych gospodarstwa do JSON (RODO, wsparcie).
 *
 * @description
 * Zawiera gospodarstwo, członków (bez haseł i tokenów), dzieci, logi snu, kontekst dnia, wnioski,
 * cele i zadania oraz log wywołań AI. Kod zaproszenia nie jest eksportowany. Operacja trafia do dziennika.
 *
 * @param {Request} request - Żądanie HTTP
 * @param {RouteContext} context - Parametry ścieżki
 * @returns {Promise<Response>} Plik JSON do pobrania
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { user } = await requireAdmin(request);
    const { id } = await context.params;
    const service = await requireServiceClient();

    let household: Record<string, unknown>;
    try {
      household = await service.collection("households").getOne(id);
    } catch {
      throw new ApiAuthError("Nie znaleziono gospodarstwa.", 404);
    }
    const {
      invite_code: _inviteCode,
      invite_expires_at: _inviteExpiry,
      ...householdData
    } = household;

    const members = await service.collection("users").getFullList({
      filter: service.filter("household_id = {:id}", { id }),
      fields: USER_EXPORT_FIELDS,
    });
    const children = await service.collection("children").getFullList({
      filter: service.filter("household_id = {:id}", { id }),
    });
    const childIds = children.map((child) => child.id as string);

    const byChild = (field: string) =>
      childIds.length === 0
        ? "id = ''"
        : childIds.map((childId) => service.filter(`${field} = {:c}`, { c: childId })).join(" || ");

    const [sleepLogs, dayContext, insights, goals, aiCalls] = await Promise.all([
      service.collection("sleep_logs").getFullList({ filter: byChild("child_id") }),
      service.collection("day_context").getFullList({ filter: byChild("child_id") }),
      service.collection("child_insights").getFullList({ filter: byChild("child_id") }),
      service.collection("child_goals").getFullList({ filter: byChild("child_id") }),
      service.collection("ai_calls").getFullList({
        filter: service.filter("household_id = {:id}", { id }),
        fields: "id,kind,model,status,category,prompt_version,fallback_used,latency_ms,created",
      }),
    ]);
    const goalIds = goals.map((goal) => goal.id as string);
    const goalTasks =
      goalIds.length === 0
        ? []
        : await service.collection("goal_daily_tasks").getFullList({
            filter: goalIds
              .map((goalId) => service.filter("goal_id = {:g}", { g: goalId }))
              .join(" || "),
          });

    await writeAuditLog({
      actor: user,
      action: "household.export",
      targetCollection: "households",
      targetId: id,
      after: {
        children: children.length,
        sleepLogs: sleepLogs.length,
        insights: insights.length,
      },
    });

    const payload = {
      exportedAt: new Date().toISOString(),
      household: householdData,
      members,
      children,
      sleepLogs,
      dayContext,
      insights,
      goals,
      goalDailyTasks: goalTasks,
      aiCalls,
    };
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="spanko-household-${id}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się wyeksportować danych.");
  }
}
