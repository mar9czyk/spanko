import { NextResponse } from "next/server";
import { DEFAULT_GOAL_COACH_PROMPT } from "@/lib/goal-coach";
import {
  DEFAULT_OPENROUTER_FAST_MODEL,
  DEFAULT_OPENROUTER_REASONING_MODEL,
  DEFAULT_SYSTEM_PROMPT,
  invalidateAdminSettingsCache,
} from "@/lib/openrouter";
import { AdminSettingsUpdateSchema } from "@/lib/server/adminSchemas";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiAuthError, requireAdmin } from "@/lib/server/auth";
import { recordMatrixVersion } from "@/lib/server/matrixVersions";
import { DEFAULT_SLEEP_MATRIX, validateSleepMatrix } from "@/lib/sleep-engine";
import type { AdminSettingsRecord } from "@/lib/types/database";

/**
 * GET /api/admin/settings — aktualne ustawienia admina wraz z wartościami domyślnymi.
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Ustawienia i domyślne wartości
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { pb } = await requireAdmin(request);
    const result = await pb.collection("admin_settings").getList<AdminSettingsRecord>(1, 1);
    return NextResponse.json({
      success: true,
      settings: result.items[0] ?? null,
      defaults: {
        fastModel: DEFAULT_OPENROUTER_FAST_MODEL,
        reasoningModel: DEFAULT_OPENROUTER_REASONING_MODEL,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        goalCoachPrompt: DEFAULT_GOAL_COACH_PROMPT,
        matrix: DEFAULT_SLEEP_MATRIX,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać ustawień.");
  }
}

/**
 * PUT /api/admin/settings — zapis (upsert) ustawień; matryca snu jest walidowana przed zapisem.
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Zapisane ustawienia
 */
export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const { pb, user } = await requireAdmin(request);
    const body = await parseJsonBody(request, AdminSettingsUpdateSchema);

    const { sleep_matrix_note: matrixNote, ...settingsFields } = body;
    const update: Record<string, unknown> = { ...settingsFields };
    if (body.sleep_matrix_override_json !== undefined && body.sleep_matrix_override_json !== null) {
      const validation = validateSleepMatrix(body.sleep_matrix_override_json);
      if (!validation.ok) {
        throw new ApiAuthError(`Niepoprawna matryca snu: ${validation.errors.join(" ")}`, 400);
      }
      update.sleep_matrix_override_json = validation.matrix;
    }

    const existing = await pb.collection("admin_settings").getList<AdminSettingsRecord>(1, 1);
    const current = existing.items[0];
    const saved = current
      ? await pb.collection("admin_settings").update<AdminSettingsRecord>(current.id, update)
      : await pb.collection("admin_settings").create<AdminSettingsRecord>(update);

    invalidateAdminSettingsCache();
    if (body.sleep_matrix_override_json !== undefined) {
      await recordMatrixVersion(pb, {
        matrix: update.sleep_matrix_override_json ?? null,
        note: matrixNote,
        source: body.sleep_matrix_override_json === null ? "reset" : "save",
        authorId: user.id,
      });
    }
    await writeAuditLog({
      actor: user,
      action: "settings.update",
      targetCollection: "admin_settings",
      targetId: saved.id,
      before: current ?? null,
      after: update,
    });
    return NextResponse.json({ success: true, settings: saved });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się zapisać ustawień.");
  }
}
