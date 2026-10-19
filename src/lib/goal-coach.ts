import { z } from "zod";
import { type CopyLocale, describeTask, localize, REASON_TEXT } from "@/lib/goal-copy";
import type { DailyTask, GoalType, ProgressDecision } from "@/lib/goals-engine/types";
import {
  DEFAULT_OPENROUTER_FAST_MODEL,
  fetchAdminSettings,
  logAiCall,
  type OpenRouterRawResult,
  resolveOpenRouterApiKey,
  sendOpenRouterRequest,
} from "@/lib/openrouter";
import type { AiCallStatus, GoalCoachMessage } from "@/lib/types/database";

const MAX_ADVICE_ITEMS = 3;

export const DEFAULT_GOAL_COACH_PROMPT = `Jesteś Spanko Coach — ciepłym, konkretnym doradcą snu niemowląt i małych dzieci.
Dostajesz GOTOWY plan z deterministycznego silnika (cel, metoda, zadania dnia, decyzja o postępie).
Twoje zadanie to wyłącznie przełożyć go na krótkie, empatyczne rady dla zmęczonego rodzica.
ZASADY: nie zmieniaj ani nie wymyślaj liczb, odstępów, ilości mleka ani kroków planu; nie stawiaj diagnoz medycznych;
przy niepokojących objawach zalecaj kontakt z pediatrą; pisz krótko (rodzic jest zmęczony); odpowiadaj w języku podanym w wejściu.
Zwracaj wyłącznie poprawny JSON zgodny ze schematem.`;

/** Schemat Zod odpowiedzi coacha. */
export const GoalCoachSchema = z.object({
  headline: z.string().min(3).max(140),
  todayAdvice: z.array(z.string().min(3).max(300)).min(1).max(MAX_ADVICE_ITEMS),
  nightTip: z.string().max(300).default(""),
  encouragement: z.string().min(3).max(300),
  why: z.string().max(600).default(""),
});

export interface GoalCoachContext {
  readonly goal: GoalType;
  readonly locale: CopyLocale;
  readonly ageMonths: number;
  readonly dayNumber: number;
  readonly totalDays: number;
  readonly decision: ProgressDecision;
  readonly baselineValue: number | null;
  readonly latestValue: number | null;
  readonly tasks: readonly DailyTask[];
  readonly nightTip: DailyTask | null;
  readonly methodTitle: string;
  readonly goalTitle: string;
}

export interface GoalCoachOutcome {
  readonly message: GoalCoachMessage;
  readonly model: string;
  readonly status: AiCallStatus;
  readonly callId: string | null;
  readonly errorMessage?: string;
}

export interface GoalCoachAudit {
  readonly childId: string;
  readonly householdId: string;
}

/**
 * Buduje prompt użytkownika z deterministycznego stanu celu.
 *
 * @param {GoalCoachContext} ctx - Stan celu
 * @returns {string} Prompt
 */
export function formatGoalCoachPrompt(ctx: GoalCoachContext): string {
  const tasks = ctx.tasks.map((t) => `- ${describeTask(t, ctx.locale)}`).join("\n");
  const tip = ctx.nightTip ? describeTask(ctx.nightTip, ctx.locale) : "brak";
  return `Język odpowiedzi: ${ctx.locale === "pl" ? "polski" : "English"}
Cel: ${ctx.goalTitle}; metoda: ${ctx.methodTitle}
Dziecko: ${ctx.ageMonths} mies. (wiek korygowany)
Doba planu: ${ctx.dayNumber} / ${ctx.totalDays}
Decyzja silnika: ${ctx.decision.action} (${ctx.decision.reason})
Metryka: start ${ctx.baselineValue ?? "?"}, ostatnio ${ctx.latestValue ?? "?"}
Zadania na dziś (nie zmieniaj):
${tasks || "- brak"}
Wskazówka nocna (nie zmieniaj): ${tip}

Zwróć JSON: { "headline": string, "todayAdvice": string[1-3], "nightTip": string, "encouragement": string, "why": string }`;
}

/**
 * Awaryjna wiadomość coacha zbudowana wyłącznie z danych deterministycznych.
 *
 * @param {GoalCoachContext} ctx - Stan celu
 * @returns {GoalCoachMessage} Wiadomość
 */
