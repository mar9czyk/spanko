"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { formatDuration } from "@/i18n/translate";
import type { MatrixPreviewRow } from "@/lib/admin/matrixPreview";
import { resolveSleepMatrix, validateSleepMatrix } from "@/lib/sleep-engine/matrixOverride";
import type { AgeBracketConfig } from "@/lib/types/database";
import { adminRequest, jsonBody } from "./adminApi";
import { inputClass, PrimaryButton, StatusMessage } from "./ui";
import { useAdminSettings } from "./useAdminSettings";

type EditableField = Exclude<keyof AgeBracketConfig, "minAgeDays" | "maxAgeDays">;

interface MatrixVersion {
  readonly id: string;
  readonly note?: string;
  readonly source: "save" | "restore" | "reset";
  readonly created: string;
}

const SOURCE_LABEL: Record<MatrixVersion["source"], string> = {
  save: "zapis",
  restore: "przywrócenie",
  reset: "reset do domyślnej",
};

const COLUMNS: readonly { key: keyof AgeBracketConfig; label: string; editable: boolean }[] = [
  { key: "minAgeDays", label: "Od (dni)", editable: false },
  { key: "maxAgeDays", label: "Do (dni)", editable: false },
  { key: "targetNapsCount", label: "Drzemek", editable: true },
  { key: "minNapsCount", label: "Min drzemek", editable: true },
  { key: "wwMinMorning", label: "WW rano", editable: true },
  { key: "wwMaxEvening", label: "WW wiecz.", editable: true },
  { key: "maxSingleNapMin", label: "Max drzemka", editable: true },
  { key: "maxDaytimeSleepMin", label: "Max sen dzień", editable: true },
  { key: "medianTotalSleepMin", label: "Norma doby", editable: true },
  { key: "homeostaticTauRiseMin", label: "Tau", editable: true },
  { key: "nightWakingsMean", label: "Pobudki śr.", editable: true },
  { key: "nightWakingsUpperNorm", label: "Pobudki max", editable: true },
];

/**
 * Formatuje zmianę w minutach ze znakiem (+ = później).
 *
 * @param {number} delta - Zmiana w minutach
 * @returns {string} Tekst do wyświetlenia
 */
function formatDelta(delta: number): string {
  if (delta === 0) return "bez zmian";
  return `${delta > 0 ? "+" : "−"}${formatDuration(Math.abs(delta))}`;
}

/**
 * Historia wersji matrycy z przywracaniem.
 *
 * @param {object} props - `refreshKey` odświeża listę po zapisie; `onRestored` przeładowuje ustawienia
 * @returns {ReactNode} Sekcja historii
 */
