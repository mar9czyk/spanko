import { describe, expect, it } from "vitest";
import { DEFAULT_SLEEP_MATRIX, resolveSleepMatrix, validateSleepMatrix } from "../index";
import type { AgeBracketConfig } from "../types";

const cloneDefault = (): AgeBracketConfig[] =>
  DEFAULT_SLEEP_MATRIX.map((bracket) => ({ ...bracket }));

const patchBracket = (
  matrix: readonly AgeBracketConfig[],
  index: number,
  patch: Partial<AgeBracketConfig>,
): AgeBracketConfig => {
  const bracket = matrix[index];
  if (!bracket) throw new Error(`brak przedziału ${index}`);
  return { ...bracket, ...patch };
};

describe("matrixOverride", () => {
  it("akceptuje poprawną matrycę (tablicę oraz obiekt { brackets })", () => {
    const matrix = cloneDefault();
    expect(validateSleepMatrix(matrix).ok).toBe(true);
    expect(validateSleepMatrix({ brackets: matrix }).ok).toBe(true);
  });

  it("zwraca nadpisaną matrycę posortowaną po wieku", () => {
    const matrix = cloneDefault().reverse();
    const first = matrix[matrix.length - 1];
    if (!first) throw new Error("brak przedziału");
    const modified = matrix.map((b) => (b.minAgeDays === 0 ? { ...b, targetNapsCount: 6 } : b));
    const resolved = resolveSleepMatrix(modified);
    expect(resolved[0]?.minAgeDays).toBe(0);
    expect(resolved[0]?.targetNapsCount).toBe(6);
  });

  it("odrzuca matrycę z dziurą w zakresach wieku", () => {
    const matrix = cloneDefault();
    matrix[1] = patchBracket(matrix, 1, { minAgeDays: 40 });
    const result = validateSleepMatrix(matrix);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("nie są ciągłe");
  });

  it("odrzuca przedziały z odwróconymi oknami czuwania", () => {
    const matrix = cloneDefault();
    matrix[0] = patchBracket(matrix, 0, { wwMinMorning: 90, wwMaxEvening: 60 });
    expect(validateSleepMatrix(matrix).ok).toBe(false);
  });

  it("odrzuca matrycę niezaczynającą się od dnia 0 lub niekończącą się na 1095", () => {
    expect(validateSleepMatrix(cloneDefault().slice(1)).ok).toBe(false);
    expect(validateSleepMatrix(cloneDefault().slice(0, -1)).ok).toBe(false);
  });

  it("odrzuca wartości niedodatnie i śmieci", () => {
    const matrix = cloneDefault();
    matrix[2] = patchBracket(matrix, 2, { medianTotalSleepMin: 0 });
    expect(validateSleepMatrix(matrix).ok).toBe(false);
    expect(validateSleepMatrix("abc").ok).toBe(false);
    expect(validateSleepMatrix([]).ok).toBe(false);
  });

  it("resolveSleepMatrix wraca do domyślnej przy braku lub błędzie nadpisania", () => {
    expect(resolveSleepMatrix(undefined)).toBe(DEFAULT_SLEEP_MATRIX);
    expect(resolveSleepMatrix(null)).toBe(DEFAULT_SLEEP_MATRIX);
    expect(resolveSleepMatrix([{ minAgeDays: 5 }])).toBe(DEFAULT_SLEEP_MATRIX);
  });
});
