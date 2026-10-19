import type { ParentFeedback } from "@/lib/types/database";

export interface QualityInput {
  readonly category: string;
  readonly promptVersion: number;
  readonly feedback?: ParentFeedback;
  readonly insightStatus?: string;
}

export interface QualityRow {
  readonly key: string;
  readonly total: number;
  readonly accepted: number;
  readonly corrected: number;
  readonly pending: number;
  /** accepted / (accepted + corrected); null, gdy nikt jeszcze nie ocenił */
  readonly acceptanceRate: number | null;
}

export interface AiQualityReport {
  readonly byCategory: QualityRow[];
  readonly byPromptVersion: QualityRow[];
}

type Outcome = "accepted" | "corrected" | "pending";

/**
 * Klasyfikuje reakcję rodzica: accepted → zaakceptowany; adjusted/rejected lub status
 * corrected_by_parent → skorygowany; reszta → oczekuje na ocenę.
 *
 * @param {QualityInput} input - Wpis wniosku z reakcją
 * @returns {Outcome} Wynik klasyfikacji
 */
function classify(input: QualityInput): Outcome {
  if (
    input.feedback === "adjusted" ||
    input.feedback === "rejected" ||
    input.insightStatus === "corrected_by_parent"
  ) {
    return "corrected";
  }
  return input.feedback === "accepted" ? "accepted" : "pending";
}

/**
 * Grupuje wpisy po kluczu i liczy accepted/corrected/pending oraz odsetek akceptacji.
 *
 * @param {readonly QualityInput[]} rows - Wpisy
 * @param {(row: QualityInput) => string} keyOf - Funkcja klucza grupowania
 * @returns {QualityRow[]} Wiersze posortowane malejąco wg liczby wniosków
 */
function groupBy(
  rows: readonly QualityInput[],
  keyOf: (row: QualityInput) => string,
): QualityRow[] {
  const groups = new Map<string, Record<Outcome, number>>();
  for (const row of rows) {
    const key = keyOf(row);
    const counts = groups.get(key) ?? { accepted: 0, corrected: 0, pending: 0 };
    counts[classify(row)]++;
    groups.set(key, counts);
  }
  return [...groups.entries()]
    .map(([key, counts]) => {
      const rated = counts.accepted + counts.corrected;
      return {
        key,
        total: rated + counts.pending,
        accepted: counts.accepted,
        corrected: counts.corrected,
        pending: counts.pending,
        acceptanceRate: rated === 0 ? null : counts.accepted / rated,
      };
    })
    .sort((left, right) => right.total - left.total || left.key.localeCompare(right.key));
}

/**
 * Buduje raport jakości wniosków AI: per kategoria (CAT1–CAT7) i per wersja promptu.
 *
 * @param {readonly QualityInput[]} rows - Wywołania z reakcją rodzica
 * @returns {AiQualityReport} Raport jakości
 */
export function computeAiQuality(rows: readonly QualityInput[]): AiQualityReport {
  return {
    byCategory: groupBy(rows, (row) => row.category || "—"),
    byPromptVersion: groupBy(rows, (row) =>
      row.promptVersion > 0 ? `v${row.promptVersion}` : "bez wersji",
    ),
  };
}
