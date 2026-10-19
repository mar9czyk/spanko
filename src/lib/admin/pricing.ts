/**
 * Szacunkowe ceny modeli OpenRouter w USD za 1 mln tokenów (wejście / wyjście).
 * Wartości orientacyjne — edytuj ręcznie wg aktualnego cennika OpenRouter.
 */
export interface ModelPricing {
  readonly inputUsdPerMTok: number;
  readonly outputUsdPerMTok: number;
}

export const MODEL_PRICING_USD_PER_MTOK: Readonly<Record<string, ModelPricing>> = {
  "google/gemini-2.5-flash": { inputUsdPerMTok: 0.3, outputUsdPerMTok: 2.5 },
  "openai/gpt-4o-mini": { inputUsdPerMTok: 0.15, outputUsdPerMTok: 0.6 },
  "anthropic/claude-sonnet-4.5": { inputUsdPerMTok: 3, outputUsdPerMTok: 15 },
};

export const DEFAULT_MODEL_PRICING: ModelPricing = { inputUsdPerMTok: 1, outputUsdPerMTok: 3 };
const TOKENS_PER_MILLION = 1_000_000;

/**
 * Szacuje koszt jednego wywołania w USD (model spoza tabeli → cena domyślna,
 * wywołania deterministyczne bez tokenów kosztują 0).
 *
 * @param {string | undefined} model - Nazwa modelu
 * @param {number | undefined} promptTokens - Tokeny wejściowe
 * @param {number | undefined} completionTokens - Tokeny wyjściowe
 * @returns {number} Szacowany koszt w USD
 */
export function estimateCallCostUsd(
  model: string | undefined,
  promptTokens: number | undefined,
  completionTokens: number | undefined,
): number {
  if (!model || model === "deterministic-fallback") return 0;
  const pricing = MODEL_PRICING_USD_PER_MTOK[model] ?? DEFAULT_MODEL_PRICING;
  return (
    ((promptTokens ?? 0) * pricing.inputUsdPerMTok +
      (completionTokens ?? 0) * pricing.outputUsdPerMTok) /
    TOKENS_PER_MILLION
  );
}
