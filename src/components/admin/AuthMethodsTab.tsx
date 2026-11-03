"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { type AuthMethods, validateAuthMethods } from "@/lib/authMethods";
import { pb } from "@/lib/pocketbase";
import { adminRequest, jsonBody } from "./adminApi";
import { Field, inputClass, PrimaryButton, StatusMessage } from "./ui";

interface AuthConfigResponse {
  readonly methods: AuthMethods;
  readonly google: { readonly configured: boolean; readonly clientId: string | null };
}

type Kind = keyof AuthMethods;
type Method = keyof AuthMethods[Kind];

const METHOD_LABELS: Record<Method, string> = { email: "E-mail i hasło", google: "Google" };

/**
 * Przełącznik jednej metody.
 *
 * @param {object} props - Etykieta, stan i callback
 * @returns {ReactNode} Wiersz przełącznika
 */
function MethodSwitch({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
}): ReactNode {
  return (
    <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        className={`min-h-11 shrink-0 rounded-xl border px-3 text-xs ${
          enabled ? "border-emerald-500/40 text-emerald-300" : "border-slate-700 text-slate-400"
        }`}
        onClick={onToggle}
      >
        {enabled ? "Włączone" : "Wyłączone"}
      </button>
    </div>
  );
}

/**
 * Zakładka „Logowanie”: klucze Google oraz włączanie metod logowania i rejestracji.
 *
 * @returns {ReactNode} Zawartość zakładki
 */
export function AuthMethodsTab(): ReactNode {
  const [config, setConfig] = useState<AuthConfigResponse | null>(null);
  const [draft, setDraft] = useState<AuthMethods | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const loaded = await adminRequest<AuthConfigResponse>("/api/admin/auth-config");
      setConfig(loaded);
      setDraft(loaded.methods);
      setClientId(loaded.google.clientId ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać ustawień.");
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
      setClientSecret("");
      setIsBusy(false);
    }
  };

  if (!config || !draft) {
    return <StatusMessage error={error} loading="Ładowanie…" />;
  }

  // Wyłączenie logowania wyłącza też rejestrację tą metodą, a włączenie rejestracji włącza logowanie.
  const toggle = (kind: Kind, method: Method) => {
    const enabled = !draft[kind][method];
    const next = { ...draft, [kind]: { ...draft[kind], [method]: enabled } };
    if (kind === "login" && !enabled) next.signup = { ...next.signup, [method]: false };
    if (kind === "signup" && enabled) next.login = { ...next.login, [method]: true };
    setDraft(next);
  };

  const problem = validateAuthMethods(draft, config.google.configured);

  const handleSaveMethods = () => {
    if (
      config.methods.login.email &&
      !draft.login.email &&
      !window.confirm(
        "Wyłączyć logowanie hasłem? Admin wejdzie do panelu tylko przez Google, na konto z tym samym adresem e-mail. Sprawdź to najpierw, inaczej stracisz dostęp.",
      )
    ) {
      return;
    }
    void run(
      () => adminRequest("/api/admin/auth-config", { method: "PUT", ...jsonBody(draft) }),
      "Zapisano metody logowania i rejestracji.",
    );
  };

  const handleSaveGoogle = () =>
    run(
      () =>
        adminRequest("/api/admin/auth-config/google", {
          method: "PUT",
          ...jsonBody({ clientId, clientSecret }),
        }),
      "Klucze Google zapisane.",
    );

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-[#151B28] p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Logowanie przez Google
        </h3>
        <p className="text-xs text-slate-300">
          Stan: {config.google.configured ? "klucze zapisane" : "brak kluczy"}
        </p>
        <p className="break-all text-xs text-slate-400">
          Adres zwrotny do wpisania w Google Cloud:{" "}
          <span className="font-mono">{`${pb.baseURL}/api/oauth2-redirect`}</span>
        </p>
        <Field label="Client ID">
          <input
            autoComplete="off"
            className={inputClass}
            value={clientId}
            placeholder="….apps.googleusercontent.com"
            disabled={isBusy}
            onChange={(event) => setClientId(event.target.value)}
          />
        </Field>
        <Field label={config.google.configured ? "Nowy Client Secret" : "Client Secret"}>
          <input
            type="password"
            autoComplete="off"
            className={inputClass}
            value={clientSecret}
            disabled={isBusy}
            onChange={(event) => setClientSecret(event.target.value)}
          />
        </Field>
        <PrimaryButton
          onClick={handleSaveGoogle}
          disabled={isBusy || !clientId.trim() || !clientSecret.trim()}
        >
          {isBusy ? "Sprawdzanie…" : "Zapisz i sprawdź"}
        </PrimaryButton>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-[#151B28] p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Metody logowania
        </h3>
        {(["email", "google"] as const).map((method) => (
          <MethodSwitch
            key={method}
            label={METHOD_LABELS[method]}
            enabled={draft.login[method]}
            onToggle={() => toggle("login", method)}
          />
        ))}
        <h3 className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Metody rejestracji
        </h3>
        {(["email", "google"] as const).map((method) => (
          <MethodSwitch
            key={method}
            label={METHOD_LABELS[method]}
            enabled={draft.signup[method]}
            onToggle={() => toggle("signup", method)}
          />
        ))}
        {problem && <p className="text-xs text-amber-300">{problem}</p>}
        <PrimaryButton onClick={handleSaveMethods} disabled={isBusy || problem !== null}>
          Zapisz metody
        </PrimaryButton>
      </section>

      {message && <p className="text-xs text-emerald-400">{message}</p>}
      {error && <StatusMessage error={error} />}
    </div>
  );
}
