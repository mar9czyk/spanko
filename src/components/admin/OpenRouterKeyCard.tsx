"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { adminRequest, jsonBody } from "./adminApi";
import { Field, inputClass, PrimaryButton, StatusMessage } from "./ui";

interface KeyInfo {
  readonly source: "panel" | "env" | "none";
  readonly suffix: string | null;
  readonly updatedAt: string | null;
  readonly updatedByEmail: string | null;
  readonly masterKeyConfigured: boolean;
  readonly problem: string | null;
}

const SOURCE_LABELS = {
  panel: "Panel (zaszyfrowany)",
  env: "Zmienna środowiskowa OPENROUTER_API_KEY",
  none: "Brak klucza",
} as const;

/**
 * Karta „Klucz API” w ustawieniach OpenRouter: źródło klucza, zamaskowana końcówka,
 * zapis z weryfikacją i usuwanie. Pole klucza jest czyszczone po każdym zapisie.
 *
 * @returns {ReactNode} Karta
 */
export function OpenRouterKeyCard(): ReactNode {
  const [info, setInfo] = useState<KeyInfo | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setInfo(await adminRequest<KeyInfo>("/api/admin/openrouter/key"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać klucza.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setIsBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Operacja nie powiodła się.");
    } finally {
      setApiKey("");
      setIsBusy(false);
    }
  };

  const handleSave = () =>
    run(
      () =>
        adminRequest("/api/admin/openrouter/key", {
          method: "PUT",
          ...jsonBody({ apiKey }),
        }),
      "Klucz sprawdzony i zapisany (zaszyfrowany).",
    );

  const handleDelete = () => {
    if (
      !window.confirm("Usunąć klucz z panelu? Aplikacja wróci do OPENROUTER_API_KEY z serwera.")
    ) {
      return;
    }
    void run(
      () => adminRequest("/api/admin/openrouter/key", { method: "DELETE" }),
      "Klucz usunięty z panelu.",
    );
  };

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-[#151B28] p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Klucz API</h3>
      {info && (
        <div className="flex flex-col gap-1 text-xs text-slate-300">
          <p>
            Źródło: <span className="font-medium text-ink">{SOURCE_LABELS[info.source]}</span>
          </p>
          {info.suffix && (
            <p>
              Klucz w panelu: <span className="font-mono">sk-or-…{info.suffix}</span>
            </p>
          )}
          {info.updatedAt && (
            <p className="text-slate-400">
              Zmieniono {new Date(info.updatedAt).toLocaleString("pl-PL")}
              {info.updatedByEmail ? ` · ${info.updatedByEmail}` : ""}
            </p>
          )}
          {info.problem && <p className="text-amber-300">{info.problem}</p>}
          {!info.masterKeyConfigured && (
            <p className="text-amber-300">
              Zapis jest wyłączony: dodaj SPANKO_SECRETS_KEY (32 losowe bajty w base64) do
              .env.local i zrestartuj serwer.
            </p>
          )}
        </div>
      )}
      <Field label="Nowy klucz OpenRouter">
        <input
          type="password"
          autoComplete="off"
          className={inputClass}
          value={apiKey}
          placeholder="sk-or-…"
          disabled={isBusy || info?.masterKeyConfigured === false}
          onChange={(event) => setApiKey(event.target.value)}
        />
      </Field>
      <PrimaryButton
        onClick={handleSave}
        disabled={isBusy || !apiKey.trim() || info?.masterKeyConfigured === false}
      >
        {isBusy ? "Sprawdzanie…" : "Zapisz i sprawdź"}
      </PrimaryButton>
      {info?.suffix && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isBusy}
          className="min-h-11 rounded-xl border border-red-500/40 px-4 text-sm text-red-300 disabled:opacity-50"
        >
          Usuń klucz z panelu
        </button>
      )}
      {message && <p className="text-xs text-emerald-400">{message}</p>}
      {error && <StatusMessage error={error} />}
    </section>
  );
}
