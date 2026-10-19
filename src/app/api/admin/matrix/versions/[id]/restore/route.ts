import { NextResponse } from "next/server";
import { invalidateAdminSettingsCache } from "@/lib/openrouter";
import { toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiAuthError, requireAdmin } from "@/lib/server/auth";
import { type MatrixVersionRecord, recordMatrixVersion } from "@/lib/server/matrixVersions";
import { validateSleepMatrix } from "@/lib/sleep-engine";
import type { AdminSettingsRecord } from "@/lib/types/database";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/matrix/versions/[id]/restore — przywraca wskazaną wersję matrycy jako obowiązującą.
 *
 * @description
 * Wersja z `matrix_json = null` (reset) przywraca matrycę domyślną. Przywrócenie samo tworzy nowy
 * wpis w historii (źródło `restore`).
 *
 * @param {Request} request - Żądanie HTTP
 * @param {RouteContext} context - Parametry ścieżki
 * @returns {Promise<NextResponse>} Potwierdzenie
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { pb, user } = await requireAdmin(request);
    const { id } = await context.params;

    let version: MatrixVersionRecord;
    try {
      version = await pb.collection("sleep_matrix_versions").getOne<MatrixVersionRecord>(id);
    } catch {
      throw new ApiAuthError("Nie znaleziono wersji matrycy.", 404);
    }

    let matrix: unknown = null;
    if (version.matrix_json !== null && version.matrix_json !== undefined) {
      const validation = validateSleepMatrix(version.matrix_json);
      if (!validation.ok) {
        throw new ApiAuthError(
          `Zapisana wersja jest niepoprawna: ${validation.errors.join(" ")}`,
          400,
        );
      }
      matrix = validation.matrix;
    }

    const existing = await pb.collection("admin_settings").getList<AdminSettingsRecord>(1, 1);
    const current = existing.items[0];
    if (current) {
      await pb
        .collection("admin_settings")
        .update(current.id, { sleep_matrix_override_json: matrix });
    } else {
      await pb.collection("admin_settings").create({ sleep_matrix_override_json: matrix });
    }
    invalidateAdminSettingsCache();

    await recordMatrixVersion(pb, {
      matrix,
      note: `Przywrócono wersję z ${new Date(version.created).toISOString()}`,
      source: "restore",
      authorId: user.id,
    });
    await writeAuditLog({
      actor: user,
      action: "matrix.restore",
      targetCollection: "sleep_matrix_versions",
      targetId: id,
      after: { isDefault: matrix === null },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się przywrócić matrycy.");
  }
}
