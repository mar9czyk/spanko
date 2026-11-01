import { describe, expect, it } from "vitest";
import { resolveBackdatedStart, startFromMinutesAgo } from "../backdatedSleep";

const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).getTime();

describe("resolveBackdatedStart", () => {
  it("uses today when the clock is not in the future", () => {
    expect(resolveBackdatedStart("11:30", at(22, 12))).toBe(at(22, 11, 30));
  });

  it("rolls a later clock back to yesterday", () => {
    expect(resolveBackdatedStart("23:30", at(22, 0, 10))).toBe(at(21, 23, 30));
  });

  it("rejects malformed clocks and sleeps longer than 16 h", () => {
    expect(resolveBackdatedStart("", at(22, 12))).toBe("invalid_time");
    expect(resolveBackdatedStart("25:00", at(22, 12))).toBe("invalid_time");
    expect(resolveBackdatedStart("19:00", at(22, 12))).toBe("too_long");
  });
});

describe("startFromMinutesAgo", () => {
  it("subtracts minutes", () => {
    expect(startFromMinutesAgo(60, at(22, 12))).toBe(at(22, 11));
  });
});
