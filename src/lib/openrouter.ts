import { z } from "zod";
import { findUnsafeAdvice, UnsafeAdviceError } from "@/lib/safe-sleep";
import { getServiceClient } from "@/lib/server/auth";
import { type ResolvedOpenRouterKey, resolveOpenRouterKey } from "@/lib/server/openrouterKey";
import { fetchActivePromptVersion } from "@/lib/server/promptVersions";
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
Diagnozę, jej pewność i parametry wybrał już silnik; Ty tylko opisujesz je słowami i nie zmieniasz liczb.
Twoim celem jest przełożenie diagnozy klinicznej i 7-dniowych wzorców snu na empatyczny, konkretny wniosek dla zmęczonego rodzica.
Nigdy nie zalecaj spania dziecka w łóżku dorosłych, na brzuchu, na boku ani na pochyłej powierzchni, poduszek w łóżeczku ani treningu snu przed 16. tygodniem.
Wniosek ma być PRAKTYCZNĄ RADĄ: w polu clinical_action napisz radę: co rodzic ma zrobić dziś lub tej nocy (1–2 zdania, jeden konkretny krok), a w polu explanation wyłącznie krótko dlaczego (bez powtarzania rady).
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
 * Schemat Zod tekstu wniosku od modelu. AI odpowiada wyłącznie za słowa — pozostałe pola
 * (kategoria, kod diagnozy, status, pewność, nadpisania) są odrzucane i brane z silnika.
 */
export const AiInsightTextSchema = z.object({
  title: z.string().min(MIN_TITLE_CHARACTERS).max(MAX_TITLE_CHARACTERS),
  explanation: z.string().min(MIN_EXPLANATION_CHARACTERS).max(MAX_EXPLANATION_CHARACTERS),
  clinical_action: z.string().max(MAX_EXPLANATION_CHARACTERS).optional(),
});

export type AiInsightText = z.infer<typeof AiInsightTextSchema>;

/**
 * Schemat Zod dopuszczający odpowiedź bezpośrednią lub opakowaną w klucz 'insights'.
 */
