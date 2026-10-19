import { type FeatureFlag, isFeatureEnabled } from "@/lib/featureFlags";
import { getServiceClient } from "@/lib/server/auth";

export const FEATURE_FLAGS_CACHE_TTL_MS = 30_000;

let cache: { readonly flags: Map<string, FeatureFlag>; readonly expiresAt: number } | null = null;

/**
 * Czyści pamięć podręczną flag (po zmianie w panelu admina).
 */
export function invalidateFeatureFlagsCache(): void {
  cache = null;
}

/**
 * Wczytuje wszystkie flagi funkcji (cache 30 s, konto serwisowe); przy błędzie — pusta mapa.
 *
 * @returns {Promise<Map<string, FeatureFlag>>} Flagi wg klucza
 */
async function loadFlags(): Promise<Map<string, FeatureFlag>> {
  if (cache && cache.expiresAt > Date.now()) return cache.flags;
  const flags = new Map<string, FeatureFlag>();
  try {
    const service = await getServiceClient();
    if (service) {
      const records = await service.collection("feature_flags").getFullList<FeatureFlag>();
      for (const record of records) flags.set(record.key, record);
    }
  } catch {
    // Brak kolekcji lub błąd sieci → wszystkie funkcje wyłączone (bezpieczny domyślny stan)
  }
  cache = { flags, expiresAt: Date.now() + FEATURE_FLAGS_CACHE_TTL_MS };
  return flags;
}

/**
 * Czy funkcja `key` jest włączona dla gospodarstwa (użycie po stronie serwera).
 *
 * @param {string} key - Klucz flagi
 * @param {string} [householdId] - Gospodarstwo użytkownika
 * @returns {Promise<boolean>} True, gdy włączona
 */
export async function isFeatureEnabledFor(key: string, householdId?: string): Promise<boolean> {
  return isFeatureEnabled((await loadFlags()).get(key), householdId);
}
