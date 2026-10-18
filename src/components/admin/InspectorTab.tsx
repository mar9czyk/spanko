"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import type { AiCallRecord, AiCallStatus } from "@/lib/types/database";
import { adminRequest } from "./adminApi";
import { inputClass, StatusMessage } from "./ui";

interface InsightReaction {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly parent_feedback: string | null;
  readonly parent_correction_note: string | null;
}

type InspectedCall = AiCallRecord & { readonly insight: InsightReaction | null };

interface CallsPage {
  readonly items: readonly InspectedCall[];
  readonly page: number;
  readonly totalPages: number;
  readonly totalItems: number;
}

const STATUS_STYLE: Record<AiCallStatus, string> = {
  ok: "text-emerald-400",
  error: "text-red-400",
  invalid_json: "text-amber-400",
};

/**
 * Prezentuje blok JSON w rozwijanym podglądzie.
 *
 * @param {object} props - Tytuł i dane
 * @returns {ReactNode} Sekcja z `<pre>`
 */
function JsonBlock({ title, value }: { title: string; value: unknown }): ReactNode {
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">{title}</p>
      <pre className="max-h-60 overflow-auto rounded-lg bg-black/30 p-2 text-[11px] text-slate-300">
        {JSON.stringify(value ?? null, null, 2)}
      </pre>
    </div>
  );
}

/**
 * Zakładka "Inspektor Wniosków": silnik deterministyczny → JSON modelu → reakcja rodzica.
 *
 * @returns {ReactNode} Zawartość zakładki
 */
export function InspectorTab(): ReactNode {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"" | AiCallStatus>("");
  const [data, setData] = useState<CallsPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams({ page: String(page), perPage: "20" });
      if (status) query.set("status", status);
      setData(await adminRequest<CallsPage>(`/api/admin/ai-calls?${query}`));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać logu.");
    }
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-3">
      <select
        className={inputClass}
        value={status}
        onChange={(event) => {
          setPage(1);
          setStatus(event.target.value as "" | AiCallStatus);
        }}
      >
        <option value="">Wszystkie statusy</option>
        <option value="ok">ok</option>
        <option value="error">error</option>
        <option value="invalid_json">invalid_json</option>
      </select>

      <StatusMessage error={error} loading={data ? undefined : "Ładowanie…"} />
      {data?.items.length === 0 && <p className="text-sm text-slate-400">Brak wywołań AI.</p>}

      {data?.items.map((call) => (
        <details key={call.id} className="rounded-xl border border-slate-800 bg-[#151B28] p-3">
          <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-xs">
            <span className={`font-semibold ${STATUS_STYLE[call.status]}`}>{call.status}</span>
            <span className="text-slate-400">{call.kind}</span>
            <span className="text-slate-500">{call.model}</span>
            <span className="ml-auto text-slate-600">
              {new Date(call.created).toLocaleString()} · {call.latency_ms ?? "—"} ms
            </span>
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <JsonBlock title="1. Silnik deterministyczny" value={call.request_snapshot_json} />
            <JsonBlock title="2. Odpowiedź modelu" value={call.response_json} />
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
                3. Reakcja rodzica
              </p>
              {call.insight ? (
                <p className="text-xs text-slate-300">
                  „{call.insight.title}” — {call.insight.parent_feedback ?? "pending"}
                  {call.insight.parent_correction_note
                    ? ` (${call.insight.parent_correction_note})`
                    : ""}
                </p>
              ) : (
                <p className="text-xs text-slate-500">Brak powiązanego wniosku.</p>
              )}
            </div>
            {call.error_message && <StatusMessage error={call.error_message} />}
            <p className="text-[11px] text-slate-600">
              Tokeny: {call.prompt_tokens ?? "—"} / {call.completion_tokens ?? "—"}
            </p>
          </div>
        </details>
      ))}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <button
            type="button"
            className="min-h-11 px-3 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            ← Nowsze
          </button>
          <span>
            {data.page} / {data.totalPages}
          </span>
          <button
            type="button"
            className="min-h-11 px-3 disabled:opacity-40"
            disabled={page >= data.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Starsze →
          </button>
        </div>
      )}
    </div>
  );
}
