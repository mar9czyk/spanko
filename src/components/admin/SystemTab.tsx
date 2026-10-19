"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { adminRequest, jsonBody } from "./adminApi";
import { inputClass, PrimaryButton, StatusMessage } from "./ui";

interface SystemInfo {
  readonly app: { readonly name: string; readonly version: string; readonly node: string };
  readonly pocketbase: { readonly url: string; readonly ok: boolean; readonly message: string };
  readonly config: { readonly serviceAccount: boolean; readonly openRouterKey: boolean };
  readonly backups:
    | readonly { readonly key: string; readonly size: number; readonly modified: string }[]
    | null;
  readonly lastBackupAt: string | null;
}

interface FlagItem {
  readonly id: string;
  readonly key: string;
  readonly enabled: boolean;
  readonly rollout_household_ids?: unknown;
  readonly description?: string;
}

const BYTES_PER_MB = 1024 * 1024;

/**
 * Wskaźnik stanu (zielony / czerwony) z opisem.
 *
 * @param {object} props - Etykieta, stan i opis
 * @returns {ReactNode} Wiersz stanu
 */
function StatusRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail?: string;
}): ReactNode {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-300">{label}</span>
      <span className={ok ? "text-emerald-400" : "text-red-300"}>
        {ok ? "OK" : "Problem"}
        {detail ? ` · ${detail}` : ""}
      </span>
    </div>
  );
}

/**
 * Sekcja przełączników funkcji (feature flags): lista, włączanie, rollout na wybrane gospodarstwa.
 *
 * @returns {ReactNode} Sekcja flag
 */
function FeatureFlagsSection(): ReactNode {
  const [flags, setFlags] = useState<readonly FlagItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    try {
      setFlags(
        (await adminRequest<{ items: readonly FlagItem[] }>("/api/admin/feature-flags")).items,
      );
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać flag.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Operacja nie powiodła się.");
    }
  };

  const rolloutOf = (flag: FlagItem): string[] =>
    Array.isArray(flag.rollout_household_ids)
      ? flag.rollout_household_ids.filter((id): id is string => typeof id === "string")
      : [];

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#151B28] p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Przełączniki funkcji
      </h3>
      <p className="text-[11px] text-slate-500">
        Pusta lista gospodarstw = funkcja dla wszystkich. Kod sprawdza flagi po stronie serwera
        (isFeatureEnabledFor).
      </p>
      <StatusMessage error={error} loading={flags || error ? undefined : "Ładowanie…"} />
      {flags?.length === 0 && <p className="text-xs text-slate-500">Brak flag.</p>}
      {flags?.map((flag) => (
        <FlagRow
          key={`${flag.id}:${flag.enabled}:${rolloutOf(flag).join(",")}`}
          flag={flag}
          onChange={(patch) =>
            run(() =>
              adminRequest(`/api/admin/feature-flags/${flag.id}`, {
                method: "PATCH",
                ...jsonBody(patch),
              }),
            )
          }
          onDelete={() => {
            if (!window.confirm(`Usunąć flagę ${flag.key}? Funkcja wróci do stanu "wyłączona".`))
              return;
            run(() => adminRequest(`/api/admin/feature-flags/${flag.id}`, { method: "DELETE" }));
          }}
        />
      ))}

      <div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
        <input
          className={inputClass}
          aria-label="Klucz nowej flagi"
          placeholder="np. goal_coach_v2"
          maxLength={80}
          value={key}
          onChange={(event) => setKey(event.target.value)}
        />
        <input
          className={inputClass}
          aria-label="Opis nowej flagi"
          placeholder="Opis (opcjonalnie)"
          maxLength={300}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <PrimaryButton
          disabled={key.trim() === ""}
          onClick={() =>
            run(async () => {
              await adminRequest("/api/admin/feature-flags", {
                method: "POST",
                ...jsonBody({
                  key: key.trim(),
                  enabled: false,
                  description: description || undefined,
                }),
              });
              setKey("");
              setDescription("");
            })
          }
        >
          Dodaj flagę (wyłączoną)
        </PrimaryButton>
      </div>
    </section>
  );
}

/**
 * Wiersz flagi: przełącznik, edycja listy gospodarstw rolloutu, usuwanie.
 *
 * @param {object} props - Flaga i callbacki
 * @returns {ReactNode} Wiersz flagi
 */