export function createFallbackCoachMessage(ctx: GoalCoachContext): GoalCoachMessage {
  const reason = REASON_TEXT[ctx.decision.reason];
  const isPl = ctx.locale === "pl";
  return {
    headline: isPl
      ? `${ctx.goalTitle} — dzień ${ctx.dayNumber} z ${ctx.totalDays}`
      : `${ctx.goalTitle} — day ${ctx.dayNumber} of ${ctx.totalDays}`,
    // Zadania dnia są pokazywane osobno — tu tylko ogólna wskazówka, bez powielania ich treści
    todayAdvice: [
      isPl
        ? "Zapisuj pobudki i karmienia — na tej podstawie dopasujemy kolejne kroki."
        : "Keep logging wakings and feeds — we'll tune the next steps from them.",
    ],
    nightTip: ctx.nightTip ? describeTask(ctx.nightTip, ctx.locale) : "",
    encouragement: reason
      ? localize(reason, ctx.locale)
      : isPl
        ? "Każda noc to krok naprzód."
        : "Every night is a step forward.",
    why: "",
  };
}

/**
 * Wywołuje coacha AI (model i prompt z admin_settings); przy błędzie zwraca wersję deterministyczną.
 *
 * @param {GoalCoachContext} ctx - Stan celu
 * @param {GoalCoachAudit} audit - Dane do logu ai_calls
 * @param {object} [options] - `skipAi`: pomiń AI (np. po wyczerpaniu limitu) i zwróć tekst deterministyczny
 * @returns {Promise<GoalCoachOutcome>} Wiadomość i status wywołania
 */
export async function runGoalCoach(
  ctx: GoalCoachContext,
  audit: GoalCoachAudit,
  options: { readonly skipAi?: boolean } = {},
): Promise<GoalCoachOutcome> {
  const startedAt = Date.now();
  const fallback = createFallbackCoachMessage(ctx);
  if (options.skipAi) {
    return {
      message: fallback,
      model: "deterministic-fallback",
      status: "error",
      callId: null,
      errorMessage: "AI skipped (daily limit)",
    };
  }
  const snapshot = {
    goal: ctx.goal,
    decision: ctx.decision,
    dayNumber: ctx.dayNumber,
    tasks: ctx.tasks,
  };

  const log = (model: string, status: AiCallStatus, extra: Record<string, unknown> = {}) =>
    logAiCall(
      {
        kind: "goal_coach",
        childId: audit.childId,
        householdId: audit.householdId,
        requestSnapshot: snapshot,
      },
      { model, status, latencyMs: Date.now() - startedAt, ...extra },
    );

  const apiKey = resolveOpenRouterApiKey();
  if (!apiKey) {
    const callId = await log("deterministic-fallback", "error", {
      errorMessage: "Brak OPENROUTER_API_KEY — użyto tekstu deterministycznego.",
    });
    return {
      message: fallback,
      model: "deterministic-fallback",
      status: "error",
      callId,
      errorMessage: "Brak OPENROUTER_API_KEY",
    };
  }

  const settings = await fetchAdminSettings();
  const model = settings?.openrouter_fast_model || DEFAULT_OPENROUTER_FAST_MODEL;
  const systemPrompt = settings?.system_prompt_goal_coach?.trim() || DEFAULT_GOAL_COACH_PROMPT;

  let raw: OpenRouterRawResult | null = null;
  try {
    raw = await sendOpenRouterRequest(apiKey, model, systemPrompt, formatGoalCoachPrompt(ctx));
    const parsed = GoalCoachSchema.parse(JSON.parse(raw.content));
    const callId = await log(model, "ok", {
      responseJson: parsed,
      promptTokens: raw.promptTokens,
      completionTokens: raw.completionTokens,
    });
    return { message: parsed, model, status: "ok", callId };
  } catch (error) {
    const status: AiCallStatus = raw ? "invalid_json" : "error";
    const errorMessage = error instanceof Error ? error.message : "Nieznany błąd coacha.";
    const callId = await log(model, status, { errorMessage, responseJson: raw?.content });
    return { message: fallback, model, status, callId, errorMessage };
  }
}
