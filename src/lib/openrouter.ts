import { z } from "zod";
import { getServiceClient } from "@/lib/server/auth";
import type {
  AdminSettingsRecord,
  AiCallKind,
  AiCallStatus,
  ChildInsightRecord,
} from "@/lib/types/database";

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

export const ADMIN_SETTINGS_CACHE_TTL_MS = 30_000;

export interface AiCallAudit {
  readonly kind: AiCallKind;
  readonly childId?: string;
  readonly householdId?: string;
  /** Wynik silnika deterministycznego zapisywany w ai_calls.request_snapshot_json */
  readonly requestSnapshot?: Record<string, unknown>;
}

export interface OpenRouterConfig {
  readonly apiKey?: string;
  readonly modelName?: string;
  readonly systemPrompt?: string;
  /** Gdy podane, wywołanie jest logowane w kolekcji ai_calls */
  readonly audit?: AiCallAudit;
}

export interface InsightEvaluationOutcome {
  readonly insight: AiInsightItem;
  readonly callId: string | null;
  readonly model: string;
  readonly status: AiCallStatus;
  readonly errorMessage?: string;
  readonly rawResponse?: string;
  readonly latencyMs: number;
}

export interface OpenRouterRawResult {
  readonly content: string;
  readonly promptTokens?: number;
  readonly completionTokens?: number;
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

let adminSettingsCache: { readonly value: AdminSettingsRecord; readonly expiresAt: number } | null =
  null;

/**
 * Czyści pamięć podręczną ustawień (po zapisie w panelu admina).
 */
export function invalidateAdminSettingsCache(): void {
  adminSettingsCache = null;
}

/**
 * Pobiera konfigurację bramki AI z kolekcji admin_settings w PocketBase (cache 30 s).
 *
 * @returns {Promise<AdminSettingsRecord | null>} Rekord ustawień lub null w razie braku/błędu
 */
export async function fetchAdminSettings(): Promise<AdminSettingsRecord | null> {
  if (adminSettingsCache && adminSettingsCache.expiresAt > Date.now()) {
    return adminSettingsCache.value;
  }
  try {
    const serviceClient = await getServiceClient();
    if (!serviceClient) {
      return null;
    }
    const result = await serviceClient
      .collection("admin_settings")
      .getList<AdminSettingsRecord>(1, 1);
    const record = result.items[0] ?? null;
    if (record) {
      adminSettingsCache = { value: record, expiresAt: Date.now() + ADMIN_SETTINGS_CACHE_TTL_MS };
    }
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
 * @returns {Promise<OpenRouterRawResult>} Surowa odpowiedź JSON z modelu wraz z zużyciem tokenów
 */
export async function sendOpenRouterRequest(
  apiKey: string,
  modelName: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<OpenRouterRawResult> {
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
  return {
    content: rawChoiceContent,
    promptTokens: jsonResponse.usage?.prompt_tokens,
    completionTokens: jsonResponse.usage?.completion_tokens,
  };
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
 * Buduje zrzut wejścia silnika (diagnozy i metryki) do zapisu w ai_calls.request_snapshot_json.
 *
 * @param {InsightEvaluationContext} context - Kontekst diagnostyczny
 * @returns {Record<string, unknown>} Zrzut z diagnosisCode i metricsSnapshot
 */
export function buildRequestSnapshot(context: InsightEvaluationContext): Record<string, unknown> {
  return {
    diagnosticsSnapshot: context.triggeredDiagnostics.map((diag) => ({
      category: diag.category,
      diagnosisCode: diag.diagnosisCode,
      severity: diag.severity,
    })),
    metricsSnapshot: {
      effectiveAgeDays: context.effectiveAgeDays,
      activeDayMode: context.activeDayMode,
      chronicSleepDebtMin: context.chronicSleepDebtMin,
      sleepBatteryPercent: context.sleepBatteryPercent,
      sleepNeedsProfile: context.sleepNeedsProfile,
    },
  };
}

/**
 * Zapisuje wywołanie AI w ai_calls (best effort — błąd zapisu nigdy nie przerywa odpowiedzi).
 *
 * @param {AiCallAudit} audit - Metadane wywołania
 * @param {object} details - Wynik wywołania
 * @returns {Promise<string | null>} Id rekordu logu lub null
 */
export async function logAiCall(
  audit: AiCallAudit,
  details: {
    model: string;
    status: AiCallStatus;
    responseJson?: unknown;
    errorMessage?: string;
    promptTokens?: number;
    completionTokens?: number;
    latencyMs: number;
  },
): Promise<string | null> {
  try {
    const serviceClient = await getServiceClient();
    if (!serviceClient) {
      return null;
    }
    const record = await serviceClient.collection("ai_calls").create({
      child_id: audit.childId || undefined,
      household_id: audit.householdId || undefined,
      kind: audit.kind,
      model: details.model,
      request_snapshot_json: audit.requestSnapshot ?? {},
      response_json: details.responseJson ?? null,
      status: details.status,
      error_message: details.errorMessage?.slice(0, 2000),
      prompt_tokens: details.promptTokens,
      completion_tokens: details.completionTokens,
      latency_ms: details.latencyMs,
    });
    return record.id;
  } catch {
    return null;
  }
}

/**
 * Wiąże wpis logu ai_calls z zapisanym wnioskiem (best effort).
 *
 * @param {string | null} callId - Id wpisu w ai_calls
 * @param {string} insightId - Id wniosku child_insights
 */
export async function linkAiCallToInsight(callId: string | null, insightId: string): Promise<void> {
  if (!callId) return;
  try {
    const serviceClient = await getServiceClient();
    await serviceClient?.collection("ai_calls").update(callId, { insight_id: insightId });
  } catch {
    // Brak powiązania nie wpływa na działanie aplikacji
  }
}

/**
 * Parsuje odpowiedź modelu do obiektu do logu (surowy tekst, gdy to nie JSON).
 *
 * @param {string} rawContent - Odpowiedź modelu
 * @returns {unknown} Obiekt JSON lub `{ raw }`
 */
function toLoggableResponse(rawContent: string): unknown {
  try {
    return JSON.parse(rawContent);
  } catch {
    return { raw: rawContent.slice(0, 4000) };
  }
}

/**
 * Wywołuje OpenRouter (model i prompt z admin_settings lub nadpisania), waliduje odpowiedź zod-em
 * i — gdy podano `audit` — loguje wywołanie w ai_calls.
 *
 * @param {InsightEvaluationContext} context - Kontekst diagnostyczny silnika snu
 * @param {OpenRouterConfig} [configOverride] - Opcjonalne nadpisanie konfiguracji i metadane logu
 * @returns {Promise<InsightEvaluationOutcome>} Wniosek wraz ze statusem wywołania
 */
export async function runInsightEvaluation(
  context: InsightEvaluationContext,
  configOverride?: OpenRouterConfig,
): Promise<InsightEvaluationOutcome> {
  const startedAt = Date.now();
  const audit = configOverride?.audit;
  const apiKey = configOverride?.apiKey ?? resolveOpenRouterApiKey();

  const finish = async (
    result: Omit<InsightEvaluationOutcome, "callId" | "latencyMs">,
    extra: { promptTokens?: number; completionTokens?: number } = {},
  ): Promise<InsightEvaluationOutcome> => {
    const latencyMs = Date.now() - startedAt;
    const callId = audit
      ? await logAiCall(audit, {
          model: result.model,
          status: result.status,
          responseJson: result.rawResponse
            ? toLoggableResponse(result.rawResponse)
            : result.insight,
          errorMessage: result.errorMessage,
          latencyMs,
          ...extra,
        })
      : null;
    return { ...result, callId, latencyMs };
  };

  if (!apiKey) {
    return finish({
      insight: createDeterministicFallbackInsight(context),
      model: "deterministic-fallback",
      status: "error",
      errorMessage: "Brak OPENROUTER_API_KEY — użyto wniosku deterministycznego.",
    });
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

  let raw: OpenRouterRawResult | null = null;
  try {
    raw = await sendOpenRouterRequest(apiKey, selectedModel, systemPrompt, userPrompt);
    const insight = parseAndValidateAiResponse(raw.content);
    return await finish(
      { insight, model: selectedModel, status: "ok", rawResponse: raw.content },
      { promptTokens: raw.promptTokens, completionTokens: raw.completionTokens },
    );
  } catch (error) {
    const reachedModel = raw !== null;
    return await finish(
      {
        insight: createDeterministicFallbackInsight(context),
        model: selectedModel,
        status: reachedModel ? "invalid_json" : "error",
        errorMessage: error instanceof Error ? error.message : "Nieznany błąd OpenRouter.",
        rawResponse: raw?.content,
      },
      { promptTokens: raw?.promptTokens, completionTokens: raw?.completionTokens },
    );
  }
}

/**
 * Główny serwis wywołujący OpenRouter API ze wsparciem dla admin_settings oraz walidacji Zod.
 *
 * @description
 * Skrót nad `runInsightEvaluation` zwracający sam wniosek (przy błędzie — wniosek deterministyczny).
 *
 * @param {InsightEvaluationContext} context - Kontekst diagnostyczny silnika snu
 * @param {OpenRouterConfig} [configOverride] - Opcjonalne nadpisanie konfiguracji
 * @returns {Promise<AiInsightItem>} Wygenerowany i zwalidowany wniosek
 */
export async function evaluateSleepInsightsWithOpenRouter(
  context: InsightEvaluationContext,
  configOverride?: OpenRouterConfig,
): Promise<AiInsightItem> {
  return (await runInsightEvaluation(context, configOverride)).insight;
}
