import { describe, expect, it, vi } from "vitest";
import type { InsightEvaluationContext } from "../openrouter";
import {
  createDeterministicFallbackInsight,
  DEFAULT_SYSTEM_PROMPT,
  evaluateSleepInsightsWithOpenRouter,
  formatEvaluationUserPrompt,
  parseAndValidateAiResponse,
  resolveSystemPrompt,
} from "../openrouter";

const mockContext: InsightEvaluationContext = {
  childAgeDisplay: "5 miesięcy",
  effectiveAgeDays: 150,
  activeDayMode: "home",
  chronicSleepDebtMin: 45,
  sleepBatteryPercent: 78,
  sleepNeedsProfile: "average",
  triggeredDiagnostics: [
    {
      category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
      diagnosisCode: "OVERTIRED_FUSS",
      severity: "medium",
      title: "Przemęczenie wieczorne",
      explanation: "Wieczorny opór przed snem wynika z długu sennego.",
      clinicalAction: "Skróć ostatnie okno czuwania o 15 minut.",
    },
  ],
  activeInsights: [],
};

describe("openrouter service", () => {
  it("resolveSystemPrompt: używa promptu z bazy lub zwraca domyślny wzorzec", () => {
    expect(resolveSystemPrompt("")).toBe(DEFAULT_SYSTEM_PROMPT);
    expect(resolveSystemPrompt("   ")).toBe(DEFAULT_SYSTEM_PROMPT);
    expect(resolveSystemPrompt("Własny prompt")).toBe("Własny prompt");
  });

  it("formatEvaluationUserPrompt: zawiera wiek, stan i zdiagnozowane drzewa", () => {
    const prompt = formatEvaluationUserPrompt(mockContext);
    expect(prompt).toContain("5 miesięcy");
    expect(prompt).toContain("CAT2_BEDTIME_RESISTANCE_LATENCY");
    expect(prompt).toContain("Przemęczenie wieczorne");
  });

  it("parseAndValidateAiResponse: prawidłowo waliduje poprawny JSON", () => {
    const validJson = JSON.stringify({
      category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
      diagnosis_code: "OVERTIRED_FUSS",
      status: "active",
      title: "Skracamy wieczorne okno o 15 min",
      explanation: "Maluch jest wieczorem przemęczony, co utrudnia wyciszenie.",
      algorithm_override_json: { wwOffsetMin: -15 },
      confidence_score: 0.9,
    });

    const result = parseAndValidateAiResponse(validJson);
    expect(result.category).toBe("CAT2_BEDTIME_RESISTANCE_LATENCY");
    expect(result.title).toBe("Skracamy wieczorne okno o 15 min");
    expect(result.confidence_score).toBe(0.9);
  });

  it("parseAndValidateAiResponse: obsługuje odpowiedź opakowaną w obiekt insights", () => {
    const wrappedJson = JSON.stringify({
      insights: [
        {
          category: "CAT4_SHORT_NAPS_TRANSITIONS",
          diagnosis_code: "MICRO_NAP_CRISIS",
          status: "hypothesis",
          title: "Łączenie cykli drzemek",
          explanation: "Drzemki trwają 30 minut, co wskazuje na potrzebę wydłużenia okna.",
          algorithm_override_json: {},
          confidence_score: 0.8,
        },
      ],
    });

    const result = parseAndValidateAiResponse(wrappedJson);
    expect(result.category).toBe("CAT4_SHORT_NAPS_TRANSITIONS");
    expect(result.diagnosis_code).toBe("MICRO_NAP_CRISIS");
  });

  it("parseAndValidateAiResponse: rzuca błąd przy niepoprawnym schemacie", () => {
    const invalidJson = JSON.stringify({
      title: "Zbyt krótki",
    });

    expect(() => parseAndValidateAiResponse(invalidJson)).toThrow();
  });

  it("createDeterministicFallbackInsight: generuje wniosek z najwyższej diagnozy", () => {
    const fallback = createDeterministicFallbackInsight(mockContext);
    expect(fallback.category).toBe("CAT2_BEDTIME_RESISTANCE_LATENCY");
    expect(fallback.diagnosis_code).toBe("OVERTIRED_FUSS");
    expect(fallback.status).toBe("active");
  });

  it("createDeterministicFallbackInsight: zwraca bezpieczny domyślny wniosek przy pustej liście diagnoz", () => {
    const emptyContext: InsightEvaluationContext = {
      ...mockContext,
      triggeredDiagnostics: [],
    };
    const fallback = createDeterministicFallbackInsight(emptyContext);
    expect(fallback.diagnosis_code).toBe("HEALTHY_SLEEP_MAINTENANCE");
  });

  it("evaluateSleepInsightsWithOpenRouter: zwraca deterministyczny fallback w razie braku klucza API", async () => {
    const originalKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    const result = await evaluateSleepInsightsWithOpenRouter(mockContext);
    expect(result.diagnosis_code).toBe("OVERTIRED_FUSS");

    if (originalKey) {
      process.env.OPENROUTER_API_KEY = originalKey;
    }
  });

  it("evaluateSleepInsightsWithOpenRouter: wywołuje mock OpenRouter API gdy klucz jest dostępny", async () => {
    const mockApiResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
              diagnosis_code: "OVERTIRED_FUSS",
              status: "active",
              title: "Wcześniejsza pora snu",
              explanation: "Zalecamy rozpoczęcie rytuału o 19:15, aby uniknąć zmęczenia.",
              algorithm_override_json: { wwOffsetMin: -15 },
              confidence_score: 0.95,
            }),
          },
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("openrouter.ai")) {
        return {
          ok: true,
          json: async () => mockApiResponse,
        } as Response;
      }
      throw new Error("PB offline in test");
    });

    const result = await evaluateSleepInsightsWithOpenRouter(mockContext, {
      apiKey: "test-fake-key",
      modelName: "google/gemini-2.5-flash",
    });

    expect(result.title).toBe("Wcześniejsza pora snu");
    expect(result.confidence_score).toBe(0.95);

    fetchSpy.mockRestore();
  });
});
