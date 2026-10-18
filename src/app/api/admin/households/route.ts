import { NextResponse } from "next/server";
import type PocketBase from "pocketbase";
import { HouseholdLimitPatchSchema } from "@/lib/server/adminSchemas";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { ApiAuthError, getServiceClient, requireAdmin } from "@/lib/server/auth";
import type { HouseholdRecord } from "@/lib/types/database";

const MS_24H = 86_400_000;
const MS_7D = 7 * MS_24H;

/**
 * Zwraca klienta serwisowego lub rzuca 503, gdy nie skonfigurowano konta superusera.
 *
 * @throws {ApiAuthError} 503 przy braku konfiguracji
 * @returns {Promise<PocketBase>} Klient z uprawnieniami superusera
 */
async function requireServiceClient(): Promise<PocketBase> {
  const client = await getServiceClient();
  if (!client) {
    throw new ApiAuthError(
      "Brak konfiguracji konta serwisowego (POCKETBASE_SUPERUSER_EMAIL / _PASSWORD).",
      503,
    );
  }
  return client;
}

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
        limitOverride: household.ai_daily_limit_override ?? null,
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
    await requireAdmin(request);
    const body = await parseJsonBody(request, HouseholdLimitPatchSchema);
    const service = await requireServiceClient();

    const updated = await service
      .collection("households")
      .update<HouseholdRecord>(body.householdId, { ai_daily_limit_override: body.limitOverride });
    return NextResponse.json({
      success: true,
      id: updated.id,
      limitOverride: updated.ai_daily_limit_override ?? null,
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się zapisać limitu.");
  }
}
