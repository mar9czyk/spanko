import { NextResponse } from "next/server";
import { UsersQuerySchema } from "@/lib/server/adminSchemas";
import { toErrorResponse } from "@/lib/server/apiResponse";
import { ApiAuthError, requireAdmin } from "@/lib/server/auth";
import type { UserRecord } from "@/lib/types/database";

/**
 * GET /api/admin/users — lista użytkowników (paginacja, szukanie po e-mailu/nazwie, filtr roli/blokady).
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Strona użytkowników
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { pb } = await requireAdmin(request);
    const query = UsersQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) {
      throw new ApiAuthError("Niepoprawne parametry zapytania.", 400);
    }
    const { page, perPage, search, filter } = query.data;

    const clauses: string[] = [];
    if (search) clauses.push(pb.filter("(email ~ {:q} || name ~ {:q})", { q: search }));
    if (filter === "admin") clauses.push("is_admin = true");
    if (filter === "blocked") clauses.push("is_blocked = true");

    const result = await pb.collection("users").getList<UserRecord>(page, perPage, {
      sort: "-created",
      filter: clauses.join(" && "),
    });

    return NextResponse.json({
      success: true,
      page: result.page,
      totalPages: result.totalPages,
      totalItems: result.totalItems,
      items: result.items.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        is_admin: user.is_admin === true,
        is_blocked: user.is_blocked === true,
        household_id: user.household_id ?? null,
        last_seen_at: user.last_seen_at ?? null,
        created: user.created,
      })),
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać użytkowników.");
  }
}
