import { NextResponse } from "next/server";
import { invalidateAdminSettingsCache } from "@/lib/openrouter";
import { toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiAuthError, requireAdmin } from "@/lib/server/auth";
import { activatePromptVersion } from "@/lib/server/promptVersions";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/prompts/[id]/activate — przywraca (aktywuje) wskazaną wersję promptu.
 *
 * @param {Request} request - Żądanie HTTP
 * @param {RouteContext} context - Parametry ścieżki
 * @returns {Promise<NextResponse>} Aktywowana wersja
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { pb, user } = await requireAdmin(request);
    const { id } = await context.params;
    let activated: Awaited<ReturnType<typeof activatePromptVersion>>;
    try {
      activated = await activatePromptVersion(pb, id);
    } catch {
      throw new ApiAuthError("Nie znaleziono wersji promptu.", 404);
    }
    invalidateAdminSettingsCache();
    await writeAuditLog({
      actor: user,
      action: "prompt.activate",
      targetCollection: "prompt_versions",
      targetId: id,
      after: { version: activated.version },
    });
    return NextResponse.json({ success: true, version: activated });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się aktywować wersji promptu.");
  }
}
