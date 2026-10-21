import { describe, expect, it } from "vitest";
import { findUnsafeAdvice, SAFE_SLEEP_GUIDELINES } from "../safe-sleep";

const OLDER = 270;
const YOUNG = 70;

describe("findUnsafeAdvice", () => {
  it.each([
    ["Weź malucha do łóżka rodziców na resztę nocy.", "BED_SHARING"],
    ["Wspólne spanie pomoże wam przetrwać ząbkowanie.", "BED_SHARING"],
    ["Try bed-sharing for a few nights.", "BED_SHARING"],
    ["Połóż dziecko na brzuchu, jeśli lepiej śpi.", "PRONE_OR_INCLINED"],
    ["Podłóż klin pod materac przy katarze.", "PRONE_OR_INCLINED"],
    ["Use an inclined sleeper for reflux.", "PRONE_OR_INCLINED"],
    ["Dodaj małą poduszkę do łóżeczka.", "PILLOWS"],
  ])("odrzuca: %s", (text, rule) => {
    expect(findUnsafeAdvice([text], OLDER)).toBe(rule);
  });

  it("przepuszcza zwykłe rady o łóżeczku, porze snu i kliniczne słownictwo", () => {
    expect(
      findUnsafeAdvice(
        [
          "Odłóż dziecko do łóżeczka senne, ale nie śpiące.",
          "Move your bedtime routine 15 minutes earlier.",
          "To wzorzec kliniczny, który często mija sam.",
          undefined,
        ],
        OLDER,
      ),
    ).toBeNull();
  });

  it("trening snu jest zakazany tylko przed 16. tygodniem", () => {
    const text = "Możesz zacząć trening snu metodą Ferbera.";
    expect(findUnsafeAdvice([text], YOUNG)).toBe("EARLY_SLEEP_TRAINING");
    expect(findUnsafeAdvice([text], OLDER)).toBeNull();
  });

  it("blok zaleceń ma tyle samo punktów PL i EN, zaczyna od spania na plecach", () => {
    expect(SAFE_SLEEP_GUIDELINES.pl).toHaveLength(SAFE_SLEEP_GUIDELINES.en.length);
    expect(SAFE_SLEEP_GUIDELINES.pl[0]).toContain("na plecach");
  });
});
