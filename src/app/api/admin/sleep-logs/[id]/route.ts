import { NextResponse } from "next/server";
import { checkStuckSleepFix } from "@/lib/admin/sleepFix";
import { SleepFixSchema } from "@/lib/server/adminSchemasSupport";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiAuthError, requireAdmin, requireServiceClient } from "@/lib/server/auth";
import type { SleepLogRecord } from "@/lib/types/database";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/sleep-logs/[id] — naprawa "zawieszonego" snu: ustawia pobudkę i status completed.
 *
 * @description
 * Dozwolone wyłącznie dla niezakończonego snu trwającego ponad 24 h (zasady w `checkStuckSleepFix`)
 * i tylko z jawnym `confirm: true`. Nie zmienia żadnych innych pól logu.
 *
 * @param {Request} request - Żądanie HTTP (`wokeUpAt`, `confirm`)
 * @param {RouteContext} context - Parametry ścieżki
 * @returns {Promise<NextResponse>} Naprawiony log
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { user } = await requireAdmin(request);
    const { id } = await context.params;
    const body = await parseJsonBody(request, SleepFixSchema);
    const service = await requireServiceClient();

    let log: SleepLogRecord;
    try {
      log = await service.collection("sleep_logs").getOne<SleepLogRecord>(id);
    } catch {
      throw new ApiAuthError("Nie znaleziono logu snu.", 404);
    }

    const problem = checkStuckSleepFix({
      status: log.status,
      startIso: log.fell_asleep_at || log.put_down_at,
      wokeUpAtIso: body.wokeUpAt,
      nowMs: Date.now(),
    });
    if (problem) {
      throw new ApiAuthError(problem, 409);
    }

    const updated = await service
      .collection("sleep_logs")
      .update<SleepLogRecord>(id, { woke_up_at: body.wokeUpAt, status: "completed" });

    await writeAuditLog({
      actor: user,
      action: "sleep_log.fix_stuck",
      targetCollection: "sleep_logs",
      targetId: id,
      before: { status: log.status, woke_up_at: log.woke_up_at ?? null },
      after: { status: updated.status, woke_up_at: updated.woke_up_at ?? null },
    });
    return NextResponse.json({ success: true, log: { id: updated.id, status: updated.status } });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się naprawić logu snu.");
  }
}
