import { NextResponse } from "next/server";
import { fetchAdminSettings } from "@/lib/openrouter";
import { toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiAuthError, requireAdmin, requireServiceClient } from "@/lib/server/auth";
import { runDeterministicEngine } from "@/lib/server/childEngine";
import type { ChildRecord, SleepLogRecord } from "@/lib/types/database";

export const PROFILE_DAYS = 14;
export const MAX_PROFILE_LOGS = 200;
const MS_PER_DAY = 86_400_000;

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/children/[id] — profil dziecka (tylko do odczytu): wiek efektywny, tryb dnia
 * i logi snu z ostatnich 14 dób. Każdy odczyt trafia do dziennika działań (dane wrażliwe).
 *
 * @param {Request} request - Żądanie HTTP
 * @param {RouteContext} context - Parametry ścieżki
 * @returns {Promise<NextResponse>} Profil i logi
 */
export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { user } = await requireAdmin(request);
    const { id } = await context.params;
    const service = await requireServiceClient();

    let child: ChildRecord;
    try {
      child = await service.collection("children").getOne<ChildRecord>(id);
    } catch {
      throw new ApiAuthError("Nie znaleziono dziecka.", 404);
    }

    const sinceDate = new Date(Date.now() - PROFILE_DAYS * MS_PER_DAY).toISOString().slice(0, 10);
    const logs = await service
      .collection("sleep_logs")
      .getList<SleepLogRecord>(1, MAX_PROFILE_LOGS, {
        sort: "-fell_asleep_at",
        filter: service.filter("child_id = {:id} && physiological_date >= {:since}", {
          id,
          since: sinceDate,
        }),
      });

    await writeAuditLog({
      actor: user,
      action: "child.view",
      targetCollection: "children",
      targetId: id,
    });

    return NextResponse.json({
      success: true,
      child,
      logs: logs.items.map((log) => ({
        id: log.id,
        physiological_date: log.physiological_date,
        type: log.type,
        status: log.status,
        put_down_at: log.put_down_at,
        fell_asleep_at: log.fell_asleep_at,
        woke_up_at: log.woke_up_at ?? null,
        night_wakings: Array.isArray(log.night_wakings) ? log.night_wakings.length : 0,
      })),
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać profilu dziecka.");
  }
}

/**
 * POST /api/admin/children/[id] — "Przelicz silnik": wynik 3 napędów i 7 drzew diagnostycznych na
 * aktualnych danych, wyłącznie silnikiem deterministycznym (bez OpenRoutera, nic nie zapisuje).
 *
 * @param {Request} request - Żądanie HTTP
 * @param {RouteContext} context - Parametry ścieżki
 * @returns {Promise<NextResponse>} Wynik silnika
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { user } = await requireAdmin(request);
    const { id } = await context.params;
    const service = await requireServiceClient();

    let child: ChildRecord;
    try {
      child = await service.collection("children").getOne<ChildRecord>(id);
    } catch {
      throw new ApiAuthError("Nie znaleziono dziecka.", 404);
    }

    const [logs, settings] = await Promise.all([
      service.collection("sleep_logs").getList<SleepLogRecord>(1, 100, {
        sort: "-created",
        filter: service.filter("child_id = {:id}", { id }),
      }),
      fetchAdminSettings(),
    ]);

    const result = runDeterministicEngine({
      child,
      sleepRecords: logs.items,
      matrixOverrideJson: settings?.sleep_matrix_override_json,
      nowIso: new Date().toISOString(),
    });

    await writeAuditLog({
      actor: user,
      action: "child.recompute",
      targetCollection: "children",
      targetId: id,
    });

    return NextResponse.json({
      success: true,
      effectiveAgeDays: result.effectiveAgeDays,
      bracket: result.bracket,
      chronicDrive: result.chronicDrive,
      diagnostics: result.allDiagnostics.map((diag) => ({
        category: diag.category,
        diagnosisCode: diag.diagnosisCode,
        isTriggered: diag.isTriggered,
        severity: diag.severity,
        title: diag.title,
        explanation: diag.explanation,
        clinicalAction: diag.clinicalAction,
      })),
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się przeliczyć silnika.");
  }
}
