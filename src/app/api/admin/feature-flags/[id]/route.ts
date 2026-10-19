import { NextResponse } from "next/server";
import { FeatureFlagPatchSchema } from "@/lib/server/adminSchemasSupport";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiAuthError, requireAdmin } from "@/lib/server/auth";
import { invalidateFeatureFlagsCache } from "@/lib/server/featureFlags";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/feature-flags/[id] — włącza/wyłącza flagę, zmienia listę rolloutu lub opis.
 *
 * @param {Request} request - Żądanie HTTP
 * @param {RouteContext} context - Parametry ścieżki
 * @returns {Promise<NextResponse>} Zaktualizowana flaga
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { pb, user } = await requireAdmin(request);
    const { id } = await context.params;
    const body = await parseJsonBody(request, FeatureFlagPatchSchema);

    let updated: unknown;
    try {
      updated = await pb.collection("feature_flags").update(id, body);
    } catch {
      throw new ApiAuthError("Nie znaleziono przełącznika.", 404);
    }
    invalidateFeatureFlagsCache();
    await writeAuditLog({
      actor: user,
      action: "feature_flag.update",
      targetCollection: "feature_flags",
      targetId: id,
      after: body,
    });
    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się zapisać przełącznika.");
  }
}

/**
 * DELETE /api/admin/feature-flags/[id] — usuwa flagę (funkcja wraca do stanu "wyłączona").
 *
 * @param {Request} request - Żądanie HTTP
 * @param {RouteContext} context - Parametry ścieżki
 * @returns {Promise<NextResponse>} Potwierdzenie
 */
export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { pb, user } = await requireAdmin(request);
    const { id } = await context.params;
    try {
      await pb.collection("feature_flags").delete(id);
    } catch {
      throw new ApiAuthError("Nie znaleziono przełącznika.", 404);
    }
    invalidateFeatureFlagsCache();
    await writeAuditLog({
      actor: user,
      action: "feature_flag.delete",
      targetCollection: "feature_flags",
      targetId: id,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się usunąć przełącznika.");
  }
}
