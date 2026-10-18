"use client";

import { type ReactNode, useEffect, useState } from "react";
import { SANDBOX_SAMPLES } from "@/lib/sandboxSamples";
import { adminRequest, jsonBody } from "./adminApi";
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

/**
 * Zakładka "OpenRouter & Prompty": modele, prompt systemowy, limit globalny i Sandbox.
 *
 * @returns {ReactNode} Zawartość zakładki
 */
export function SettingsTab(): ReactNode {
  const { data, error, isSaving, save } = useAdminSettings();
  const [fastModel, setFastModel] = useState("");
  const [reasoningModel, setReasoningModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [limit, setLimit] = useState("");
  const [sample, setSample] = useState<(typeof SANDBOX_SAMPLES)[number]>("balanced");
  const [sandbox, setSandbox] = useState<SandboxResult | null>(null);
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setFastModel(data.settings?.openrouter_fast_model ?? "");
    setReasoningModel(data.settings?.openrouter_reasoning_model ?? "");
    setPrompt(data.settings?.system_prompt_insights ?? "");
    setLimit(String(data.settings?.ai_daily_limit_per_household ?? ""));
  }, [data]);

  if (!data) {
    return <StatusMessage error={error} loading="Ładowanie ustawień…" />;
  }

  const handleSave = async () => {
    setSaved(false);
    const ok = await save({
      openrouter_fast_model: fastModel.trim(),
      openrouter_reasoning_model: reasoningModel.trim(),
      system_prompt_insights: prompt,
      ...(limit.trim() === "" ? {} : { ai_daily_limit_per_household: Number(limit) }),
    });
    setSaved(ok);
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
      <Field label="Model — generator wniosków i czat">
        <input
          className={inputClass}
          list="openrouter-models"
          value={fastModel}
          placeholder={data.defaults.fastModel}
          onChange={(event) => setFastModel(event.target.value)}
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

      <Field label="Prompt systemowy (pusty = domyślny)">
        <textarea
          className={`${inputClass} min-h-40 font-mono text-xs`}
          value={prompt}
          placeholder={data.defaults.systemPrompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </Field>

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
