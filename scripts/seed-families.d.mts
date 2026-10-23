export interface SeedFamilyParent {
  readonly role: string;
  readonly envPrefix: string;
  readonly email: string;
  readonly name: string;
}

export interface SeedFamily {
  readonly key: string;
  readonly household: string;
  readonly parents: readonly SeedFamilyParent[];
  readonly child: { readonly name: string; readonly ageDays: number };
}

export const SEED_FAMILIES: readonly SeedFamily[];

export function generateFamilyHistory(
  family: SeedFamily,
  options: { childId: string; today: string; days: number; timeZone: string },
): {
  sleepLogs: Record<string, unknown>[];
  dayContext: Record<string, unknown>[];
};
