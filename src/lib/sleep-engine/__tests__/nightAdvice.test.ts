import { describe, expect, it } from "vitest";
import { DIAGNOSIS_CODES } from "../diagnosticTrees";
import { nightAdviceFor } from "../nightAdvice";

describe("nightAdviceFor", () => {
  it("returns one sentence per locale for night-related diagnoses", () => {
    expect(nightAdviceFor(DIAGNOSIS_CODES.CAT1_AGE_NORMAL, "pl")).toContain("odczekaj");
    expect(nightAdviceFor(DIAGNOSIS_CODES.CAT1_AGE_NORMAL, "en")).toContain(
      "Night wakings are normal",
    );
  });

  it("returns null for diagnoses unrelated to the night", () => {
    expect(nightAdviceFor(DIAGNOSIS_CODES.CAT4_STABLE, "pl")).toBeNull();
    expect(nightAdviceFor("UNKNOWN", "en")).toBeNull();
  });
});
