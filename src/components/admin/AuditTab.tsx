"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import type { AdminAuditLogRecord } from "@/lib/types/database";
import { adminRequest } from "./adminApi";
import { inputClass, StatusMessage } from "./ui";

interface AuditPage {
  readonly items: readonly AdminAuditLogRecord[];
  readonly page: number;
  readonly totalPages: number;
  readonly totalItems: number;
}

/**
 * Wpis dziennika z rozwijanym diffem before/after.
 *
 * @param {object} props - Wpis dziennika
 * @returns {ReactNode} Karta wpisu
 */
function AuditEntry({ entry }: { entry: AdminAuditLogRecord }): ReactNode {
  return (
    <details className="rounded-xl border border-slate-800 bg-[#151B28] p-3">
      <summary className="cursor-pointer list-none">
        <p className="text-sm font-semibold text-slate-100">{entry.action}</p>
        <p className="text-[11px] text-slate-500">
          {new Date(entry.created).toLocaleString("pl-PL")} · {entry.actor_email || "—"}
          {entry.target_collection ? ` · ${entry.target_collection}/${entry.target_id ?? ""}` : ""}
        </p>
      </summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {(
          [
            ["Przed", entry.before_json],
            ["Po", entry.after_json],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
            <pre className="max-h-48 overflow-auto rounded-lg bg-[#0B0F17] p-2 text-[11px] text-slate-300">
              {JSON.stringify(value ?? null, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </details>
  );
}

/**
 * Zakładka "Dziennik": historia działań adminów z filtrami po akcji i aktorze.
 *
 * @returns {ReactNode} Zawartość zakładki
 */
export function AuditTab(): ReactNode {
  const [data, setData] = useState<AuditPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (action.trim()) params.set("action", action.trim());
      if (actor.trim()) params.set("actor", actor.trim());
      setData(await adminRequest<AuditPage>(`/api/admin/audit-log?${params.toString()}`));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać dziennika.");
    }
  }, [page, action, actor]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          className={inputClass}
          aria-label="Filtr akcji"
          placeholder="Akcja (np. user.)"
          value={action}
          onChange={(event) => {
            setPage(1);
            setAction(event.target.value);
          }}
        />
        <input
          className={inputClass}
          aria-label="Filtr aktora"
          placeholder="E-mail admina"
          value={actor}
          onChange={(event) => {
            setPage(1);
            setActor(event.target.value);
          }}
        />
      </div>
      <StatusMessage error={error} loading={data || error ? undefined : "Ładowanie…"} />
      {data?.items.length === 0 && <p className="text-sm text-slate-400">Brak wpisów.</p>}
      {data?.items.map((entry) => (
        <AuditEntry key={entry.id} entry={entry} />
      ))}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <button
            type="button"
            disabled={page <= 1}
            className="min-h-11 rounded-xl border border-slate-800 px-4 disabled:opacity-40"
            onClick={() => setPage((value) => value - 1)}
          >
            ← Nowsze
          </button>
          <span>
            {data.page} / {data.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= data.totalPages}
            className="min-h-11 rounded-xl border border-slate-800 px-4 disabled:opacity-40"
            onClick={() => setPage((value) => value + 1)}
          >
            Starsze →
          </button>
        </div>
      )}
    </div>
  );
}
