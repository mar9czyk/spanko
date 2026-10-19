import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  settings: null as Record<string, unknown> | null,
  activePrompt: null as { version: number; systemPrompt: string } | null,
  createdCalls: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/server/promptVersions", () => ({
  fetchActivePromptVersion: async () => mocks.activePrompt,
}));

vi.mock("@/lib/server/auth", () => ({
  getServiceClient: async () => ({
    collection: (name: string) => ({
      getList: async () => ({
        items: name === "admin_settings" && mocks.settings ? [mocks.settings] : [],
      }),
      create: async (data: Record<string, unknown>) => {
        mocks.createdCalls.push(data);
        return { id: `call_${mocks.createdCalls.length}` };
      },
      update: async () => ({}),
    }),
  }),
}));

import {
  type InsightEvaluationContext,
  invalidateAdminSettingsCache,
  resolveAiRuntimeSettings,
  runInsightEvaluation,
} from "../openrouter";

const context: InsightEvaluationContext = {
  childAgeDisplay: "5 msc",
  effectiveAgeDays: 150,
  activeDayMode: "home",
  chronicSleepDebtMin: 10,
  sleepBatteryPercent: 90,
  sleepNeedsProfile: "average",
  triggeredDiagnostics: [
    {
      category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
      diagnosisCode: "OVERTIRED_FUSS",
      severity: "medium",
      title: "Przemęczenie wieczorne",
      explanation: "Wieczorny opór przed snem wynika z długu sennego.",
      clinicalAction: "Skróć ostatnie okno czuwania.",
    },
  ],
  activeInsights: [],
};

const GOOD_INSIGHT = {
  category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
  diagnosis_code: "OVERTIRED_FUSS",
  status: "active",
  title: "Skracamy wieczorne okno",
  explanation: "Maluch jest wieczorem przemęczony, więc skróć ostatnie okno czuwania.",
  algorithm_override_json: {},
  confidence_score: 0.9,
};

function okResponse(content: unknown = GOOD_INSIGHT): Response {
  return new Response(
    JSON.stringify({
      choices: [
        { message: { content: typeof content === "string" ? content : JSON.stringify(content) } },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    }),
  );
}

/**
 * Zwraca ciało JSON pierwszego żądania fetch (model, wiadomości, parametry).
 *
 * @param {ReturnType<typeof vi.fn>} fetchMock - Mock fetch
 * @returns {Record<string, any>} Zdekodowane ciało
 */
// biome-ignore lint/suspicious/noExplicitAny: ciało żądania w teście jest dowolnym JSON-em
function sentBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, any> {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? "{}"));
}

describe("resolveAiRuntimeSettings", () => {
  it("używa wartości domyślnych dla braku i zera", () => {
    expect(resolveAiRuntimeSettings(null)).toEqual({
      temperature: 0.3,
      maxTokens: undefined,
      timeoutMs: 30_000,
      fallbackModel: undefined,
    });
    const zeros = resolveAiRuntimeSettings({
      id: "s",
      ai_temperature: 0,
      ai_max_tokens: 0,
      ai_timeout_ms: 0,
      openrouter_fallback_model: "  ",
      created: "",
      updated: "",
    });
    expect(zeros.temperature).toBe(0.3);
    expect(zeros.fallbackModel).toBeUndefined();
  });

  it("przyjmuje niezerowe ustawienia admina", () => {
    const custom = resolveAiRuntimeSettings({
      id: "s",
      ai_temperature: 0.7,
      ai_max_tokens: 500,
      ai_timeout_ms: 5000,
      openrouter_fallback_model: " openai/gpt-4o-mini ",
      created: "",
      updated: "",
    });
    expect(custom).toEqual({
      temperature: 0.7,
      maxTokens: 500,
      timeoutMs: 5000,
      fallbackModel: "openai/gpt-4o-mini",
    });
  });
});

