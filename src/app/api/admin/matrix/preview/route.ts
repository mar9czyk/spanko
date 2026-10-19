import { NextResponse } from "next/server";
import { compareMatrices } from "@/lib/admin/matrixPreview";
import { fetchAdminSettings } from "@/lib/openrouter";
import { MatrixPreviewSchema } from "@/lib/server/adminSchemasSupport";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { ApiAuthError, requireAdmin } from "@/lib/server/auth";
import { resolveSleepMatrix, validateSleepMatrix } from "@/lib/sleep-engine";

/**
 * POST /api/admin/matrix/preview — pokazuje, jak proponowana matryca zmieni SweetSpot dla 3 profili dzieci.
 *
 * @description
 * Nic nie zapisuje. Porównuje matrycę obecnie obowiązującą (z ustawień lub domyślną) z przesłaną.
 *
 * @param {Request} request - Żądanie HTTP (`matrix`)
 * @returns {Promise<NextResponse>} Wiersze porównania
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const body = await parseJsonBody(request, MatrixPreviewSchema);
    const validation = validateSleepMatrix(body.matrix);
    if (!validation.ok) {
      throw new ApiAuthError(`Niepoprawna matryca snu: ${validation.errors.join(" ")}`, 400);
    }
    const settings = await fetchAdminSettings();
    const current = resolveSleepMatrix(settings?.sleep_matrix_override_json);
    return NextResponse.json({
      success: true,
      rows: compareMatrices(current, validation.matrix),
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się obliczyć podglądu matrycy.");
  }
}
