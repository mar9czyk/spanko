"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { adminRequest, jsonBody } from "./adminApi";
import { inputClass, StatusMessage } from "./ui";

interface HouseholdRow {
  readonly id: string;
  readonly name: string;
  readonly childrenCount: number;
  readonly aiCalls24h: number;
  readonly aiCalls7d: number;
  readonly limitOverride: number | null;
}

/**
 * Wiersz gospodarstwa z edycją nadpisania dziennego limitu AI.
 *
 * @param {object} props - Dane gospodarstwa i callback zapisu
 * @returns {ReactNode} Karta gospodarstwa
 */
function HouseholdCard({
  row,
  onSave,
}: {
  row: HouseholdRow;
  onSave: (id: string, limit: number | null) => Promise<void>;
}): ReactNode {
  const [value, setValue] = useState(row.limitOverride === null ? "" : String(row.limitOverride));

  return (
    <div className="rounded-xl border border-slate-800 bg-[#151B28] p-3 flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-100">{row.name}</h3>
        <span className="text-[11px] text-slate-500">dzieci: {row.childrenCount}</span>
      </div>
      <p className="text-xs text-slate-400">
        Zapytania AI: {row.aiCalls24h} (24 h) · {row.aiCalls7d} (7 dni)
      </p>
      <div className="flex gap-2">
        <input
          className={inputClass}
          type="number"
          min={0}
          max={1000}
          aria-label={`Limit dzienny — ${row.name}`}
          placeholder="Limit globalny"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button
          type="button"
          className="min-h-11 rounded-xl bg-amber-500/90 px-4 text-sm font-semibold text-[#0B0F17]"
          onClick={() => onSave(row.id, value.trim() === "" ? null : Number(value))}
        >
          Zapisz
        </button>
      </div>
    </div>
  );
}

/**
 * Zakładka "Gospodarstwa i Limity": lista rodzin, zużycie AI i nadpisania limitów.
 *
 * @returns {ReactNode} Zawartość zakładki
 */
export function HouseholdsTab(): ReactNode {
  const [rows, setRows] = useState<readonly HouseholdRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await adminRequest<{ items: readonly HouseholdRow[] }>(
        "/api/admin/households",
      );
      setRows(result.items);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać listy.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (householdId: string, limitOverride: number | null) => {
    try {
      await adminRequest("/api/admin/households", {
        method: "PATCH",
        ...jsonBody({ householdId, limitOverride }),
      });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nie udało się zapisać limitu.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <StatusMessage error={error} loading={rows || error ? undefined : "Ładowanie…"} />
      {rows?.length === 0 && <p className="text-sm text-slate-400">Brak gospodarstw.</p>}
      {rows?.map((row) => (
        <HouseholdCard key={`${row.id}:${row.limitOverride}`} row={row} onSave={handleSave} />
      ))}
    </div>
  );
}
