"use client";

import { type ReactNode, useEffect, useState } from "react";
import type { UserDailyPoint, UserUsage } from "@/lib/admin/usage";
import { adminRequest } from "./adminApi";
import { StatusMessage } from "./ui";

const PERIODS = [7, 30, 90] as const;
const LEGACY_LABEL = "gospodarstwo (sprzed telemetrii)";

interface UsageRow extends UserUsage {
  readonly householdName: string | null;
}

interface UsageResponse {
  readonly totals: { readonly calls: number; readonly tokens: number; readonly costUsd: number };
  readonly rows: readonly UsageRow[];
}

interface DetailResponse {
  readonly user: { readonly id: string; readonly email: string };
  readonly usage: UserUsage | null;
  readonly daily: readonly UserDailyPoint[];
}

const formatCost = (value: number) => `$${value.toFixed(value < 1 ? 4 : 2)}`;
const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pl-PL") : "—");

function Stat({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#151B28] p-3">
      <p className="text-[11px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

function DailyBars({
  points,
  pick,
  label,
}: {
  points: readonly UserDailyPoint[];
  pick: (point: UserDailyPoint) => number;
  label: string;
}): ReactNode {
  const max = Math.max(1, ...points.map(pick));
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-xs text-slate-400">{label}</figcaption>
      <div className="flex h-16 items-end gap-px" role="img" aria-label={label}>
        {points.map((point) => (
          <div
            key={point.date}
            title={`${point.date}: ${pick(point)}`}
            className="min-w-px flex-1 rounded-t bg-amber-500/80"
            style={{ height: `${Math.max((pick(point) / max) * 100, pick(point) > 0 ? 4 : 0)}%` }}
          />
        ))}
      </div>
    </figure>
  );
}

function UserDetails({
  userId,
  days,
  onOpenInspector,
}: {
  userId: string;
  days: number;
  onOpenInspector: (userId: string) => void;
}): ReactNode {
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminRequest<DetailResponse>(`/api/admin/usage/${userId}?days=${days}`)
      .then((data) => !cancelled && setDetail(data))
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, days]);

  if (!detail) return <StatusMessage error={error} loading="Ładowanie…" />;
  const kinds = Object.entries(detail.usage?.byKind ?? {});
  return (
    <div className="flex flex-col gap-3 border-t border-slate-800 pt-3">
      <DailyBars points={detail.daily} pick={(p) => p.calls} label="Wywołania AI dziennie" />
      <DailyBars points={detail.daily} pick={(p) => p.costUsd} label="Koszt dziennie (USD)" />
      <DailyBars points={detail.daily} pick={(p) => p.sleepLogs} label="Wpisy snu dziennie" />
      {kinds.length > 0 && (
        <ul className="text-xs text-slate-300">
          {kinds.map(([kind, value]) => (
            <li key={kind}>
              {kind}: {value.calls} wywołań · {formatCost(value.costUsd)}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => onOpenInspector(userId)}
        className="min-h-11 rounded-xl border border-amber-500/40 px-4 text-sm text-amber-200"
      >
        Otwórz w Inspektorze AI
      </button>
    </div>
  );
}

/**
 * Zakładka „Telemetria”: użycie AI i aktywność per użytkownik (7/30/90 dni), z rozwijanymi szczegółami.
 *
 * @param {object} props - `onOpenInspector` przełącza na Inspektora z filtrem po użytkowniku
 * @returns {ReactNode} Zawartość zakładki
 */
export function UsageTab({
  onOpenInspector,
}: {
  onOpenInspector: (userId: string) => void;
}): ReactNode {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(7);
  const [data, setData] = useState<UsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    adminRequest<UsageResponse>(`/api/admin/usage?days=${days}`)
      .then((response) => {
        if (!cancelled) {
          setData(response);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex gap-2 border-0 p-0">
        <legend className="sr-only">Okres</legend>
        {PERIODS.map((period) => (
          <button
            key={period}
            type="button"
            aria-pressed={days === period}
            onClick={() => setDays(period)}
            className={`min-h-11 flex-1 rounded-xl border text-sm ${
              days === period
                ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                : "border-slate-700 text-slate-300"
            }`}
          >
            {period} dni
          </button>
        ))}
      </fieldset>
      {!data && <StatusMessage error={error} loading="Ładowanie telemetrii…" />}
      {data && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Wywołania" value={String(data.totals.calls)} />
            <Stat label="Tokeny" value={data.totals.tokens.toLocaleString("pl-PL")} />
            <Stat label="Koszt" value={formatCost(data.totals.costUsd)} />
          </div>
          {data.rows.length === 0 && (
            <p className="text-sm text-slate-400">Brak aktywności w tym okresie.</p>
          )}
          <ul className="flex flex-col gap-2">
            {data.rows.map((row) => {
              const key = row.userId ?? `legacy:${row.householdId ?? ""}`;
              const isOpen = openKey === key;
              return (
                <li
                  key={key}
                  className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-[#151B28] p-3"
                >
                  <button
                    type="button"
                    disabled={!row.userId}
                    aria-expanded={isOpen}
                    onClick={() => setOpenKey(isOpen ? null : key)}
                    className="flex flex-col gap-1 text-left"
                  >
                    <span className="text-sm font-medium text-ink">
                      {row.email ?? LEGACY_LABEL}
                    </span>
                    <span className="text-xs text-slate-400">
                      {row.householdName ?? "bez gospodarstwa"}
                    </span>
                    <span className="grid grid-cols-2 gap-x-3 text-xs text-slate-300">
                      <span>
                        AI: {row.calls}
                        {row.errors > 0 ? ` (błędy: ${row.errors})` : ""}
                      </span>
                      <span>Koszt: {formatCost(row.costUsd)}</span>
                      <span>
                        Tokeny: {(row.promptTokens + row.completionTokens).toLocaleString("pl-PL")}
                      </span>
                      <span>Wpisy snu: {row.sleepLogs}</span>
                      <span>Dni aktywne: {row.activeDays}</span>
                      <span>Widziany: {formatDate(row.lastSeenAt ?? row.lastActivityAt)}</span>
                    </span>
                  </button>
                  {isOpen && row.userId && (
                    <UserDetails
                      userId={row.userId}
                      days={days}
                      onOpenInspector={onOpenInspector}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
