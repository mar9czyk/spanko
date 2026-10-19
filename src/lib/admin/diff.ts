export type DiffOpType = "same" | "add" | "del";

export interface DiffOp {
  readonly type: DiffOpType;
  readonly text: string;
}

/**
 * Prosty diff liniowy (najdłuższy wspólny podciąg) między dwoma tekstami.
 *
 * @description
 * Zwraca operacje w kolejności tekstu: `same` (bez zmian), `del` (tylko w starym), `add` (tylko w nowym).
 * Złożoność O(n·m) — wystarczająca dla promptów do 8000 znaków.
 *
 * @param {string} before - Stary tekst
 * @param {string} after - Nowy tekst
 * @returns {DiffOp[]} Operacje diffu
 */
export function diffLines(before: string, after: string): DiffOp[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const row = lcs[i] as number[];
      const nextRow = lcs[i + 1] as number[];
      row[j] =
        a[i] === b[j] ? (nextRow[j + 1] ?? 0) + 1 : Math.max(nextRow[j] ?? 0, row[j + 1] ?? 0);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ type: "same", text: a[i] as string });
      i++;
      j++;
    } else if (((lcs[i + 1] as number[])[j] ?? 0) >= ((lcs[i] as number[])[j + 1] ?? 0)) {
      ops.push({ type: "del", text: a[i] as string });
      i++;
    } else {
      ops.push({ type: "add", text: b[j] as string });
      j++;
    }
  }
  while (i < a.length) ops.push({ type: "del", text: a[i++] as string });
  while (j < b.length) ops.push({ type: "add", text: b[j++] as string });
  return ops;
}
