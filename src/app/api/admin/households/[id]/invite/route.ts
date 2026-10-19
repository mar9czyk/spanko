import { NextResponse } from "next/server";
import { calculateInviteExpirationDate, generateInviteCode } from "@/lib/pocketbase";
import { InviteActionSchema } from "@/lib/server/adminSchemasSupport";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiAuthError, requireAdmin, requireServiceClient } from "@/lib/server/auth";
import type { HouseholdRecord } from "@/lib/types/database";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/households/[id]/invite — unieważnia albo generuje od nowa kod zaproszenia.
 *
 * @param {Request} request - Żądanie HTTP (`action`: revoke | regenerate)
 * @param {RouteContext} context - Parametry ścieżki
 * @returns {Promise<NextResponse>} Nowy stan zaproszenia
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { user } = await requireAdmin(request);
    const { id } = await context.params;
    const body = await parseJsonBody(request, InviteActionSchema);
    const service = await requireServiceClient();

    let before: HouseholdRecord;
    try {
      before = await service.collection("households").getOne<HouseholdRecord>(id);
    } catch {
      throw new ApiAuthError("Nie znaleziono gospodarstwa.", 404);
    }

    const update =
      body.action === "revoke"
        ? { invite_code: "", invite_expires_at: "" }
        : { invite_code: generateInviteCode(), invite_expires_at: calculateInviteExpirationDate() };
    const updated = await service.collection("households").update<HouseholdRecord>(id, update);

    await writeAuditLog({
      actor: user,
      action: body.action === "revoke" ? "household.invite_revoke" : "household.invite_regenerate",
      targetCollection: "households",
      targetId: id,
      // Kodu zaproszenia nie zapisujemy w dzienniku — to sekret dający dostęp do gospodarstwa
      before: { hadActiveInvite: Boolean(before.invite_code) },
      after: { hasActiveInvite: Boolean(updated.invite_code) },
    });

    return NextResponse.json({
      success: true,
      invite: {
        code: updated.invite_code || null,
        expiresAt: updated.invite_expires_at || null,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się zmienić zaproszenia.");
  }
}
