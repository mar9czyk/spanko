import { describe, expect, it } from "vitest";
import { sleepFoundationsForAge } from "../sleep-foundations";

describe("sleepFoundationsForAge", () => {
  it("noworodek: bez sztywnego planu i bez stałej pory pobudki", () => {
    const tips = sleepFoundationsForAge(20, "pl");
    expect(tips.some((t) => t.includes("na żądanie"))).toBe(true);
    expect(tips.some((t) => t.includes("Stała pora porannej pobudki"))).toBe(false);
  });

  it("od 8 tyg.: stała pobudka, rutyna i odkładanie sennego dziecka", () => {
    const tips = sleepFoundationsForAge(120, "pl");
    expect(tips.some((t) => t.includes("na żądanie"))).toBe(false);
    expect(tips.some((t) => t.includes("Stała pora porannej pobudki"))).toBe(true);
    expect(tips.some((t) => t.includes("senne"))).toBe(true);
  });

  it("PL i EN mają tyle samo rad", () => {
    for (const age of [10, 100, 500]) {
      expect(sleepFoundationsForAge(age, "en")).toHaveLength(
        sleepFoundationsForAge(age, "pl").length,
      );
    }
  });
});
