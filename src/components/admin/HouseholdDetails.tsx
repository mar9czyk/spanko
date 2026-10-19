"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { authorizedFetch } from "@/lib/client-data";
import { adminRequest, jsonBody } from "./adminApi";
import { StatusMessage } from "./ui";

interface Invite {
  readonly code: string | null;
  readonly expiresAt: string | null;
  readonly active?: boolean;
}

interface Details {
  readonly household: { readonly id: string; readonly name: string; readonly invite: Invite };
  readonly members: readonly {
    readonly id: string;
    readonly email: string;
    readonly name: string;
    readonly is_admin: boolean;
    readonly is_blocked: boolean;
    readonly last_seen_at: string | null;
  }[];
  readonly children: readonly {
    readonly id: string;
    readonly name: string;
    readonly birth_date: string;
    readonly active_day_mode: string;
  }[];
}

/**
 * Szczegóły gospodarstwa: członkowie, dzieci, zaproszenie (unieważnij / nowy kod) i eksport JSON (RODO).
 * Otwarcie szczegółów i eksport zapisują wpisy w dzienniku działań.
 *
 * @param {object} props - Identyfikator gospodarstwa
 * @returns {ReactNode} Panel szczegółów
 */
export function HouseholdDetails({ householdId }: { householdId: string }): ReactNode {
  const [details, setDetails] = useState<Details | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await adminRequest<Details>(`/api/admin/households/${householdId}`);
      setDetails(result);
      setInvite(result.household.invite);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać szczegółów.");
    }
  }, [householdId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleInvite = async (action: "revoke" | "regenerate") => {
    const message =
      action === "revoke"
        ? "Unieważnić aktywny kod zaproszenia?"
        : "Wygenerować nowy kod (poprzedni przestanie działać)?";
    if (!window.confirm(message)) return;
    try {
      const result = await adminRequest<{ invite: Invite }>(
        `/api/admin/households/${householdId}/invite`,
        { method: "POST", ...jsonBody({ action }) },
      );
      setInvite(result.invite);
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Nie udało się zmienić kodu.");
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await authorizedFetch(`/api/admin/households/${householdId}/export`);
      if (!response.ok) throw new Error(`Eksport nie powiódł się (HTTP ${response.status}).`);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `spanko-household-${householdId}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Eksport nie powiódł się.");
    } finally {
      setIsExporting(false);
    }
  };

  if (!details) {
    return <StatusMessage error={error} loading="Ładowanie szczegółów…" />;
  }

  const inviteActive =
    Boolean(invite?.code) &&
    Boolean(invite?.expiresAt) &&
    new Date(invite?.expiresAt ?? 0) > new Date();

  return (
    <div className="mt-2 flex flex-col gap-3 border-t border-slate-800 pt-3 text-xs text-slate-300">
      {error && <StatusMessage error={error} />}

      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
          Członkowie ({details.members.length})
        </p>
        <ul className="flex flex-col gap-1">
          {details.members.map((member) => (
            <li key={member.id}>
              {member.email}
              {member.is_admin ? " · admin" : ""}
              {member.is_blocked ? " · zablokowany" : ""}
              <span className="text-slate-500">
                {" "}
                · ostatnio:{" "}
                {member.last_seen_at ? new Date(member.last_seen_at).toLocaleString("pl-PL") : "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
          Dzieci ({details.children.length})
        </p>
        <ul className="flex flex-col gap-1">
          {details.children.map((child) => (
            <li key={child.id}>
              {child.name}{" "}
              <span className="text-slate-500">
                · ur. {child.birth_date.slice(0, 10)} · {child.active_day_mode}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Kod zaproszenia</p>
        <p>
          {inviteActive ? (
            <>
              <b className="font-mono tracking-widest text-amber-300">{invite?.code}</b> · ważny do{" "}
              {new Date(invite?.expiresAt ?? 0).toLocaleString("pl-PL")}
            </>
          ) : (
            "Brak aktywnego kodu."
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-11 rounded-xl border border-slate-700 px-3 text-xs text-slate-200"
            onClick={() => handleInvite("regenerate")}
          >
            Nowy kod
          </button>
          {inviteActive && (
            <button
              type="button"
              className="min-h-11 rounded-xl border border-red-500/40 px-3 text-xs text-red-300"
              onClick={() => handleInvite("revoke")}
            >
              Unieważnij kod
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        disabled={isExporting}
        className="min-h-11 rounded-xl border border-violet-500/40 px-3 text-xs text-violet-200 disabled:opacity-50"
        onClick={handleExport}
      >
        {isExporting ? "Eksportowanie…" : "Eksportuj dane gospodarstwa (JSON, RODO)"}
      </button>
    </div>
  );
}
