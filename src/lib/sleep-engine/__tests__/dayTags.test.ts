import { describe, expect, it } from "vitest";
import {
  DAY_TAG_KEYS,
  hasDayTag,
  isIllnessDay,
  LEGACY_DAY_TAG_KEYS,
  normalizeDayTag,
} from "../index";

describe("tagi doby", () => {
  it("klucze PL ze starych wpisów mapują się na neutralne", () => {
    expect(normalizeDayTag("gorączka")).toBe("fever");
    expect(normalizeDayTag("ząbkowanie")).toBe("teething");
    expect(normalizeDayTag("fever")).toBe("fever");
    expect(normalizeDayTag("własny tag")).toBe("własny tag");
  });

  it("każdy stary klucz ma neutralny odpowiednik z listy kluczy", () => {
    for (const key of Object.values(LEGACY_DAY_TAG_KEYS)) {
      expect(DAY_TAG_KEYS).toContain(key);
    }
  });

  it("silnik rozpoznaje tagi neutralne i stare", () => {
    expect(hasDayTag(["ząbkowanie"], "teething")).toBe(true);
    expect(isIllnessDay("home", ["fever"])).toBe(true);
    expect(isIllnessDay("home", ["gorączka"])).toBe(true);
    expect(isIllnessDay("home", ["teething"])).toBe(false);
  });
});