function FlagRow({
  flag,
  onChange,
  onDelete,
}: {
  flag: FlagItem;
  onChange: (patch: { enabled?: boolean; rollout_household_ids?: string[] }) => void;
  onDelete: () => void;
}): ReactNode {
  const current = Array.isArray(flag.rollout_household_ids)
    ? flag.rollout_household_ids.filter((id): id is string => typeof id === "string")
    : [];
  const [rollout, setRollout] = useState(current.join(", "));

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-slate-100">{flag.key}</p>
          {flag.description && (
            <p className="truncate text-[11px] text-slate-500">{flag.description}</p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={flag.enabled}
          aria-label={`Flaga ${flag.key}`}
          className={`min-h-11 shrink-0 rounded-xl border px-3 text-xs ${
            flag.enabled
              ? "border-emerald-500/40 text-emerald-300"
              : "border-slate-700 text-slate-400"
          }`}
          onClick={() => onChange({ enabled: !flag.enabled })}
        >
          {flag.enabled ? "Włączona" : "Wyłączona"}
        </button>
      </div>
      <div className="flex gap-2">
        <input
          className={inputClass}
          aria-label={`Rollout ${flag.key}`}
          placeholder="ID gospodarstw po przecinku (puste = wszystkie)"
          value={rollout}
          onChange={(event) => setRollout(event.target.value)}
        />
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-xl border border-slate-700 px-3 text-xs text-slate-200"
          onClick={() =>
            onChange({
              rollout_household_ids: rollout
                .split(",")
                .map((id) => id.trim())
                .filter((id) => id !== ""),
            })
          }
        >
          Zapisz
        </button>
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-xl border border-red-500/40 px-3 text-xs text-red-300"
          onClick={onDelete}
        >
          Usuń
        </button>
      </div>
    </div>
  );
}

/**
 * Zakładka "System": wersje, stan PocketBase i konfiguracji, kopie zapasowe oraz przełączniki funkcji.
 *
 * @returns {ReactNode} Zawartość zakładki
 */
export function SystemTab(): ReactNode {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setInfo(await adminRequest<SystemInfo>("/api/admin/system"));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać stanu.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleBackup = async () => {
    setIsBackingUp(true);
    setBackupMessage(null);
    try {
      const result = await adminRequest<{ name: string }>("/api/admin/system/backup", {
        method: "POST",
      });
      setBackupMessage(`Utworzono kopię: ${result.name}`);
      await load();
    } catch (backupError) {
      setBackupMessage(
        backupError instanceof Error ? backupError.message : "Nie udało się utworzyć kopii.",
      );
    } finally {
      setIsBackingUp(false);
    }
  };

  if (!info) {
    return <StatusMessage error={error} loading="Ładowanie…" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-[#151B28] p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Stan systemu
        </h3>
        <p className="text-xs text-slate-400">
          {info.app.name} v{info.app.version} · Node {info.app.node}
        </p>
        <StatusRow label="PocketBase" ok={info.pocketbase.ok} detail={info.pocketbase.message} />
        <StatusRow label="Konto serwisowe" ok={info.config.serviceAccount} />
        <StatusRow label="Klucz OpenRouter" ok={info.config.openRouterKey} />
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-[#151B28] p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Kopie zapasowe
        </h3>
        <p className="text-xs text-slate-400">
          Ostatnia kopia:{" "}
          {info.lastBackupAt ? new Date(info.lastBackupAt).toLocaleString("pl-PL") : "brak"}
        </p>
        <PrimaryButton onClick={handleBackup} disabled={isBackingUp || !info.config.serviceAccount}>
          {isBackingUp ? "Tworzenie kopii…" : "Utwórz kopię teraz"}
        </PrimaryButton>
        {backupMessage && <p className="text-xs text-slate-300">{backupMessage}</p>}
        {info.backups?.slice(0, 5).map((backup) => (
          <p key={backup.key} className="text-[11px] text-slate-500">
            {backup.key} · {(backup.size / BYTES_PER_MB).toFixed(1)} MB ·{" "}
            {new Date(backup.modified).toLocaleString("pl-PL")}
          </p>
        ))}
      </section>

      <FeatureFlagsSection />
    </div>
  );
}
