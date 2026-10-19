"use client";

import { type ReactNode, useEffect, useState } from "react";
import type { AiWindowStats, DailyAiPoint, DashboardAlert } from "@/lib/admin/stats";
import { adminRequest } from "./adminApi";
import { StatusMessage } from "./ui";

interface DashboardData {
  readonly counts: {
    readonly households: number | null;
    readonly children: number | null;
    readonly users: number;
  };
  readonly activeUsers: { readonly d1: number; readonly d7: number; readonly d30: number };
  readonly ai: {
    readonly h24: AiWindowStats;
    readonly d7: AiWindowStats;
    readonly d30: AiWindowStats;
    readonly daily: readonly DailyAiPoint[];
  };
  readonly alerts: readonly DashboardAlert[];
}

const CHART_HEIGHT = 80;
const BAR_WIDTH = 14;
const BAR_GAP = 6;

/**
 * Kafelek z liczbą i podpisem.
 *
 * @param {object} props - Etykieta i wartość
 * @returns {ReactNode} Kafelek
 */
function Tile({ label, value }: { label: string; value: string | number }): ReactNode {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#151B28] p-3">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-100">{value}</p>
    </div>
  );
}

/**
 * Wykres słupkowy wywołań AI z ostatnich dni (czyste SVG, bez zależności).
 *
 * @param {object} props - Seria dzienna
 * @returns {ReactNode} Wykres
 */
function CallsChart({ points }: { points: readonly DailyAiPoint[] }): ReactNode {
  const max = Math.max(1, ...points.map((point) => point.calls));
  const width = points.length * (BAR_WIDTH + BAR_GAP);
  return (
    <figure className="rounded-xl border border-slate-800 bg-[#151B28] p-3">
      <figcaption className="mb-2 text-xs text-slate-400">
        Wywołania AI — ostatnie {points.length} dni
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${CHART_HEIGHT + 14}`}
        className="w-full"
        role="img"
        aria-label="Wykres wywołań AI na dzień"
      >
        {points.map((point, index) => {
          const barHeight = (point.calls / max) * CHART_HEIGHT;
          const x = index * (BAR_WIDTH + BAR_GAP);
          return (
            <g key={point.date}>
              <title>{`${point.date}: ${point.calls} wywołań, ~$${point.costUsd}`}</title>
              <rect
                x={x}
                y={CHART_HEIGHT - barHeight}
                width={BAR_WIDTH}
                height={Math.max(barHeight, point.calls > 0 ? 2 : 0)}
                rx={3}
                className="fill-amber-500/80"
              />
              <text
                x={x + BAR_WIDTH / 2}
                y={CHART_HEIGHT + 11}
                textAnchor="middle"
                fontSize="7"
                className="fill-slate-500"
              >
                {point.date.slice(8)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/**
 * Wiersz tabeli statystyk AI dla jednego okna czasowego.
 *
 * @param {object} props - Etykieta okna i statystyki
 * @returns {ReactNode} Wiersz
 */
function StatsRow({ label, stats }: { label: string; stats: AiWindowStats }): ReactNode {
  return (
    <tr className="border-t border-slate-800">
      <th scope="row" className="py-2 pr-2 text-left font-medium text-slate-300">
        {label}
      </th>
      <td className="py-2 text-right">{stats.calls}</td>
      <td className="py-2 text-right">{Math.round(stats.errorRate * 100)}%</td>
      <td className="py-2 text-right">{stats.avgLatencyMs} ms</td>
      <td className="py-2 text-right">${stats.costUsd.toFixed(2)}</td>
    </tr>
  );
}

/**
 * Zakładka "Pulpit": liczby, aktywność, statystyki AI, wykres kosztów i alerty.
 *
 * @returns {ReactNode} Zawartość zakładki
 */
export function DashboardTab(): ReactNode {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminRequest<DashboardData>("/api/admin/dashboard")
      .then(setData)
      .catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać pulpitu."),
      );
  }, []);

  if (!data) {
    return <StatusMessage error={error} loading="Ładowanie…" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {data.alerts.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Alerty">
          {data.alerts.map((alert) => (
            <li
              key={`${alert.code}:${alert.message}`}
              className={`rounded-lg px-3 py-2 text-xs ${
                alert.level === "critical"
                  ? "bg-red-500/10 text-red-300"
                  : "bg-amber-500/10 text-amber-300"
              }`}
            >
              {alert.message}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Tile label="Gospodarstwa" value={data.counts.households ?? "—"} />
        <Tile label="Dzieci" value={data.counts.children ?? "—"} />
        <Tile label="Użytkownicy" value={data.counts.users} />
        <Tile label="Aktywni (24 h)" value={data.activeUsers.d1} />
        <Tile label="Aktywni (7 dni)" value={data.activeUsers.d7} />
        <Tile label="Aktywni (30 dni)" value={data.activeUsers.d30} />
      </div>

      <CallsChart points={data.ai.daily} />

      <div className="rounded-xl border border-slate-800 bg-[#151B28] p-3 text-xs text-slate-400">
        <table className="w-full">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-slate-500">
              <th className="pb-2 text-left font-medium">Okno</th>
              <th className="pb-2 text-right font-medium">Wywołania</th>
              <th className="pb-2 text-right font-medium">Błędy</th>
              <th className="pb-2 text-right font-medium">Śr. czas</th>
              <th className="pb-2 text-right font-medium">Koszt</th>
            </tr>
          </thead>
          <tbody>
            <StatsRow label="24 godziny" stats={data.ai.h24} />
            <StatsRow label="7 dni" stats={data.ai.d7} />
            <StatsRow label="30 dni" stats={data.ai.d30} />
          </tbody>
        </table>
        <p className="mt-2 text-[10px] text-slate-500">
          Koszt jest szacunkiem na podstawie tokenów i tabeli cen w src/lib/admin/pricing.ts.
        </p>
      </div>
    </div>
  );
}
