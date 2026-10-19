import { NextResponse } from "next/server";
import { AnnouncementPatchSchema } from "@/lib/server/adminSchemasSupport";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiAuthError, requireAdmin } from "@/lib/server/auth";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/announcements/[id] — edycja ogłoszenia (treść, poziom, okno czasu, aktywność).
 *
 * @param {Request} request - Żądanie HTTP
 * @param {RouteContext} context - Parametry ścieżki
 * @returns {Promise<NextResponse>} Zaktualizowane ogłoszenie
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { pb, user } = await requireAdmin(request);
    const { id } = await context.params;
    const body = await parseJsonBody(request, AnnouncementPatchSchema);

    const update: Record<string, unknown> = { ...body };
    if (body.starts_at === null) update.starts_at = "";
    if (body.ends_at === null) update.ends_at = "";

    let updated: unknown;
    try {
      updated = await pb.collection("announcements").update(id, update);
    } catch {
      throw new ApiAuthError("Nie znaleziono ogłoszenia.", 404);
    }
    await writeAuditLog({
      actor: user,
      action: "announcement.update",
      targetCollection: "announcements",
      targetId: id,
      after: update,
    });
    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się zapisać ogłoszenia.");
  }
}

/**
 * DELETE /api/admin/announcements/[id] — usuwa ogłoszenie.
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
      await pb.collection("announcements").delete(id);
    } catch {
      throw new ApiAuthError("Nie znaleziono ogłoszenia.", 404);
    }
    await writeAuditLog({
      actor: user,
      action: "announcement.delete",
      targetCollection: "announcements",
      targetId: id,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się usunąć ogłoszenia.");
  }
}
