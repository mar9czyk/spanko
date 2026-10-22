import { describe, expect, it } from "vitest";
import { DIAGNOSIS_CODES, localizeDiagnosticTexts } from "../index";
import type { DiagnosticTreeResult } from "../types";

function stub(code: string, patch: Partial<DiagnosticTreeResult> = {}): DiagnosticTreeResult {
  return {
    category: "CAT1_ASSOCIATIONS_NIGHT_WAKINGS",
    diagnosisCode: code,
    severity: "info",
    confidenceScore: 0.8,
    isTriggered: true,
    title: "PL tytuł",
    explanation: "PL wyjaśnienie",
    clinicalAction: "PL działanie",
    ...patch,
  };
}

describe("localizeDiagnosticTexts", () => {
  it("każdy kod diagnozy ma angielski tekst bez polskich znaków", () => {
    for (const code of Object.values(DIAGNOSIS_CODES)) {
      // Kod zarezerwowany: żadne drzewo go jeszcze nie zwraca
      if (code === DIAGNOSIS_CODES.CAT6_DAY_NIGHT_CONFUSION) continue;
      const result = localizeDiagnosticTexts(stub(code), "en");
      for (const text of [result.title, result.explanation, result.clinicalAction]) {
        expect(text, code).not.toMatch(/^PL /);
        expect(text, code).not.toMatch(/[ąćęłńóśźż]/i);
      }
    }
  });

  it("po polsku i dla nieznanego kodu zwraca wynik bez zmian", () => {
    const pl = stub(DIAGNOSIS_CODES.CAT1_HEALTHY);
    expect(localizeDiagnosticTexts(pl, "pl")).toBe(pl);
    const unknown = stub("SOMETHING_NEW");
    expect(localizeDiagnosticTexts(unknown, "en")).toBe(unknown);
  });

  it("zachowuje pola liczbowe i nadpisania algorytmu", () => {
    const override = { wakeWindowOffsetMinutes: 15, shiftEveryDays: 3 };
    const result = localizeDiagnosticTexts(
      stub(DIAGNOSIS_CODES.CAT4_TRANSITION_READY, {
        title: "Gotowość do przejścia na jedną drzemkę",
        algorithmOverride: override,
      }),
      "en",
    );
    expect(result.title).toBe("Ready to move to one nap");
    expect(result.algorithmOverride).toBe(override);
    expect(result.confidenceScore).toBe(0.8);
  });

  it("wybiera wariant 3→2 i wariant tekstu noworodka/karmienia", () => {
    expect(localizeDiagnosticTexts(stub(DIAGNOSIS_CODES.CAT4_TRANSITION_READY), "en").title).toBe(
      "Ready to move from three naps to two",
    );
    expect(
      localizeDiagnosticTexts(
        stub(DIAGNOSIS_CODES.CAT6_NEWBORN_GUARDRAIL, { clinicalAction: "Budź dziecko…" }),
        "en",
      ).clinicalAction,
    ).toContain("Wake your baby from the daytime nap");
    expect(
      localizeDiagnosticTexts(
        stub(DIAGNOSIS_CODES.CAT7_HABITUAL_FEEDING, {
          explanation: "x Między 6. a 9. miesiącem",
          clinicalAction: "… laktację …",
        }),
        "en",
      ),
    ).toMatchObject({
      explanation: expect.stringContaining("Between 6 and 9 months"),
      clinicalAction: expect.stringContaining("lactation consultant"),
    });
  });
});
