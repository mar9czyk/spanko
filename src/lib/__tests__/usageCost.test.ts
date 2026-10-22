import { describe, expect, it } from "vitest";
import { parseUsageCost } from "../openrouter";

describe("parseUsageCost", () => {
  it("przyjmuje liczby nieujemne, resztę ignoruje", () => {
    expect(parseUsageCost(0.0012)).toBe(0.0012);
    expect(parseUsageCost(0)).toBe(0);
    expect(parseUsageCost(-1)).toBeUndefined();
    expect(parseUsageCost("0.5")).toBeUndefined();
    expect(parseUsageCost(undefined)).toBeUndefined();
    expect(parseUsageCost(Number.NaN)).toBeUndefined();
  });
});
