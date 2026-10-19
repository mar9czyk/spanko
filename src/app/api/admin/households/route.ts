import { NextResponse } from "next/server";
import { HouseholdLimitPatchSchema } from "@/lib/server/adminSchemas";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { requireAdmin, requireServiceClient } from "@/lib/server/auth";
import type { HouseholdRecord } from "@/lib/types/database";

const MS_24H = 86_400_000;
const MS_7D = 7 * MS_24H;

/**
 * GET /api/admin/households — gospodarstwa z liczbą dzieci i zużyciem AI (24h / 7 dni).
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Lista gospodarstw
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const service = await requireServiceClient();
    const now = Date.now();

    const [households, children, calls] = await Promise.all([
      service.collection("households").getFullList<HouseholdRecord>({ sort: "-created" }),
      service.collection("children").getFullList<{ household_id: string }>({
        fields: "household_id",
      }),
      service.collection("ai_calls").getFullList<{ household_id?: string; created: string }>({
        fields: "household_id,created",
        filter: service.filter("kind = 'evaluate' && created >= {:since}", {
          since: new Date(now - MS_7D).toISOString(),
        }),
      }),
    ]);

    const items = households.map((household) => {
      const householdCalls = calls.filter((call) => call.household_id === household.id);
      return {
        id: household.id,
        name: household.name,
        created: household.created,
        childrenCount: children.filter((child) => child.household_id === household.id).length,
        aiCalls24h: householdCalls.filter(
          (call) => now - new Date(call.created).getTime() <= MS_24H,
        ).length,
        aiCalls7d: householdCalls.length,
        // PocketBase zwraca 0 dla niewypełnionej liczby — traktujemy to jako brak nadpisania
        limitOverride: household.ai_daily_limit_override || null,
        aiDisabled: household.ai_disabled === true,
      };
    });

    return NextResponse.json({ success: true, items });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać gospodarstw.");
  }
}

/**
 * PATCH /api/admin/households — ustawia lub czyści nadpisanie dziennego limitu AI gospodarstwa.
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Zaktualizowane gospodarstwo
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const { user } = await requireAdmin(request);
    const body = await parseJsonBody(request, HouseholdLimitPatchSchema);
    const service = await requireServiceClient();

    const before = await service.collection("households").getOne<HouseholdRecord>(body.householdId);
    const update: Record<string, unknown> = {};
    if (body.limitOverride !== undefined) update.ai_daily_limit_override = body.limitOverride;
    if (body.aiDisabled !== undefined) update.ai_disabled = body.aiDisabled;

    const updated = await service
      .collection("households")
      .update<HouseholdRecord>(body.householdId, update);
    await writeAuditLog({
      actor: user,
      action:
        body.aiDisabled !== undefined ? "household.set_ai_disabled" : "household.set_ai_limit",
      targetCollection: "households",
      targetId: updated.id,
      before: {
        ai_daily_limit_override: before.ai_daily_limit_override ?? null,
        ai_disabled: before.ai_disabled === true,
      },
      after: update,
    });
    return NextResponse.json({
      success: true,
      id: updated.id,
      limitOverride: updated.ai_daily_limit_override || null,
      aiDisabled: updated.ai_disabled === true,
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się zapisać limitu.");
  }
}
