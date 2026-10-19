export interface FeatureFlag {
  readonly key: string;
  readonly enabled: boolean;
  /** Pusta lista / brak = wszystkie gospodarstwa; niepusta = tylko wskazane */
  readonly rollout_household_ids?: unknown;
}

/**
 * Czy funkcja jest włączona dla gospodarstwa.
 *
 * @description
 * Brak flagi lub `enabled = false` → wyłączona. Włączona flaga bez listy rolloutu → dla wszystkich.
 * Lista rolloutu → tylko dla wymienionych gospodarstw (bez `householdId` → wyłączona).
 * Wartość `rollout_household_ids` spoza tablicy tekstów jest traktowana jak brak listy.
 *
 * @param {FeatureFlag | null | undefined} flag - Flaga z kolekcji feature_flags
 * @param {string | undefined} householdId - Gospodarstwo, dla którego sprawdzamy dostęp
 * @returns {boolean} True, gdy funkcja ma działać
 */
export function isFeatureEnabled(
  flag: FeatureFlag | null | undefined,
  householdId?: string,
): boolean {
  if (flag?.enabled !== true) return false;
  const rollout = Array.isArray(flag.rollout_household_ids)
    ? flag.rollout_household_ids.filter((id): id is string => typeof id === "string" && id !== "")
    : [];
  if (rollout.length === 0) return true;
  return householdId !== undefined && rollout.includes(householdId);
}
