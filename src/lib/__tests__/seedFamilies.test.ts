import { describe, expect, it } from "vitest";
import { generateFamilyHistory, SEED_FAMILIES } from "../../../scripts/seed-families.mjs";
import { DEV_LOGIN_ENV_PREFIX } from "../dev-auth";

const options = { childId: "c1", today: "2026-10-23", days: 21, timeZone: "Europe/Warsaw" };

describe("SEED_FAMILIES", () => {
  it("każdy rodzic ma rolę logowania DEV z pasującym prefiksem", () => {
    const parents = SEED_FAMILIES.flatMap((f) => f.parents);
    expect(parents).toHaveLength(4);
    for (const parent of parents) {
      expect(DEV_LOGIN_ENV_PREFIX[parent.role as keyof typeof DEV_LOGIN_ENV_PREFIX]).toBe(
        parent.envPrefix,
      );
    }
  });

  it("generuje 21 dób snu, karmienia i pieluchy dla każdej rodziny", () => {
    for (const family of SEED_FAMILIES) {
      const { sleepLogs, dayContext } = generateFamilyHistory(family, options);
      expect(sleepLogs.filter((l) => l.type === "night")).toHaveLength(21);
      expect(dayContext.some((c) => c.event_type === "feeding")).toBe(true);
      expect(dayContext.some((c) => c.event_type === "diaper")).toBe(true);
    }
  });

  it("maluch ma jedną drzemkę na dobę, noworodek pięć", () => {
    const napsPerDay = (key: string) => {
      const family = SEED_FAMILIES.find((f) => f.key === key);
      if (!family) throw new Error(key);
      const { sleepLogs } = generateFamilyHistory(family, options);
      return sleepLogs.filter((l) => l.type === "nap").length / 21;
    };
    expect(napsPerDay("toddler")).toBe(1);
    expect(napsPerDay("newborn")).toBe(5);
  });
});
