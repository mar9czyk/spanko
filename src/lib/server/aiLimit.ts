import type PocketBase from "pocketbase";
import { fetchAdminSettings } from "@/lib/openrouter";
import { ApiAuthError, getServiceClient } from "@/lib/server/auth";
import type { HouseholdRecord } from "@/lib/types/database";

export const DEFAULT_AI_DAILY_LIMIT_PER_HOUSEHOLD = 20;
export const AI_LIMIT_WINDOW_MS = 86_400_000;

/**
 * Zlicza wywołania AI gospodarstwa z ostatnich 24h: z logu ai_calls (konto serwisowe),
 * a bez niego — z liczby wniosków utworzonych przez gospodarstwo.
 *
 * @param {PocketBase} pb - Klient PocketBase użytkownika
 * @param {string} householdId - Identyfikator gospodarstwa
 * @returns {Promise<number>} Liczba wywołań w oknie limitu
 */
async function countRecentAiCalls(pb: PocketBase, householdId: string): Promise<number> {
  const since = new Date(Date.now() - AI_LIMIT_WINDOW_MS).toISOString();
  const serviceClient = await getServiceClient();

  if (serviceClient) {
    const calls = await serviceClient.collection("ai_calls").getList(1, 1, {
      filter: serviceClient.filter(
        "household_id = {:householdId} && kind != 'sandbox' && created >= {:since}",
        { householdId, since },
      ),
    });
    return calls.totalItems;
  }

  const insights = await pb.collection("child_insights").getList(1, 1, {
    filter: pb.filter("child_id.household_id = {:householdId} && created >= {:since}", {
      householdId,
      since,
    }),
  });
  return insights.totalItems;
}

/**
 * Egzekwuje dzienny limit zapytań AI: nadpisanie gospodarstwa > ustawienie globalne > domyślny.
 *
 * @param {PocketBase} pb - Klient PocketBase użytkownika
 * @param {string} householdId - Identyfikator gospodarstwa
 * @throws {ApiAuthError} 429 po przekroczeniu limitu
 */
export async function enforceDailyAiLimit(pb: PocketBase, householdId: string): Promise<void> {
  const [adminSettings, household] = await Promise.all([
    fetchAdminSettings(),
    pb.collection("households").getOne<HouseholdRecord>(householdId),
  ]);
  const limit =
    household.ai_daily_limit_override ??
    adminSettings?.ai_daily_limit_per_household ??
    DEFAULT_AI_DAILY_LIMIT_PER_HOUSEHOLD;

  if ((await countRecentAiCalls(pb, householdId)) >= limit) {
    throw new ApiAuthError("Dzienny limit zapytań AI dla gospodarstwa został wyczerpany.", 429);
  }
}