describe("runInsightEvaluation — fallback, timeout, wyłącznik, wersja promptu", () => {
  beforeEach(() => {
    mocks.settings = {
      id: "s1",
      openrouter_fast_model: "primary/model",
      openrouter_fallback_model: "backup/model",
      created: "",
      updated: "",
    };
    mocks.activePrompt = null;
    mocks.createdCalls.length = 0;
    invalidateAdminSettingsCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("przechodzi na model zapasowy, gdy główny zwraca błąd HTTP", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("upstream down", { status: 500 }))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await runInsightEvaluation(context, {
      apiKey: "k",
      audit: { kind: "evaluate", householdId: "h1" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(outcome).toMatchObject({ status: "ok", model: "backup/model", fallbackUsed: true });
    expect(mocks.createdCalls[0]).toMatchObject({
      model: "backup/model",
      fallback_used: true,
      category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
      status: "ok",
    });
  });

  it("przechodzi na model zapasowy, gdy główny zwraca niepoprawny JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse("to nie jest json"))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await runInsightEvaluation(context, { apiKey: "k" });
    expect(outcome).toMatchObject({ status: "ok", model: "backup/model", fallbackUsed: true });
  });

  it("gdy oba modele zawiodą, zwraca wniosek deterministyczny ze statusem błędu", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await runInsightEvaluation(context, {
      apiKey: "k",
      audit: { kind: "evaluate" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(outcome.status).toBe("error");
    expect(outcome.fallbackUsed).toBe(true);
    expect(outcome.insight.diagnosis_code).toBe("OVERTIRED_FUSS");
    expect(mocks.createdCalls).toHaveLength(1);
  });

  it("nie robi drugiej próby bez modelu zapasowego", async () => {
    mocks.settings = { ...mocks.settings, openrouter_fallback_model: "" };
    invalidateAdminSettingsCache();
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await runInsightEvaluation(context, { apiKey: "k" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(outcome.fallbackUsed).toBe(false);
  });

  it("przerywa żądanie po przekroczeniu timeoutu i próbuje model zapasowy", async () => {
    mocks.settings = { ...mocks.settings, ai_timeout_ms: 30 };
    invalidateAdminSettingsCache();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      )
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await runInsightEvaluation(context, { apiKey: "k" });
    expect(outcome).toMatchObject({ status: "ok", model: "backup/model", fallbackUsed: true });
  });

  it("zgłasza timeout w komunikacie błędu, gdy zapasowy też nie odpowie", async () => {
    mocks.settings = { ...mocks.settings, ai_timeout_ms: 30, openrouter_fallback_model: "" };
    invalidateAdminSettingsCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );

    const outcome = await runInsightEvaluation(context, { apiKey: "k" });
    expect(outcome.status).toBe("error");
    expect(outcome.errorMessage).toContain("limit czasu");
  });

  it("skipAi nie woła fetch ani nie loguje wywołania", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await runInsightEvaluation(context, {
      apiKey: "k",
      skipAi: true,
      audit: { kind: "evaluate" },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.createdCalls).toHaveLength(0);
    expect(outcome).toMatchObject({
      aiSkipped: true,
      status: "ok",
      model: "deterministic-fallback",
      callId: null,
    });
  });

  it("używa aktywnej wersji promptu i zapisuje jej numer w logu", async () => {
    mocks.activePrompt = { version: 3, systemPrompt: "Prompt z wersji trzeciej — długi tekst." };
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    await runInsightEvaluation(context, { apiKey: "k", audit: { kind: "evaluate" } });

    const sent = sentBody(fetchMock);
    expect(sent.messages[0].content).toBe("Prompt z wersji trzeciej — długi tekst.");
    expect(mocks.createdCalls[0]).toMatchObject({ prompt_version: 3, fallback_used: false });
  });

  it("prompt z nadpisania (Sandbox/replay) ma wersję 0", async () => {
    mocks.activePrompt = { version: 3, systemPrompt: "Aktywny prompt wersji trzeciej." };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse()));

    await runInsightEvaluation(context, {
      apiKey: "k",
      systemPrompt: "Prompt testowy z Sandboxa.",
      audit: { kind: "sandbox" },
    });
    expect(mocks.createdCalls[0]).toMatchObject({ prompt_version: 0 });
  });

  it("przekazuje temperaturę, max_tokens i model do OpenRoutera", async () => {
    mocks.settings = { ...mocks.settings, ai_temperature: 0.9, ai_max_tokens: 400 };
    invalidateAdminSettingsCache();
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    await runInsightEvaluation(context, { apiKey: "k" });
    expect(sentBody(fetchMock)).toMatchObject({
      model: "primary/model",
      temperature: 0.9,
      max_tokens: 400,
    });
  });
});