function MatrixHistory({
  refreshKey,
  onRestored,
}: {
  refreshKey: number;
  onRestored: () => void;
}): ReactNode {
  const [versions, setVersions] = useState<readonly MatrixVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await adminRequest<{ items: readonly MatrixVersion[] }>(
        "/api/admin/matrix/versions",
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

  const handleRestore = async (version: MatrixVersion) => {
    if (!window.confirm("Przywrócić tę wersję matrycy jako obowiązującą?")) return;
    try {
      await adminRequest(`/api/admin/matrix/versions/${version.id}/restore`, { method: "POST" });
      await load();
      onRestored();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Nie udało się przywrócić.");
    }
  };

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-[#151B28] p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Historia zmian matrycy
      </h3>
      <StatusMessage error={error} loading={versions || error ? undefined : "Ładowanie…"} />
      {versions?.length === 0 && <p className="text-xs text-slate-400">Brak zapisanych zmian.</p>}
      {versions?.map((version) => (
        <div
          key={version.id}
          className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 p-2"
        >
          <div className="min-w-0">
            <p className="text-xs text-slate-200">
              {new Date(version.created).toLocaleString("pl-PL")} · {SOURCE_LABEL[version.source]}
            </p>
            {version.note && <p className="truncate text-xs text-slate-400">{version.note}</p>}
          </div>
          <button
            type="button"
            className="min-h-11 shrink-0 rounded-xl border border-slate-700 px-3 text-xs text-slate-200"
            onClick={() => handleRestore(version)}
          >
            Przywróć
          </button>
        </div>
      ))}
    </section>
  );
}

/**
 * Tabela podglądu skutków proponowanej matrycy dla 3 przykładowych profili dzieci.
 *
 * @param {object} props - Wiersze porównania
 * @returns {ReactNode} Tabela
 */
function PreviewTable({ rows }: { rows: readonly MatrixPreviewRow[] }): ReactNode {
  return (
    <div className="rounded-xl border border-violet-500/20 bg-[#151B28] p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
        Podgląd skutków (SweetSpot po porannej pobudce)
      </h3>
      <table className="w-full text-xs text-slate-300">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-slate-400">
            <th className="pb-1 text-left font-medium">Profil</th>
            <th className="pb-1 text-right font-medium">1. drzemka</th>
            <th className="pb-1 text-right font-medium">Sen nocny</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-slate-800">
              <th scope="row" className="py-1.5 text-left font-medium">
                {row.label}
              </th>
              <td className="text-right">
                {formatDuration(row.firstWindow.before.sweetSpotAfterWakeMin)} →{" "}
                {formatDuration(row.firstWindow.after.sweetSpotAfterWakeMin)}
                <span className="block text-xs text-slate-400">
                  {formatDelta(row.firstWindowDeltaMin)}
                </span>
              </td>
              <td className="text-right">
                {formatDuration(row.bedtimeWindow.before.sweetSpotAfterWakeMin)} →{" "}
                {formatDuration(row.bedtimeWindow.after.sweetSpotAfterWakeMin)}
                <span className="block text-xs text-slate-400">
                  {formatDelta(row.bedtimeDeltaMin)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Zakładka "Matryca Snu (0–36 msc)": edycja parametrów, podgląd skutków i historia zmian.
 *
 * @description
 * Granice wieku są stałe (ciągłość zakresów); edytowalne są parametry snu. Zapis jest walidowany
 * po stronie klienta i ponownie na serwerze, a każda zmiana trafia do historii wersji.
 *
 * @returns {ReactNode} Zawartość zakładki
 */
export function MatrixTab(): ReactNode {
  const { data, error, isSaving, save, reload } = useAdminSettings();
  const [matrix, setMatrix] = useState<readonly AgeBracketConfig[]>([]);
  const [validationErrors, setValidationErrors] = useState<readonly string[]>([]);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<readonly MatrixPreviewRow[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    if (!data) return;
    setMatrix(resolveSleepMatrix(data.settings?.sleep_matrix_override_json));
    setPreview(null);
  }, [data]);

  if (!data) {
    return <StatusMessage error={error} loading="Ładowanie matrycy…" />;
  }

  const updateCell = (rowIndex: number, field: EditableField, raw: string) => {
    setSaved(false);
    setPreview(null);
    setMatrix((current) =>
      current.map((bracket, index) =>
        index === rowIndex
          ? { ...bracket, [field]: raw === "" ? undefined : Number(raw) }
          : bracket,
      ),
    );
  };

  const handlePreview = async () => {
    const validation = validateSleepMatrix(matrix);
    if (!validation.ok) {
      setValidationErrors(validation.errors);
      return;
    }
    setValidationErrors([]);
    setPreviewError(null);
    try {
      const result = await adminRequest<{ rows: readonly MatrixPreviewRow[] }>(
        "/api/admin/matrix/preview",
        { method: "POST", ...jsonBody({ matrix: validation.matrix }) },
      );
      setPreview(result.rows);
    } catch (previewFailure) {
      setPreviewError(previewFailure instanceof Error ? previewFailure.message : "Błąd podglądu.");
    }
  };

  const handleSave = async () => {
    const validation = validateSleepMatrix(matrix);
    if (!validation.ok) {
      setValidationErrors(validation.errors);
      return;
    }
    setValidationErrors([]);
    const ok = await save({
      sleep_matrix_override_json: validation.matrix,
      sleep_matrix_note: note || undefined,
    });
    setSaved(ok);
    if (ok) {
      setNote("");
      setHistoryKey((value) => value + 1);
    }
  };

  const handleReset = async () => {
    setValidationErrors([]);
    const ok = await save({
      sleep_matrix_override_json: null,
      sleep_matrix_note: note || undefined,
    });
    setSaved(ok);
    if (ok) setHistoryKey((value) => value + 1);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-400">
        Nadpisanie wpływa na wnioski generowane przez serwer (evaluate-insights). Pusta wartość =
        matryca domyślna.
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-max text-xs">
          <thead className="bg-[#151B28] text-slate-400">
            <tr>
              {COLUMNS.map((column) => (
                <th key={column.key} className="px-2 py-2 text-left font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((bracket, rowIndex) => (
              <tr key={bracket.minAgeDays} className="border-t border-slate-800">
                {COLUMNS.map((column) => (
                  <td key={column.key} className="px-1 py-1">
                    {column.editable ? (
                      <input
                        type="number"
                        aria-label={`${column.label} (${bracket.minAgeDays}–${bracket.maxAgeDays} dni)`}
                        className="w-20 rounded border border-slate-700 bg-[#0B0F17] px-1.5 py-1 text-ink"
                        value={bracket[column.key] ?? ""}
                        onChange={(event) =>
                          updateCell(rowIndex, column.key as EditableField, event.target.value)
                        }
                      />
                    ) : (
                      <span className="px-1.5 text-slate-400">{bracket[column.key]}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {validationErrors.length > 0 && <StatusMessage error={validationErrors.join(" ")} />}
      {error && <StatusMessage error={error} />}
      {saved && <p className="text-xs text-emerald-400">Zapisano.</p>}

      <button
        type="button"
        className="min-h-11 rounded-xl border border-violet-500/40 px-4 text-sm text-violet-200"
        onClick={handlePreview}
      >
        Podgląd skutków przed zapisem
      </button>
      {previewError && <StatusMessage error={previewError} />}
      {preview && <PreviewTable rows={preview} />}

      <input
        className={inputClass}
        aria-label="Notatka do wersji matrycy"
        placeholder="Notatka do zmiany (opcjonalnie)"
        maxLength={300}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <PrimaryButton onClick={handleSave} disabled={isSaving}>
        {isSaving ? "Zapisywanie…" : "Zapisz matrycę"}
      </PrimaryButton>
      <button
        type="button"
        className="min-h-11 rounded-xl border border-slate-700 px-4 text-sm text-slate-300 disabled:opacity-50"
        onClick={handleReset}
        disabled={isSaving}
      >
        Przywróć domyślne
      </button>

      <MatrixHistory refreshKey={historyKey} onRestored={reload} />
    </div>
  );
}
