"use client";

import { type ReactNode, useEffect, useState } from "react";
import { SANDBOX_SAMPLES } from "@/lib/sandboxSamples";
import { adminRequest, jsonBody } from "./adminApi";
import { PromptHistory } from "./PromptHistory";
import { Field, inputClass, PrimaryButton, StatusMessage } from "./ui";
import { useAdminSettings } from "./useAdminSettings";

const MODEL_PRESETS = [
  "google/gemini-2.5-flash",
  "anthropic/claude-sonnet-4.5",
  "openai/gpt-4o-mini",
] as const;

interface SandboxResult {
  readonly context: unknown;
  readonly result: unknown;
}

interface ConnectionTest {
  readonly configured: boolean;
  readonly ok: boolean;
  readonly model?: string;
  readonly latencyMs?: number;
  readonly error: string | null;
  readonly credits: {
    readonly totalCredits: number;
    readonly totalUsage: number;
    readonly remaining: number;
  } | null;
}

/**
 * Parsuje pole liczbowe formularza: puste → undefined (pomijane), niepoprawne → NaN.
 *
 * @param {string} value - Wartość pola
 * @returns {number | undefined} Liczba albo undefined, gdy puste
 */
function parseOptionalNumber(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value);
}

/**
 * Zakładka "OpenRouter & Prompty": wyłącznik AI, modele (główny + zapasowy), parametry wywołań,
 * test połączenia, wersjonowany prompt systemowy, limit globalny i Sandbox.
 *
 * @returns {ReactNode} Zawartość zakładki
 */
