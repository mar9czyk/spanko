import { NextResponse } from "next/server";
import {
  DEFAULT_OPENROUTER_FAST_MODEL,
  fetchAdminSettings,
  resolveAiRuntimeSettings,
  resolveOpenRouterApiKey,
  sendOpenRouterRequest,
} from "@/lib/openrouter";
import { OpenRouterTestSchema } from "@/lib/server/adminSchemas";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { requireAdmin } from "@/lib/server/auth";

export const OPENROUTER_CREDITS_ENDPOINT = "https://openrouter.ai/api/v1/credits";
const CREDITS_TIMEOUT_MS = 8000;
const TEST_MAX_TOKENS = 20;

export interface CreditsInfo {
  readonly totalCredits: number;
  readonly totalUsage: number;
  readonly remaining: number;
}

/**
 * Pobiera stan kredytów konta OpenRouter (klucz tylko po stronie serwera).
 *
 * @param {string} apiKey - Klucz API
 * @returns {Promise<CreditsInfo | null>} Kredyty albo null (np. klucz bez uprawnień do /credits)
 */
export async function fetchOpenRouterCredits(apiKey: string): Promise<CreditsInfo | null> {
  try {
    const response = await fetch(OPENROUTER_CREDITS_ENDPOINT, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(CREDITS_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      data?: { total_credits?: number; total_usage?: number };
    };
    const totalCredits = json.data?.total_credits;
    const totalUsage = json.data?.total_usage;
    if (typeof totalCredits !== "number" || typeof totalUsage !== "number") return null;
    return { totalCredits, totalUsage, remaining: totalCredits - totalUsage };
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/openrouter/test — sprawdza połączenie z modelem (krótkie zapytanie) i stan kredytów.
 *
 * @param {Request} request - Żądanie HTTP (opcjonalnie `model`)
 * @returns {Promise<NextResponse>} Wynik testu: ok/latencja/błąd oraz kredyty
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const body = await parseJsonBody(request, OpenRouterTestSchema);
    const apiKey = (await resolveOpenRouterApiKey()).key;
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        configured: false,
        ok: false,
        error: "Brak klucza OpenRouter (dodaj go w panelu albo w OPENROUTER_API_KEY).",
        credits: null,
      });
    }

    const settings = await fetchAdminSettings();
    const runtime = resolveAiRuntimeSettings(settings);
    const model = body.model || settings?.openrouter_fast_model || DEFAULT_OPENROUTER_FAST_MODEL;
    const startedAt = Date.now();

    let ok = false;
    let error: string | null = null;
    try {
      await sendOpenRouterRequest(
        apiKey,
        model,
        'Odpowiadaj wyłącznie obiektem JSON {"ok":true}.',
        "Ping.",
        { timeoutMs: runtime.timeoutMs, maxTokens: TEST_MAX_TOKENS, temperature: 0 },
      );
      ok = true;
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : "Nieznany błąd.";
    }

    return NextResponse.json({
      success: true,
      configured: true,
      ok,
      model,
      latencyMs: Date.now() - startedAt,
      error,
      credits: await fetchOpenRouterCredits(apiKey),
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się przetestować połączenia.");
  }
}
