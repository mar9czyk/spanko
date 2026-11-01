import { describe, expect, it } from "vitest";
import { findMisdatedEntries } from "../misdatedEntries";

const night = { physiological_date: "2026-10-31", woke_up_at: "2026-11-01T06:30:00.000Z" };
const tz = "Europe/Warsaw";

describe("findMisdatedEntries", () => {
  it("przenosi wpisy po pobudce do doby dnia pobudki", () => {
    const result = findMisdatedEntries(night, tz, [
      { id: "meal", physiological_date: "2026-10-31", at: "2026-11-01T08:30:00.000Z" },
      { id: "dinner", physiological_date: "2026-10-31", at: "2026-10-31T17:00:00.000Z" },
    ]);
    expect(result).toEqual([{ id: "meal", physiological_date: "2026-11-01" }]);
  });

  it("nie rusza wpisów innej doby ani nocy bez pobudki", () => {
    expect(
      findMisdatedEntries(night, tz, [
        { id: "x", physiological_date: "2026-11-01", at: "2026-11-01T09:00:00.000Z" },
      ]),
    ).toEqual([]);
    expect(findMisdatedEntries({ ...night, woke_up_at: undefined }, tz, [])).toEqual([]);
  });

  it("nic nie robi, gdy pobudka wypada w dniu doby nocy", () => {
    const sameDay = { physiological_date: "2026-11-01", woke_up_at: "2026-11-01T06:30:00.000Z" };
    expect(
      findMisdatedEntries(sameDay, tz, [
        { id: "a", physiological_date: "2026-11-01", at: "2026-11-01T09:00:00.000Z" },
      ]),
    ).toEqual([]);
  });
});
