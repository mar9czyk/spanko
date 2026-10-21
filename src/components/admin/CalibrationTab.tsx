"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import type { CalibrationRow } from "@/lib/admin/calibration";
import type { QualityRow } from "@/lib/admin/quality";
import { adminRequest, jsonBody } from "./adminApi";
import { PrimaryButton, StatusMessage } from "./ui";

interface CalibrationData {
  readonly days: number;
  readonly measured: number;
  readonly lastComputedAt: string;
  readonly rows: readonly CalibrationRow[];
  readonly feedback: readonly QualityRow[];
}

interface RecomputeResult {
  readonly children: number;
  readonly created: number;
  readonly updated: number;
  readonly skipped: number;
}

const WINDOW_OPTIONS = [7, 30, 90] as const;
const TYPE_LABEL = { nap: "Drzemki", night: "Noc" } as const;

const percent = (value: number | null): string =>
  value === null ? "—" : `${Math.round(value * 100)}%`;

const signed = (value: number): string => (value > 0 ? `+${value}` : String(value));

/**
 * Zakładka „Trafność prognoz”: błąd SweetSpot per wiek, długa latencja i odrzucone wnioski.
 *
 * @returns {ReactNode} Zawartość zakładki
 */
export function CalibrationTab(): ReactNode {
  const [days, setDays] = useState<(typeof WINDOW_OPTIONS)[number]>(30);
  const [data, setData] = useState<CalibrationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    adminRequest<CalibrationData>(`/api/admin/calibration?days=${days}`)
      .then(setData)
      .catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać raportu."),
      );
  }, [days]);

  useEffect(load, [load]);

  const recompute = async (overwrite: boolean) => {
    setIsBusy(true);
    setNotice(null);
    try {
      const result = await adminRequest<RecomputeResult>("/api/admin/calibration", {
        method: "POST",
        ...jsonBody({ days, overwrite }),
      });
      setNotice(
        `Dzieci: ${result.children}. Nowe pomiary: ${result.created}, przeliczone: ${result.updated}, bez zmian: ${result.skipped}.`,
      );
      load();
    } catch (recomputeError) {
      setError(
        recomputeError instanceof Error ? recomputeError.message : "Przeliczenie nie powiodło się.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-400">
        Prognoza SweetSpot odtworzona z logów (tak jak liczy ją pulpit w chwili odłożenia) i
        zestawiona z faktycznym odłożeniem. Błąd dodatni: rodzice kładą później, niż przewiduje
        silnik. Długa latencja: zasypianie powyżej 20 min.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Okno raportu"
          className="min-h-11 rounded-xl border border-slate-700 bg-[#151B28] px-3 text-sm text-slate-100"
          value={days}
          onChange={(event) =>
            setDays(Number(event.target.value) as (typeof WINDOW_OPTIONS)[number])
          }
        >
          {WINDOW_OPTIONS.map((option) => (
            <option key={option} value={option}>
              Ostatnie {option} dni
            </option>
          ))}
        </select>
        <PrimaryButton disabled={isBusy} onClick={() => recompute(false)}>
          {isBusy ? "Liczenie…" : "Dolicz brakujące"}
        </PrimaryButton>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => recompute(true)}
          className="min-h-11 rounded-xl border border-slate-700 px-4 text-sm text-slate-300 disabled:opacity-50"
        >
          Przelicz wszystko obecnym silnikiem
        </button>
      </div>

      {notice && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{notice}</p>
      )}
      <StatusMessage error={error} loading={data ? undefined : "Ładowanie…"} />

      {data && (
        <>
          <section className="rounded-xl border border-slate-800 bg-[#151B28] p-3 text-xs text-slate-300">
            <h2 className="mb-2 text-sm font-semibold text-slate-100">
              Błąd prognozy ({data.measured} snów)
            </h2>
            {data.rows.length === 0 ? (
              <p className="text-slate-400">Brak pomiarów w tym oknie. Użyj „Dolicz brakujące”.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="pb-2 text-left font-medium">Wiek</th>
                      <th className="pb-2 text-left font-medium">Sen</th>
                      <th className="pb-2 pl-2 text-right font-medium">N</th>
                      <th className="pb-2 pl-2 text-right font-medium">Mediana |błędu|</th>
                      <th className="pb-2 pl-2 text-right font-medium">Przesunięcie</th>
                      <th className="pb-2 pl-2 text-right font-medium">W oknie ±15</th>
                      <th className="pb-2 pl-2 text-right font-medium">Latencja &gt;20</th>
                      <th className="pb-2 pl-2 text-right font-medium">Długość</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row) => (
                      <tr
                        key={`${row.ageBucket}-${row.type}`}
                        className="border-t border-slate-800"
                      >
                        <th
                          scope="row"
                          className="whitespace-nowrap py-2 pr-2 text-left font-medium"
                        >
                          {row.ageBucket}
                        </th>
                        <td className="py-2 pl-2">{TYPE_LABEL[row.type]}</td>
                        <td className="py-2 pl-2 text-right">{row.count}</td>
                        <td className="py-2 pl-2 text-right">{row.medianAbsErrorMin} min</td>
                        <td className="py-2 pl-2 text-right">{signed(row.medianBiasMin)} min</td>
                        <td className="py-2 pl-2 text-right">{percent(row.withinCompassRate)}</td>
                        <td className="py-2 pl-2 text-right">{percent(row.longLatencyRate)}</td>
                        <td className="py-2 pl-2 text-right">{row.medianDurationMin} min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.lastComputedAt && (
              <p className="mt-2 text-[10px] text-slate-500">
                Ostatni pomiar: {new Date(data.lastComputedAt).toLocaleString("pl-PL")}
              </p>
            )}
          </section>

          <section className="rounded-xl border border-slate-800 bg-[#151B28] p-3 text-xs text-slate-300">
            <h2 className="mb-2 text-sm font-semibold text-slate-100">
              Wnioski odrzucone przez rodziców
            </h2>
            {data.feedback.length === 0 ? (
              <p className="text-slate-400">Brak wniosków w tym oknie.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="pb-2 text-left font-medium">Diagnoza</th>
                    <th className="pb-2 pl-2 text-right font-medium">Wnioski</th>
                    <th className="pb-2 pl-2 text-right font-medium">Ocenione</th>
                    <th className="pb-2 pl-2 text-right font-medium">Odrzucone</th>
                  </tr>
                </thead>
                <tbody>
                  {data.feedback.map((row) => (
                    <tr key={row.key} className="border-t border-slate-800">
                      <th scope="row" className="break-all py-2 pr-2 text-left font-medium">
                        {row.key}
                      </th>
                      <td className="py-2 pl-2 text-right">{row.total}</td>
                      <td className="py-2 pl-2 text-right">{row.accepted + row.corrected}</td>
                      <td className="py-2 pl-2 text-right">
                        {percent(row.acceptanceRate === null ? null : 1 - row.acceptanceRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
