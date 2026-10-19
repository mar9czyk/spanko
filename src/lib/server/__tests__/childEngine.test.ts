import { describe, expect, it } from "vitest";
import { resolveInsightStatus, resolveSignificantDiagnostics } from "@/lib/server/childEngine";
import type { DiagnosticTreeResult } from "@/lib/sleep-engine/types";

/**
 * Buduje minimalny wynik drzewa do testów wyboru diagnozy głównej.
 *
 * @param {Partial<DiagnosticTreeResult>} patch - Pola do nadpisania
 * @returns {DiagnosticTreeResult} Wynik drzewa
 */
function diag(patch: Partial<DiagnosticTreeResult>): DiagnosticTreeResult {
  return {
    category: "CAT1_ASSOCIATIONS_NIGHT_WAKINGS",
    diagnosisCode: "X",
    severity: "info",
    confidenceScore: 0.9,
    isTriggered: false,
    title: "t",
    explanation: "e",
    clinicalAction: "a",
    ...patch,
  };
}

describe("resolveSignificantDiagnostics", () => {
  it("stawia na początku diagnozę o najwyższej istotności, potem pewności", () => {
    const result = resolveSignificantDiagnostics([
      diag({ diagnosisCode: "INFO", isTriggered: true, severity: "info" }),
      diag({ diagnosisCode: "MED", isTriggered: true, severity: "medium", confidenceScore: 0.8 }),
      diag({ diagnosisCode: "HIGH", isTriggered: true, severity: "high", confidenceScore: 0.85 }),
      diag({ diagnosisCode: "OFF" }),
    ]);
    expect(result.map((d) => d.diagnosisCode)).toEqual(["HIGH", "MED", "INFO"]);
  });

  it("bez aktywnych diagnoz zwraca pierwszą kategorię", () => {
    expect(resolveSignificantDiagnostics([diag({ diagnosisCode: "A" })])[0]?.diagnosisCode).toBe(
      "A",
    );
  });
});

describe("resolveInsightStatus", () => {
  const problem = diag({ diagnosisCode: "P", isTriggered: true, severity: "medium" });

  it("nowa diagnoza problemu to hipoteza, powtórzona — aktywny wniosek", () => {
    expect(resolveInsightStatus(problem, undefined)).toBe("hypothesis");
    expect(resolveInsightStatus(problem, "OTHER")).toBe("hypothesis");
    expect(resolveInsightStatus(problem, "P")).toBe("active");
  });

  it("stan normy jest od razu aktywny", () => {
    expect(resolveInsightStatus(diag({}), undefined)).toBe("active");
  });
});
