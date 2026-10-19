"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { diffLines } from "@/lib/admin/diff";
import type { PromptVersionRecord } from "@/lib/types/database";
import { adminRequest } from "./adminApi";
import { StatusMessage } from "./ui";

const DIFF_STYLE = {
  same: "text-slate-500",
  add: "bg-emerald-500/10 text-emerald-300",
  del: "bg-red-500/10 text-red-300 line-through",
} as const;

const DIFF_MARK = { same: "  ", add: "+ ", del: "− " } as const;

/**
 * Podgląd diffu liniowego między wskazaną wersją a aktywną.
 *
 * @param {object} props - Stary i nowy tekst promptu
 * @returns {ReactNode} Blok z różnicami
 */
function DiffView({ before, after }: { before: string; after: string }): ReactNode {
  const ops = diffLines(before, after);
  return (
    <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-2 text-[11px]">
      {ops.map((op, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: diff jest statyczny, kolejność linii jest kluczem
        <span key={index} className={`block ${DIFF_STYLE[op.type]}`}>
          {DIFF_MARK[op.type]}
          {op.text || " "}
        </span>
      ))}
    </pre>
  );
}

/**
 * Historia wersji promptu systemowego z diffem względem aktywnej wersji i przywracaniem.
 *
 * @param {object} props - `refreshKey` wymusza odświeżenie po zapisie nowej wersji
 * @returns {ReactNode} Sekcja historii
 */
export function PromptHistory({ refreshKey }: { refreshKey: number }): ReactNode {
  const [versions, setVersions] = useState<readonly PromptVersionRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await adminRequest<{ items: readonly PromptVersionRecord[] }>(
        "/api/admin/prompts",
      );
      setVersions(result.items);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać historii.");
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey celowo odświeża listę po zapisie
  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleActivate = async (version: PromptVersionRecord) => {
    if (!window.confirm(`Przywrócić wersję v${version.version} jako aktywną?`)) return;
    try {
      await adminRequest(`/api/admin/prompts/${version.id}/activate`, { method: "POST" });
      await load();
    } catch (activateError) {
      setError(
        activateError instanceof Error ? activateError.message : "Nie udało się przywrócić.",
      );
    }
  };

  const active = versions?.find((version) => version.is_active);

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-[#151B28] p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Historia wersji promptu
      </h3>
      <StatusMessage error={error} loading={versions || error ? undefined : "Ładowanie…"} />
      {versions?.length === 0 && (
        <p className="text-xs text-slate-500">
          Brak zapisanych wersji — używany jest prompt domyślny.
        </p>
      )}
      {versions?.map((version) => (
        <div key={version.id} className="rounded-lg border border-slate-800 p-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="min-h-11 flex-1 text-left"
              aria-expanded={openId === version.id}
              onClick={() => setOpenId(openId === version.id ? null : version.id)}
            >
              <span className="text-sm font-semibold text-slate-100">v{version.version}</span>
              {version.is_active && (
                <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
                  aktywna
                </span>
              )}
              <span className="block text-[11px] text-slate-500">
                {new Date(version.created).toLocaleString("pl-PL")}
                {version.note ? ` · ${version.note}` : ""}
              </span>
            </button>
            {!version.is_active && (
              <button
                type="button"
                className="min-h-11 rounded-xl border border-slate-700 px-3 text-xs text-slate-200"
                onClick={() => handleActivate(version)}
              >
                Przywróć
              </button>
            )}
          </div>
          {openId === version.id && (
            <div className="mt-2">
              {active && !version.is_active ? (
                <>
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
                    Różnice względem aktywnej v{active.version}
                  </p>
                  <DiffView before={version.system_prompt} after={active.system_prompt} />
                </>
              ) : (
                <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-2 text-[11px] text-slate-300">
                  {version.system_prompt}
                </pre>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