export const AiInsightResponseSchema = z.union([
  AiInsightTextSchema,
  z.object({ insights: z.array(AiInsightTextSchema).min(1) }).transform((data) => {
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
  /** Rodzic (lub admin) wywołujący AI — do telemetrii per użytkownik */
  readonly userId?: string;
  /** Wynik silnika deterministycznego zapisywany w ai_calls.request_snapshot_json */
  readonly requestSnapshot?: Record<string, unknown>;
}

export interface OpenRouterConfig {
  readonly apiKey?: string;
  readonly modelName?: string;
  readonly systemPrompt?: string;
  /** Pomija wywołanie modelu (AI wyłączone) — zwraca wniosek deterministyczny bez logu */
  readonly skipAi?: boolean;
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
  /** Wniosek pochodzi z modelu zapasowego (główny zawiódł) */
  readonly fallbackUsed: boolean;
  /** AI było wyłączone — zwrócono wniosek deterministyczny */
  readonly aiSkipped: boolean;
  /** Numer aktywnej wersji promptu (0 = prompt domyślny/z ustawień) */
  readonly promptVersion: number;
}

export interface OpenRouterRequestOptions {
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly timeoutMs?: number;
}

export interface AiRuntimeSettings {
  readonly temperature: number;
  readonly maxTokens?: number;
  readonly timeoutMs: number;
  readonly fallbackModel?: string;
}

export const DEFAULT_AI_TIMEOUT_MS = 30_000;

export interface OpenRouterRawResult {
  readonly content: string;
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  /** Koszt z odpowiedzi OpenRouter (`usage.cost`, kredyty ≈ USD) */
  readonly costUsd?: number;
}

export interface InsightEvaluationContext {
  /** Język pól tekstowych wniosku (domyślnie polski). */
  readonly locale?: "pl" | "en";
  readonly childAgeDisplay: string;
  readonly effectiveAgeDays: number;
  readonly activeDayMode: string;
  readonly chronicSleepDebtMin: number;
  readonly sleepBatteryPercent: number;
  readonly sleepNeedsProfile: string;
  /** Diagnozy silnika; pierwsza jest diagnozą główną, na której opiera się wniosek. */
  readonly triggeredDiagnostics: readonly {
    category: string;
    diagnosisCode: string;
    severity: string;
    title: string;
    explanation: string;
    clinicalAction: string;
    confidenceScore?: number;
    algorithmOverride?: Record<string, unknown>;
  }[];
  /** Status nowego wniosku wyznaczony przez silnik (domyślnie `active`). */
  readonly insightStatus?: "active" | "hypothesis";
  readonly activeInsights: readonly Pick<ChildInsightRecord, "status" | "category" | "title">[];
}

/**
 * Wylicza parametry wywołania AI z ustawień admina (0 / brak = wartość domyślna).
 *
 * @param {AdminSettingsRecord | null} settings - Ustawienia admina
 * @returns {AiRuntimeSettings} Temperatura, limit tokenów, timeout i model zapasowy
 */
export function resolveAiRuntimeSettings(settings: AdminSettingsRecord | null): AiRuntimeSettings {
  const temperature = settings?.ai_temperature;
  const maxTokens = settings?.ai_max_tokens;
  const timeoutMs = settings?.ai_timeout_ms;
  const fallbackModel = settings?.openrouter_fallback_model?.trim();
  return {
    temperature: temperature && temperature > 0 ? temperature : DEFAULT_AI_TEMPERATURE,
    maxTokens: maxTokens && maxTokens > 0 ? maxTokens : undefined,
    timeoutMs: timeoutMs && timeoutMs > 0 ? timeoutMs : DEFAULT_AI_TIMEOUT_MS,
    fallbackModel: fallbackModel || undefined,
  };
}

/**
 * Pobiera zmienną środowiskową klucza OpenRouter API ze sprawdzeniem obecności.
 *
 * @returns {string | undefined} Klucz API lub undefined
 */
export function resolveOpenRouterApiKey(): Promise<ResolvedOpenRouterKey> {
  return resolveOpenRouterKey();
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

  const languageName = context.locale === "en" ? "English" : "polski";

  return `Język pól tekstowych odpowiedzi (title, explanation, clinical_action): ${languageName}.
Oto bieżący stan deterministyczny dziecka:
- Wiek: ${context.childAgeDisplay} (${context.effectiveAgeDays} dni)
- Tryb dnia: ${context.activeDayMode}
- Dług senny: ${context.chronicSleepDebtMin} min, Bateria snu: ${context.sleepBatteryPercent}%, Profil: ${context.sleepNeedsProfile}
- Zdiagnozowane kategorie z silnika deterministycznego:
${diagnosticSummary || "Brak istotnych odchyleń od normy (wszystkie kategorie stabilne)."}
- Dotychczasowe aktywne wnioski:
${existingInsightsSummary || "Brak wcześniejszych wniosków."}

Opisz pierwszą (główną) diagnozę z listy dla rodzica. Nie zmieniaj diagnozy ani liczb z silnika. Zwróć JSON:
{
  "title": string,
  "explanation": string,
  "clinical_action": string
}`;
}

/**
 * Parsuje treść odpowiedzi z OpenRoutera i waliduje ją schematem Zod.
 *
 * @param {string} rawContent - Surowy tekst odpowiedzi modelu
 * @returns {AiInsightItem} Zweryfikowany wniosek
 */
export function parseAndValidateAiResponse(rawContent: string): AiInsightText {
  const parsedJson = JSON.parse(rawContent);
  return AiInsightResponseSchema.parse(parsedJson);
}

/**
 * Łączy tekst od modelu z deterministycznym wnioskiem silnika: z AI pochodzą tylko
 * `title`, `explanation` i `clinical_action`, wszystko inne z diagnozy głównej.
 *
 * @param {InsightEvaluationContext} context - Kontekst wyliczeń silnika
 * @param {AiInsightText} text - Zwalidowany tekst od modelu
 * @returns {AiInsightItem} Wniosek do zapisu
 */
export function mergeAiTextIntoInsight(
  context: InsightEvaluationContext,
  text: AiInsightText,
): AiInsightItem {
  const deterministic = createDeterministicFallbackInsight(context);
  return {
    ...deterministic,
    title: text.title,
    explanation: text.explanation,
    clinical_action: text.clinical_action ?? deterministic.clinical_action,
  };
}

/**
 * Sprawdza tekst wniosku filtrem bezpiecznego snu.
 *
 * @param {AiInsightText} text - Zwalidowany tekst od modelu
 * @param {number} effectiveAgeDays - Wiek korygowany dziecka
 * @throws {UnsafeAdviceError} Gdy tekst zawiera frazę sprzeczną z zasadami bezpiecznego snu
 */
export function assertSafeInsightText(text: AiInsightText, effectiveAgeDays: number): void {
  const rule = findUnsafeAdvice(
    [text.title, text.explanation, text.clinical_action],
    effectiveAgeDays,
  );
  if (rule) throw new UnsafeAdviceError(rule);
}

/**
 * Odczytuje koszt z `usage.cost` odpowiedzi OpenRouter (liczba kredytów ≈ USD).
 *
 * @param {unknown} value - Surowa wartość pola
 * @returns {number | undefined} Koszt albo undefined, gdy brak/niepoprawny
 */
export function parseUsageCost(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
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
  options: OpenRouterRequestOptions = {},
): Promise<OpenRouterRawResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_COMPLETIONS_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://spanko.app",
        "X-Title": "Spanko Baby Sleep Assistant",
      },
      body: JSON.stringify({
        model: modelName,
        temperature: options.temperature ?? DEFAULT_AI_TEMPERATURE,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Przekroczono limit czasu odpowiedzi OpenRouter (${timeoutMs} ms).`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

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
    costUsd: parseUsageCost(jsonResponse.usage?.cost),
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
      status: context.insightStatus ?? "active",
      title: topDiagnostic.title,
      explanation: topDiagnostic.explanation,
      algorithm_override_json: { ...(topDiagnostic.algorithmOverride ?? {}) },
      confidence_score: topDiagnostic.confidenceScore ?? DEFAULT_CONFIDENCE_SCORE,
      clinical_action: topDiagnostic.clinicalAction,
    };
  }

  const isEnglish = context.locale === "en";
  return {
    category: "CAT1_ASSOCIATIONS_NIGHT_WAKINGS",
    diagnosis_code: "HEALTHY_SLEEP_MAINTENANCE",
    status: "active",
    title: isEnglish ? "Stable sleep rhythm" : "Stabilny rytm snu dziecka",
    explanation: isEnglish
      ? "The sleep battery and wake windows are within the developmental norm. Keep up your current wind-down routine."
      : "Bateria snu i okna czuwania mieszczą się w normie rozwojowej. Kontynuuj obecną rutynę wyciszania.",
    algorithm_override_json: {},
    confidence_score: DEFAULT_CONFIDENCE_SCORE,
    clinical_action: isEnglish
      ? "Keep a consistent morning wake-up time."
      : "Utrzymuj stałą porę pobudki porannej.",
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
    // Pełny kontekst — pozwala admin odtworzyć wywołanie z innym promptem/modelem (replay)
    context: {
      ...context,
      activeInsights: context.activeInsights.map(({ status, category, title }) => ({
        status,
        category,
        title,
      })),
    },
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
    costUsd?: number;
    latencyMs: number;
    fallbackUsed?: boolean;
    promptVersion?: number;
    category?: string;
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
      user_id: audit.userId || undefined,
      kind: audit.kind,
      model: details.model,
      request_snapshot_json: audit.requestSnapshot ?? {},
      response_json: details.responseJson ?? null,
      status: details.status,
      error_message: details.errorMessage?.slice(0, 2000),
      prompt_tokens: details.promptTokens,
      completion_tokens: details.completionTokens,
      cost_usd: details.costUsd,
      latency_ms: details.latencyMs,
      fallback_used: details.fallbackUsed ?? false,
      prompt_version: details.promptVersion ?? 0,
      category: details.category ?? "",
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
  const apiKey = configOverride?.apiKey ?? (await resolveOpenRouterApiKey()).key;

  const finish = async (
    result: Omit<
      InsightEvaluationOutcome,
      "callId" | "latencyMs" | "fallbackUsed" | "aiSkipped" | "promptVersion"
    >,
    extra: {
      promptTokens?: number;
      completionTokens?: number;
      costUsd?: number;
      fallbackUsed?: boolean;
      promptVersion?: number;
      aiSkipped?: boolean;
    } = {},
  ): Promise<InsightEvaluationOutcome> => {
    const latencyMs = Date.now() - startedAt;
    const fallbackUsed = extra.fallbackUsed ?? false;
    const promptVersion = extra.promptVersion ?? 0;
    const aiSkipped = extra.aiSkipped ?? false;
    const callId =
      audit && !aiSkipped
        ? await logAiCall(audit, {
            model: result.model,
            status: result.status,
            responseJson: result.rawResponse
              ? toLoggableResponse(result.rawResponse)
              : result.insight,
            errorMessage: result.errorMessage,
            latencyMs,
            promptTokens: extra.promptTokens,
            completionTokens: extra.completionTokens,
            costUsd: extra.costUsd,
            fallbackUsed,
            promptVersion,
            category: result.insight.category,
          })
        : null;
    return { ...result, callId, latencyMs, fallbackUsed, aiSkipped, promptVersion };
  };

  if (configOverride?.skipAi) {
    return finish(
      {
        insight: createDeterministicFallbackInsight(context),
        model: "deterministic-fallback",
        status: "ok",
        errorMessage: "AI wyłączone — użyto wniosku deterministycznego.",
      },
      { aiSkipped: true },
    );
  }

  if (!apiKey) {
    return finish({
      insight: createDeterministicFallbackInsight(context),
      model: "deterministic-fallback",
      status: "error",
      errorMessage: "Brak klucza OpenRouter — użyto wniosku deterministycznego.",
    });
  }

  const [adminSettings, activePrompt] = await Promise.all([
    fetchAdminSettings(),
    fetchActivePromptVersion(),
  ]);
  const runtime = resolveAiRuntimeSettings(adminSettings);
  const primaryModel =
    configOverride?.modelName ||
    adminSettings?.openrouter_fast_model ||
    DEFAULT_OPENROUTER_FAST_MODEL;
  // Prompt z nadpisania (Sandbox/replay) nie ma numeru wersji
  const promptVersion = configOverride?.systemPrompt ? 0 : (activePrompt?.version ?? 0);
  const systemPrompt = resolveSystemPrompt(
    configOverride?.systemPrompt ||
      activePrompt?.systemPrompt ||
      adminSettings?.system_prompt_insights,
  );
  const userPrompt = formatEvaluationUserPrompt(context);

  const models = [primaryModel];
  if (runtime.fallbackModel && runtime.fallbackModel !== primaryModel) {
    models.push(runtime.fallbackModel);
  }

  let lastFailure: {
    model: string;
    status: AiCallStatus;
    errorMessage: string;
    raw: OpenRouterRawResult | null;
  } | null = null;

  for (const [index, model] of models.entries()) {
    let raw: OpenRouterRawResult | null = null;
    try {
      raw = await sendOpenRouterRequest(apiKey, model, systemPrompt, userPrompt, {
        temperature: runtime.temperature,
        maxTokens: runtime.maxTokens,
        timeoutMs: runtime.timeoutMs,
      });
      const text = parseAndValidateAiResponse(raw.content);
      assertSafeInsightText(text, context.effectiveAgeDays);
      const insight = mergeAiTextIntoInsight(context, text);
      return await finish(
        { insight, model, status: "ok", rawResponse: raw.content },
        {
          promptTokens: raw.promptTokens,
          completionTokens: raw.completionTokens,
          costUsd: raw.costUsd,
          fallbackUsed: index > 0,
          promptVersion,
        },
      );
    } catch (error) {
      // Odrzucenie przez filtr bezpieczeństwa to nie błąd formatu — logujemy jako „error”
      const isUnsafe = error instanceof UnsafeAdviceError;
      lastFailure = {
        model,
        status: raw !== null && !isUnsafe ? "invalid_json" : "error",
        errorMessage: error instanceof Error ? error.message : "Nieznany błąd OpenRouter.",
        raw,
      };
    }
  }

  const failure = lastFailure as NonNullable<typeof lastFailure>;
  return await finish(
    {
      insight: createDeterministicFallbackInsight(context),
      model: failure.model,
      status: failure.status,
      errorMessage: failure.errorMessage,
      rawResponse: failure.raw?.content,
    },
    {
      promptTokens: failure.raw?.promptTokens,
      completionTokens: failure.raw?.completionTokens,
      costUsd: failure.raw?.costUsd,
      fallbackUsed: models.length > 1,
      promptVersion,
    },
  );
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
