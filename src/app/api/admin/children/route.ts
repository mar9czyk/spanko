import { NextResponse } from "next/server";
import { ChildrenQuerySchema } from "@/lib/server/adminSchemasSupport";
import { toErrorResponse } from "@/lib/server/apiResponse";
import { ApiAuthError, requireAdmin, requireServiceClient } from "@/lib/server/auth";
import type { ChildRecord, HouseholdRecord } from "@/lib/types/database";

type ChildWithHousehold = ChildRecord & {
  readonly expand?: { readonly household_id?: HouseholdRecord };
};

/**
 * GET /api/admin/children — lista dzieci (szukanie po imieniu) z nazwą gospodarstwa.
 *
 * @description
 * Zwraca tylko dane potrzebne do wyboru dziecka; szczegóły (i wpis w dzienniku działań) są w
 * `/api/admin/children/[id]`.
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Strona dzieci
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const query = ChildrenQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!query.success) {
      throw new ApiAuthError("Niepoprawne parametry zapytania.", 400);
    }
    const service = await requireServiceClient();
    const { page, perPage, search } = query.data;

    const result = await service.collection("children").getList<ChildWithHousehold>(page, perPage, {
      sort: "-created",
      expand: "household_id",
      filter: search ? service.filter("name ~ {:q}", { q: search }) : "",
    });

    return NextResponse.json({
      success: true,
      page: result.page,
      totalPages: result.totalPages,
      totalItems: result.totalItems,
      items: result.items.map((child) => ({
        id: child.id,
        name: child.name,
        birth_date: child.birth_date,
        household_id: child.household_id,
        household_name: child.expand?.household_id?.name ?? null,
        active_day_mode: child.active_day_mode,
      })),
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać listy dzieci.");
  }
}
