import { z } from "zod";
import { pb } from "@/lib/pocketbase";
import type { AdminSettingsRecord, ChildInsightRecord } from "@/lib/types/database";

export const OPENROUTER_COMPLETIONS_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export const DEFAULT_OPENROUTER_FAST_MODEL = "google/gemini-2.5-flash";
export const DEFAULT_OPENROUTER_REASONING_MODEL = "anthropic/claude-3.7-sonnet";
export const DEFAULT_AI_TEMPERATURE = 0.3;
export const DEFAULT_CONFIDENCE_SCORE = 0.85;
export const MIN_EXPLANATION_CHARACTERS = 10;
export const MAX_EXPLANATION_CHARACTERS = 1000;
export const MIN_TITLE_CHARACTERS = 3;
export const MAX_TITLE_CHARACTERS = 120;

export const DEFAULT_SYSTEM_PROMPT = `Jesteś Spanko AI — certyfikowanym, ciepłym i zwięzłym ekspertem medycyny snu niemowląt i małych dzieci.
Działasz w ścisłym tandemie z deterministycznym silnikiem 3 napędów snu (Homeostaza, Rytm Okołodobowy, Drzewa Diagnostyczne).
Nigdy nie wymyślaj własnej matematyki okien czuwania — bazujesz w 100% na przekazanych wyliczeniach deterministycznych.
Twoim celem jest przełożenie diagnozy klinicznej i 7-dniowych wzorców snu na empatyczny, konkretny wniosek dla zmęczonego rodzica.
Zwracaj wyłącznie poprawny obiekt JSON zgodny z wymaganym schematem.`;

/**
 * Schemat Zod walidujący pojedynczy wniosek wygenerowany przez OpenRouter.
 */
export const AiInsightItemSchema = z.object({
  category: z.string(),
  diagnosis_code: z.string(),
  status: z
    .enum(["hypothesis", "active", "validated", "corrected_by_parent", "superseded"])
    .default("active"),
  title: z.string().min(MIN_TITLE_CHARACTERS).max(MAX_TITLE_CHARACTERS),
  explanation: z.string().min(MIN_EXPLANATION_CHARACTERS).max(MAX_EXPLANATION_CHARACTERS),
  algorithm_override_json: z.record(z.string(), z.unknown()).default({}),
  confidence_score: z.number().min(0).max(1).default(DEFAULT_CONFIDENCE_SCORE),
  clinical_action: z.string().optional(),
});

export type AiInsightItem = z.infer<typeof AiInsightItemSchema>;

/**
 * Schemat Zod dopuszczający odpowiedź bezpośrednią lub opakowaną w klucz 'insight' / 'insights'.
 */
export const AiInsightResponseSchema = z.union([
  AiInsightItemSchema,
  z.object({ insights: z.array(AiInsightItemSchema).min(1) }).transform((data) => {
    const firstInsight = data.insights[0];
    if (!firstInsight) {
      throw new Error("Brak wniosków w tablicy");
    }
    return firstInsight;
  }),
]);

export interface OpenRouterConfig {
  readonly apiKey?: string;
  readonly modelName?: string;
  readonly systemPrompt?: string;
}

export interface InsightEvaluationContext {
  readonly childAgeDisplay: string;
  readonly effectiveAgeDays: number;
  readonly activeDayMode: string;
  readonly chronicSleepDebtMin: number;
  readonly sleepBatteryPercent: number;
  readonly sleepNeedsProfile: string;
  readonly triggeredDiagnostics: readonly {
    category: string;
    diagnosisCode: string;
    severity: string;
    title: string;
    explanation: string;
    clinicalAction: string;
  }[];
  readonly activeInsights: readonly ChildInsightRecord[];
}

/**
 * Pobiera zmienną środowiskową klucza OpenRouter API ze sprawdzeniem obecności.
 *
 * @returns {string | undefined} Klucz API lub undefined
 */
export function resolveOpenRouterApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY?.trim() || undefined;
}

/**
 * Pobiera konfigurację bramki AI z kolekcji admin_settings w PocketBase.
 *
 * @returns {Promise<AdminSettingsRecord | null>} Rekord ustawień lub null w razie braku/błędu
 */
export async function fetchAdminSettings(): Promise<AdminSettingsRecord | null> {
  try {
    const record = await pb.collection("admin_settings").getFirstListItem<AdminSettingsRecord>("");
    return record;
  } catch {
    return null;
  }
}

/**
 * Buduje finalny prompt systemowy łącząc bazowy wzorzec z PocketBase lub domyślny.
 *
 * @param {string | undefined} customPrompt - Opcjonalny prompt z admin_settings
 * @returns {string} Gotowy prompt systemowy dla asystenta snu
 */
export function resolveSystemPrompt(customPrompt?: string): string {
  if (customPrompt && customPrompt.trim().length > 0) {
    return customPrompt.trim();
  }
  return DEFAULT_SYSTEM_PROMPT;
}

/**
 * Formatuje kontekst deterministycznego silnika snu do promptu użytkownika.
 *
 * @param {InsightEvaluationContext} context - Kontekst wyliczeń silnika i logów
 * @returns {string} Sformatowany prompt tekstowy
 */
