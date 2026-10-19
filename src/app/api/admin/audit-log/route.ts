import { NextResponse } from "next/server";
import { AuditLogQuerySchema } from "@/lib/server/adminSchemas";
import { toErrorResponse } from "@/lib/server/apiResponse";
import { ApiAuthError, requireAdmin } from "@/lib/server/auth";
import type { AdminAuditLogRecord } from "@/lib/types/database";

/**
 * GET /api/admin/audit-log — dziennik działań adminów (paginacja, filtr po akcji i aktorze).
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Strona wpisów dziennika
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { pb } = await requireAdmin(request);
    const query = AuditLogQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!query.success) {
      throw new ApiAuthError("Niepoprawne parametry zapytania.", 400);
    }
    const { page, perPage, action, actor } = query.data;

    const clauses: string[] = [];
    if (action) clauses.push(pb.filter("action ~ {:action}", { action }));
    if (actor) clauses.push(pb.filter("actor_email ~ {:actor}", { actor }));

    const result = await pb
      .collection("admin_audit_log")
      .getList<AdminAuditLogRecord>(page, perPage, {
        sort: "-created",
        filter: clauses.join(" && "),
      });
    return NextResponse.json({
      success: true,
      page: result.page,
      totalPages: result.totalPages,
      totalItems: result.totalItems,
      items: result.items,
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać dziennika.");
  }
}
