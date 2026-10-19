import { NextResponse } from "next/server";
import { AppContentUpsertSchema } from "@/lib/server/adminSchemasSupport";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";

interface AppContentRecord {
  readonly id: string;
  readonly key: string;
  readonly value_pl: string;
  readonly updated: string;
}

/**
 * GET /api/admin/content — wszystkie nadpisania tekstów aplikacji (klucz → polska treść).
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Lista nadpisań
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { pb } = await requireAdmin(request);
    const items = await pb.collection("app_content").getFullList<AppContentRecord>({ sort: "key" });
    return NextResponse.json({ success: true, items });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać treści.");
  }
}

/**
 * PUT /api/admin/content — zapisuje (upsert) nadpisanie tekstu; pusta wartość usuwa nadpisanie
 * i przywraca tekst z kodu.
 *
 * @param {Request} request - Żądanie HTTP (`key`, `value_pl`)
 * @returns {Promise<NextResponse>} Wynik zapisu
 */
export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const { pb, user } = await requireAdmin(request);
    const body = await parseJsonBody(request, AppContentUpsertSchema);

    const existing = await pb
      .collection("app_content")
      .getList<AppContentRecord>(1, 1, { filter: pb.filter("key = {:key}", { key: body.key }) });
    const current = existing.items[0];

    if (body.value_pl.trim() === "") {
      if (current) await pb.collection("app_content").delete(current.id);
    } else if (current) {
      await pb.collection("app_content").update(current.id, { value_pl: body.value_pl });
    } else {
      await pb.collection("app_content").create({ key: body.key, value_pl: body.value_pl });
    }

    await writeAuditLog({
      actor: user,
      action: body.value_pl.trim() === "" ? "content.reset" : "content.set",
      targetCollection: "app_content",
      targetId: current?.id,
      before: current ? { key: current.key, value_pl: current.value_pl } : null,
      after: { key: body.key, value_pl: body.value_pl },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się zapisać treści.");
  }
}
