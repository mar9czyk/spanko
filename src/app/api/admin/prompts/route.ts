import { NextResponse } from "next/server";
import { invalidateAdminSettingsCache } from "@/lib/openrouter";
import { PromptCreateSchema } from "@/lib/server/adminSchemas";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { createPromptVersion, listPromptVersions } from "@/lib/server/promptVersions";

/**
 * GET /api/admin/prompts — historia wersji promptu systemowego (od najnowszej).
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Lista wersji
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { pb } = await requireAdmin(request);
    return NextResponse.json({ success: true, items: await listPromptVersions(pb) });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać wersji promptu.");
  }
}

/**
 * POST /api/admin/prompts — tworzy nową wersję promptu i od razu ją aktywuje.
 *
 * @param {Request} request - Żądanie HTTP (`system_prompt`, opcjonalnie `note`)
 * @returns {Promise<NextResponse>} Utworzona wersja
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { pb, user } = await requireAdmin(request);
    const body = await parseJsonBody(request, PromptCreateSchema);
    const created = await createPromptVersion(pb, {
      systemPrompt: body.system_prompt,
      note: body.note,
      authorId: user.id,
    });
    invalidateAdminSettingsCache();
    await writeAuditLog({
      actor: user,
      action: "prompt.create",
      targetCollection: "prompt_versions",
      targetId: created.id,
      after: { version: created.version, note: created.note ?? "" },
    });
    return NextResponse.json({ success: true, version: created });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się zapisać wersji promptu.");
  }
}