export function SettingsTab(): ReactNode {
  const { data, error, isSaving, save } = useAdminSettings();
  const [fastModel, setFastModel] = useState("");
  const [reasoningModel, setReasoningModel] = useState("");
  const [fallbackModel, setFallbackModel] = useState("");
  const [temperature, setTemperature] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const [timeoutMs, setTimeoutMs] = useState("");
  const [prompt, setPrompt] = useState("");
  const [promptNote, setPromptNote] = useState("");
  const [promptRefresh, setPromptRefresh] = useState(0);
  const [promptMessage, setPromptMessage] = useState<string | null>(null);
  const [limit, setLimit] = useState("");
  const [sample, setSample] = useState<(typeof SANDBOX_SAMPLES)[number]>("balanced");
  const [sandbox, setSandbox] = useState<SandboxResult | null>(null);
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [connection, setConnection] = useState<ConnectionTest | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    const settings = data.settings;
    setFastModel(settings?.openrouter_fast_model ?? "");
    setReasoningModel(settings?.openrouter_reasoning_model ?? "");
    setFallbackModel(settings?.openrouter_fallback_model ?? "");
    setTemperature(settings?.ai_temperature ? String(settings.ai_temperature) : "");
    setMaxTokens(settings?.ai_max_tokens ? String(settings.ai_max_tokens) : "");
    setTimeoutMs(settings?.ai_timeout_ms ? String(settings.ai_timeout_ms) : "");
    setPrompt(settings?.system_prompt_insights ?? "");
    setLimit(String(settings?.ai_daily_limit_per_household ?? ""));
  }, [data]);

  if (!data) {
    return <StatusMessage error={error} loading="Ładowanie ustawień…" />;
  }

  const aiDisabled = data.settings?.ai_disabled === true;

  const handleToggleAi = async () => {
    const message = aiDisabled
      ? "Włączyć AI dla wszystkich gospodarstw?"
      : "Wyłączyć AI globalnie? Aplikacja będzie używać wyłącznie silnika deterministycznego.";
    if (!window.confirm(message)) return;
    await save({ ai_disabled: !aiDisabled });
  };

  const handleSave = async () => {
    setSaved(false);
    const temperatureValue = parseOptionalNumber(temperature);
    const maxTokensValue = parseOptionalNumber(maxTokens);
    const timeoutValue = parseOptionalNumber(timeoutMs);
    const limitValue = parseOptionalNumber(limit);
    const ok = await save({
      openrouter_fast_model: fastModel.trim(),
      openrouter_reasoning_model: reasoningModel.trim(),
      openrouter_fallback_model: fallbackModel.trim(),
      ...(temperatureValue === undefined ? {} : { ai_temperature: temperatureValue }),
      ...(maxTokensValue === undefined ? {} : { ai_max_tokens: maxTokensValue }),
      ...(timeoutValue === undefined ? {} : { ai_timeout_ms: timeoutValue }),
      ...(limitValue === undefined ? {} : { ai_daily_limit_per_household: limitValue }),
    });
    setSaved(ok);
  };

  const handleSavePrompt = async () => {
    setPromptMessage(null);
    try {
      await adminRequest("/api/admin/prompts", {
        method: "POST",
        ...jsonBody({ system_prompt: prompt, note: promptNote || undefined }),
      });
      setPromptNote("");
      setPromptRefresh((value) => value + 1);
      setPromptMessage("Zapisano nową wersję i aktywowano.");
    } catch (promptError) {
      setPromptMessage(
        promptError instanceof Error ? promptError.message : "Nie udało się zapisać promptu.",
      );
    }
  };

  const handlePing = async () => {
    setIsPinging(true);
    setConnectionError(null);
    try {
      setConnection(
        await adminRequest<ConnectionTest>("/api/admin/openrouter/test", {
          method: "POST",
          ...jsonBody({ model: fastModel.trim() || undefined }),
        }),
      );
    } catch (pingError) {
      setConnectionError(pingError instanceof Error ? pingError.message : "Błąd testu.");
    } finally {
      setIsPinging(false);
    }
  };

  const handleSandbox = async () => {
    setIsTesting(true);
    setSandboxError(null);
    try {
      setSandbox(
        await adminRequest<SandboxResult>("/api/admin/sandbox", {
          method: "POST",
          ...jsonBody({
            sample,
            prompt: prompt || undefined,
            model: fastModel.trim() || undefined,
          }),
        }),
      );
    } catch (testError) {
      setSandboxError(testError instanceof Error ? testError.message : "Błąd Sandboxa.");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <section
        className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
          aiDisabled ? "border-red-500/40 bg-red-500/5" : "border-emerald-500/30 bg-emerald-500/5"
        }`}
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            AI {aiDisabled ? "wyłączone globalnie" : "włączone"}
          </h3>
          <p className="text-[11px] text-slate-400">
            {aiDisabled
              ? "Wnioski i coach działają wyłącznie na silniku deterministycznym."
              : "Wnioski i coach korzystają z OpenRoutera (z silnikiem jako zapasem)."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!aiDisabled}
          aria-label="Globalny wyłącznik AI"
          disabled={isSaving}
          className={`min-h-11 shrink-0 rounded-xl border px-4 text-xs font-semibold ${
            aiDisabled ? "border-emerald-500/50 text-emerald-300" : "border-red-500/50 text-red-300"
          }`}
          onClick={handleToggleAi}
        >
          {aiDisabled ? "Włącz AI" : "Wyłącz AI"}
        </button>
      </section>

      <Field label="Model — generator wniosków i czat">
        <input
          className={inputClass}
          list="openrouter-models"
          value={fastModel}
          placeholder={data.defaults.fastModel}
          onChange={(event) => setFastModel(event.target.value)}
        />
      </Field>
      <Field label="Model zapasowy (gdy główny zawiedzie lub przekroczy czas)">
        <input
          className={inputClass}
          list="openrouter-models"
          value={fallbackModel}
          placeholder="brak — od razu wniosek deterministyczny"
          onChange={(event) => setFallbackModel(event.target.value)}
        />
      </Field>
      <Field label="Model — rozumowanie (rezerwowy)">
        <input
          className={inputClass}
          list="openrouter-models"
          value={reasoningModel}
          placeholder={data.defaults.reasoningModel}
          onChange={(event) => setReasoningModel(event.target.value)}
        />
      </Field>
      <datalist id="openrouter-models">
        {MODEL_PRESETS.map((model) => (
          <option key={model} value={model} />
        ))}
      </datalist>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Temperatura (0–2)">
          <input
            className={inputClass}
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            placeholder="0.3"
            onChange={(event) => setTemperature(event.target.value)}
          />
        </Field>
        <Field label="Max tokenów">
          <input
            className={inputClass}
            type="number"
            min={0}
            max={8000}
            value={maxTokens}
            placeholder="domyślnie"
            onChange={(event) => setMaxTokens(event.target.value)}
          />
        </Field>
        <Field label="Timeout (ms)">
          <input
            className={inputClass}
            type="number"
            min={0}
            max={120000}
            value={timeoutMs}
            placeholder="30000"
            onChange={(event) => setTimeoutMs(event.target.value)}
          />
        </Field>
      </div>
      <p className="-mt-2 text-[11px] text-slate-500">Pusta lub 0 = wartość domyślna.</p>

      <Field label="Dzienny limit zapytań AI na gospodarstwo">
        <input
          className={inputClass}
          type="number"
          min={0}
          max={1000}
          value={limit}
          placeholder="20"
          onChange={(event) => setLimit(event.target.value)}
        />
      </Field>

      <PrimaryButton onClick={handleSave} disabled={isSaving}>
        {isSaving ? "Zapisywanie…" : "Zapisz ustawienia"}
      </PrimaryButton>
      {saved && <p className="text-xs text-emerald-400">Zapisano.</p>}
      {error && <StatusMessage error={error} />}

      <section className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-[#151B28] p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Połączenie z OpenRouterem
        </h3>
        <PrimaryButton onClick={handlePing} disabled={isPinging}>
          {isPinging ? "Testowanie…" : "Test połączenia"}
        </PrimaryButton>
        {connectionError && <StatusMessage error={connectionError} />}
        {connection && (
          <div className="text-xs text-slate-300" role="status">
            {!connection.configured && <p className="text-amber-300">{connection.error}</p>}
            {connection.configured && (
              <p className={connection.ok ? "text-emerald-400" : "text-red-300"}>
                {connection.ok
                  ? `OK — ${connection.model}, ${connection.latencyMs} ms`
                  : `Błąd — ${connection.error}`}
              </p>
            )}
            {connection.credits ? (
              <p className="mt-1 text-slate-400">
                Kredyty: ${connection.credits.remaining.toFixed(2)} pozostało (wykorzystano $
                {connection.credits.totalUsage.toFixed(2)} z $
                {connection.credits.totalCredits.toFixed(2)})
              </p>
            ) : (
              connection.configured && (
                <p className="mt-1 text-slate-500">
                  Stan kredytów niedostępny (klucz bez uprawnień do /credits).
                </p>
              )
            )}
          </div>
        )}
      </section>

      <Field label="Prompt systemowy (pusty = domyślny)">
        <textarea
          className={`${inputClass} min-h-40 font-mono text-xs`}
          value={prompt}
          placeholder={data.defaults.systemPrompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </Field>
      <input
        className={inputClass}
        aria-label="Notatka do wersji promptu"
        placeholder="Notatka do wersji (opcjonalnie)"
        maxLength={300}
        value={promptNote}
        onChange={(event) => setPromptNote(event.target.value)}
      />
      <PrimaryButton onClick={handleSavePrompt} disabled={prompt.trim().length < 20}>
        Zapisz jako nową wersję promptu
      </PrimaryButton>
      {promptMessage && <p className="text-xs text-slate-300">{promptMessage}</p>}
      <PromptHistory refreshKey={promptRefresh} />

      <section className="rounded-xl border border-violet-500/20 bg-[#151B28] p-3 flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-300">
          Sandbox (nie zapisuje wniosków)
        </h3>
        <select
          className={inputClass}
          value={sample}
          onChange={(event) => setSample(event.target.value as typeof sample)}
        >
          {SANDBOX_SAMPLES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <PrimaryButton onClick={handleSandbox} disabled={isTesting}>
          {isTesting ? "Testowanie…" : "Testuj w Sandboxie"}
        </PrimaryButton>
        {sandboxError && <StatusMessage error={sandboxError} />}
        {sandbox && (
          <pre className="max-h-96 overflow-auto rounded-lg bg-black/30 p-2 text-[11px] text-slate-300">
            {JSON.stringify(sandbox, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