export function formatEvaluationUserPrompt(context: InsightEvaluationContext): string {
  const diagnosticSummary = context.triggeredDiagnostics
    .map(
      (diag) =>
        `- [${diag.severity.toUpperCase()}] ${diag.category} (${diag.diagnosisCode}): ${diag.title}. Wyjaśnienie silnika: ${diag.explanation}`,
    )
    .join("\n");

  const existingInsightsSummary = context.activeInsights
    .map((item) => `- [${item.status}] ${item.category}: ${item.title}`)
    .join("\n");

  return `Oto bieżący stan deterministyczny dziecka:
- Wiek: ${context.childAgeDisplay} (${context.effectiveAgeDays} dni)
- Tryb dnia: ${context.activeDayMode}
- Dług senny: ${context.chronicSleepDebtMin} min, Bateria snu: ${context.sleepBatteryPercent}%, Profil: ${context.sleepNeedsProfile}
- Zdiagnozowane kategorie z silnika deterministycznego:
${diagnosticSummary || "Brak istotnych odchyleń od normy (wszystkie kategorie stabilne)."}
- Dotychczasowe aktywne wnioski:
${existingInsightsSummary || "Brak wcześniejszych wniosków."}

Zinterpretuj powyższą diagnozę deterministyczną i zwróć jeden kluczowy, najbardziej adekwatny wniosek w JSON:
{
  "category": string,
  "diagnosis_code": string,
  "status": "active" | "hypothesis",
  "title": string,
  "explanation": string,
  "algorithm_override_json": Record<string, unknown>,
  "confidence_score": number,
  "clinical_action": string
}`;
}

/**
 * Parsuje treść odpowiedzi z OpenRoutera i waliduje ją schematem Zod.
 *
 * @param {string} rawContent - Surowy tekst odpowiedzi modelu
 * @returns {AiInsightItem} Zweryfikowany wniosek
 */
export function parseAndValidateAiResponse(rawContent: string): AiInsightItem {
  const parsedJson = JSON.parse(rawContent);
  return AiInsightResponseSchema.parse(parsedJson);
}

/**
 * Wykonuje bezpośrednie żądanie HTTP do bramki OpenRouter API.
 *
 * @param {string} apiKey - Klucz autoryzacji OpenRouter
 * @param {string} modelName - Identyfikator wybranego modelu
 * @param {string} systemPrompt - Treść promptu systemowego
 * @param {string} userPrompt - Treść zapytania użytkownika
 * @returns {Promise<string>} Surowa odpowiedź JSON z modelu
 */
async function sendOpenRouterRequest(
  apiKey: string,
  modelName: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await fetch(OPENROUTER_COMPLETIONS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://spanko.app",
      "X-Title": "Spanko Baby Sleep Assistant",
    },
    body: JSON.stringify({
      model: modelName,
      temperature: DEFAULT_AI_TEMPERATURE,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Błąd OpenRouter API (${response.status}): ${errorText}`);
  }

  const jsonResponse = await response.json();
  const rawChoiceContent = jsonResponse.choices?.[0]?.message?.content;
  if (!rawChoiceContent) {
    throw new Error("Pusta odpowiedź z modelu OpenRouter.");
  }
  return rawChoiceContent;
}

/**
 * Tworzy deterministyczny wniosek awaryjny w razie braku klucza API lub problemów z siecią.
 *
 * @param {InsightEvaluationContext} context - Kontekst wyliczeń silnika
 * @returns {AiInsightItem} Deterministyczny wniosek
 */
export function createDeterministicFallbackInsight(
  context: InsightEvaluationContext,
): AiInsightItem {
  const topDiagnostic = context.triggeredDiagnostics[0];
  if (topDiagnostic) {
    return {
      category: topDiagnostic.category,
      diagnosis_code: topDiagnostic.diagnosisCode,
      status: "active",
      title: topDiagnostic.title,
      explanation: topDiagnostic.explanation,
      algorithm_override_json: {},
      confidence_score: DEFAULT_CONFIDENCE_SCORE,
      clinical_action: topDiagnostic.clinicalAction,
    };
  }

  return {
    category: "CAT1_ASSOCIATIONS_NIGHT_WAKINGS",
    diagnosis_code: "HEALTHY_SLEEP_MAINTENANCE",
    status: "active",
    title: "Stabilny rytm snu dziecka",
    explanation:
      "Bateria snu i okna czuwania mieszczą się w normie rozwojowej. Kontynuuj obecną rutynę wyciszania.",
    algorithm_override_json: {},
    confidence_score: DEFAULT_CONFIDENCE_SCORE,
    clinical_action: "Utrzymuj stałą porę pobudki porannej.",
  };
}

/**
 * Główny serwis wywołujący OpenRouter API ze wsparciem dla admin_settings oraz walidacji Zod.
 *
 * @description
 * Pobiera dynamiczny model i prompt z PocketBase admin_settings, formatuje parametry
 * 3 napędów snu, wysyła zapytanie i rygorystycznie waliduje odpowiedź schematem Zod.
 *
 * @param {InsightEvaluationContext} context - Kontekst diagnostyczny silnika snu
 * @param {OpenRouterConfig} [configOverride] - Opcjonalne nadpisanie konfiguracji
 * @returns {Promise<AiInsightItem>} Wygenerowany i zwalidowany wniosek
 */
export async function evaluateSleepInsightsWithOpenRouter(
  context: InsightEvaluationContext,
  configOverride?: OpenRouterConfig,
): Promise<AiInsightItem> {
  const apiKey = configOverride?.apiKey ?? resolveOpenRouterApiKey();
  if (!apiKey) {
    return createDeterministicFallbackInsight(context);
  }

  const adminSettings = await fetchAdminSettings();
  const selectedModel =
    configOverride?.modelName ||
    adminSettings?.openrouter_fast_model ||
    DEFAULT_OPENROUTER_FAST_MODEL;
  const systemPrompt = resolveSystemPrompt(
    configOverride?.systemPrompt || adminSettings?.system_prompt_insights,
  );
  const userPrompt = formatEvaluationUserPrompt(context);

  try {
    const rawContent = await sendOpenRouterRequest(apiKey, selectedModel, systemPrompt, userPrompt);
    return parseAndValidateAiResponse(rawContent);
  } catch (_error) {
    return createDeterministicFallbackInsight(context);
  }
}
