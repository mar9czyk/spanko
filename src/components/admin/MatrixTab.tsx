"use client";

import { type ReactNode, useEffect, useState } from "react";
import { resolveSleepMatrix, validateSleepMatrix } from "@/lib/sleep-engine/matrixOverride";
import type { AgeBracketConfig } from "@/lib/types/database";
import { PrimaryButton, StatusMessage } from "./ui";
import { useAdminSettings } from "./useAdminSettings";

type EditableField = Exclude<keyof AgeBracketConfig, "minAgeDays" | "maxAgeDays">;

const COLUMNS: readonly { key: keyof AgeBracketConfig; label: string; editable: boolean }[] = [
  { key: "minAgeDays", label: "Od (dni)", editable: false },
  { key: "maxAgeDays", label: "Do (dni)", editable: false },
  { key: "targetNapsCount", label: "Drzemek", editable: true },
  { key: "wwMinMorning", label: "WW rano", editable: true },
  { key: "wwMaxEvening", label: "WW wiecz.", editable: true },
  { key: "maxSingleNapMin", label: "Max drzemka", editable: true },
  { key: "maxDaytimeSleepMin", label: "Max sen dzień", editable: true },
  { key: "medianTotalSleepMin", label: "Norma doby", editable: true },
  { key: "homeostaticTauRiseMin", label: "Tau", editable: true },
];

/**
 * Zakładka "Matryca Snu (0–36 msc)": edycja parametrów przedziałów wiekowych.
 *
 * @description
 * Granice wieku są stałe (ciągłość zakresów); edytowalne są parametry snu. Zapis jest walidowany
 * po stronie klienta i ponownie na serwerze. Nadpisanie używa endpoint evaluate-insights.
 *
 * @returns {ReactNode} Zawartość zakładki
 */
export function MatrixTab(): ReactNode {
  const { data, error, isSaving, save } = useAdminSettings();
  const [matrix, setMatrix] = useState<readonly AgeBracketConfig[]>([]);
  const [validationErrors, setValidationErrors] = useState<readonly string[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setMatrix(resolveSleepMatrix(data.settings?.sleep_matrix_override_json));
  }, [data]);

  if (!data) {
    return <StatusMessage error={error} loading="Ładowanie matrycy…" />;
  }

  const updateCell = (rowIndex: number, field: EditableField, raw: string) => {
    setSaved(false);
    setMatrix((current) =>
      current.map((bracket, index) =>
        index === rowIndex ? { ...bracket, [field]: Number(raw) } : bracket,
      ),
    );
  };

  const handleSave = async () => {
    const validation = validateSleepMatrix(matrix);
    if (!validation.ok) {
      setValidationErrors(validation.errors);
      return;
    }
    setValidationErrors([]);
    setSaved(await save({ sleep_matrix_override_json: validation.matrix }));
  };

  const handleReset = async () => {
    setValidationErrors([]);
    setSaved(await save({ sleep_matrix_override_json: null }));
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-500">
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
                        className="w-20 rounded border border-slate-700 bg-[#0B0F17] px-1.5 py-1 text-slate-100"
                        value={bracket[column.key]}
                        onChange={(event) =>
                          updateCell(rowIndex, column.key as EditableField, event.target.value)
                        }
                      />
                    ) : (
                      <span className="px-1.5 text-slate-500">{bracket[column.key]}</span>
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
    </div>
  );
}
