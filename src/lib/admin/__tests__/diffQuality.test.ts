import { describe, expect, it } from "vitest";
import { diffLines } from "../diff";
import { computeAiQuality, type QualityInput } from "../quality";

describe("diffLines", () => {
  it("zwraca same dla identycznych tekstów", () => {
    expect(diffLines("a\nb", "a\nb")).toEqual([
      { type: "same", text: "a" },
      { type: "same", text: "b" },
    ]);
  });

  it("wykrywa dodane, usunięte i niezmienione linie w kolejności", () => {
    const ops = diffLines(
      "Linia 1\nLinia 2\nLinia 3",
      "Linia 1\nLinia 2 zmieniona\nLinia 3\nLinia 4",
    );
    expect(ops).toEqual([
      { type: "same", text: "Linia 1" },
      { type: "del", text: "Linia 2" },
      { type: "add", text: "Linia 2 zmieniona" },
      { type: "same", text: "Linia 3" },
      { type: "add", text: "Linia 4" },
    ]);
  });

  it("obsługuje pusty tekst po jednej ze stron", () => {
    expect(diffLines("", "x").map((op) => op.type)).toEqual(["del", "add"]);
    expect(diffLines("x", "")).toEqual([
      { type: "del", text: "x" },
      { type: "add", text: "" },
    ]);
  });
});

describe("computeAiQuality", () => {
  const rows: QualityInput[] = [
    { category: "CAT1", promptVersion: 1, feedback: "accepted" },
    { category: "CAT1", promptVersion: 1, feedback: "adjusted" },
    { category: "CAT1", promptVersion: 2, feedback: "accepted" },
    { category: "CAT1", promptVersion: 2, feedback: "pending" },
    { category: "CAT2", promptVersion: 2, feedback: "rejected" },
    { category: "CAT2", promptVersion: 0, insightStatus: "corrected_by_parent" },
    { category: "", promptVersion: 0 },
  ];

  it("liczy accepted/corrected/pending i odsetek akceptacji per kategoria", () => {
    const { byCategory } = computeAiQuality(rows);
    const cat1 = byCategory.find((row) => row.key === "CAT1");
    expect(cat1).toMatchObject({ total: 4, accepted: 2, corrected: 1, pending: 1 });
    expect(cat1?.acceptanceRate).toBeCloseTo(2 / 3, 5);
    const cat2 = byCategory.find((row) => row.key === "CAT2");
    expect(cat2).toMatchObject({ corrected: 2, accepted: 0, acceptanceRate: 0 });
  });

  it("zwraca acceptanceRate null, gdy nikt nie ocenił, i grupuje puste kategorie", () => {
    const { byCategory } = computeAiQuality(rows);
    expect(byCategory.find((row) => row.key === "—")?.acceptanceRate).toBeNull();
  });

  it("grupuje po wersji promptu, a wersję 0 opisuje jako brak wersji", () => {
    const { byPromptVersion } = computeAiQuality(rows);
    expect(byPromptVersion.map((row) => row.key).sort()).toEqual(["bez wersji", "v1", "v2"]);
    expect(byPromptVersion.find((row) => row.key === "v1")?.acceptanceRate).toBeCloseTo(0.5, 5);
  });

  it("sortuje malejąco wg liczby wniosków", () => {
    const { byCategory } = computeAiQuality(rows);
    expect(byCategory[0]?.key).toBe("CAT1");
  });
});
