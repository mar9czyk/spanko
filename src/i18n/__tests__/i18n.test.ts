import { describe, expect, it } from "vitest";
import { en, pl } from "../messages";
import {
  bottlePresets,
  dateLocaleTag,
  detectLocale,
  detectUnits,
  formatDuration,
  formatVolume,
  translate,
  translateDynamic,
} from "../translate";

const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "").sort();

describe("słowniki", () => {
  it("pl i en mają identyczny zestaw kluczy", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(pl).sort());
  });

  it("parametry {x} są takie same w obu językach", () => {
    for (const key of Object.keys(pl) as (keyof typeof pl)[]) {
      expect(placeholders(en[key]), key).toEqual(placeholders(pl[key]));
    }
  });

  it("żaden tekst angielski nie jest pusty", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim().length, key).toBeGreaterThan(0);
    }
  });
});

describe("translate", () => {
  it("podstawia parametry", () => {
    expect(translate("en", "timeline.chipWake", { time: "06:30" })).toBe("wake-up 06:30");
    expect(translate("pl", "timeline.chipWake", { time: "06:30" })).toBe("pobudka 06:30");
  });

  it("zostawia nieznany parametr bez zmian", () => {
    expect(translate("en", "timeline.chipWake")).toBe("wake-up {time}");
  });

  it("translateDynamic zwraca fallback dla nieznanego klucza (np. własny tag)", () => {
    expect(translateDynamic("en", "tag.teething", "x")).toBe("teething");
    expect(translateDynamic("en", "tag.mój_tag", "mój_tag")).toBe("mój_tag");
  });
});

describe("wykrywanie preferencji", () => {
  it("polskie ustawienia przeglądarki dają pl, reszta en", () => {
    expect(detectLocale("pl-PL")).toBe("pl");
    expect(detectLocale("de-DE")).toBe("en");
    expect(detectLocale(undefined)).toBe("en");
  });

  it("uncje domyślnie tylko dla en-US", () => {
    expect(detectUnits("en-US")).toBe("imperial");
    expect(detectUnits("en-GB")).toBe("metric");
    expect(detectUnits("pl-PL")).toBe("metric");
  });

  it("zwraca znaczniki dat BCP-47", () => {
    expect(dateLocaleTag("pl")).toBe("pl-PL");
    expect(dateLocaleTag("en")).toBe("en-US");
  });
});

describe("jednostki objętości", () => {
  it("formatuje ml i uncje (do 0,5 oz)", () => {
    expect(formatVolume(120, "metric")).toBe("120 ml");
    expect(formatVolume(120, "imperial")).toBe("4 oz");
    expect(formatVolume(90, "imperial")).toBe("3 oz");
  });

  it("presety w oz zapisują się w ml", () => {
    const presets = bottlePresets("imperial");
    expect(presets.map((p) => p.label)).toEqual(["2 oz", "3 oz", "4 oz", "5 oz", "6 oz"]);
    expect(presets[2]?.ml).toBe(118);
    expect(bottlePresets("metric").map((p) => p.ml)).toEqual([60, 90, 120, 150, 180]);
  });
});

describe("formatDuration", () => {
  it("poniżej godziny pokazuje same minuty", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(45)).toBe("45 min");
  });

  it("powyżej godziny pokazuje godziny i minuty", () => {
    expect(formatDuration(110)).toBe("1h 50 min");
    expect(formatDuration(725)).toBe("12h 5 min");
  });

  it("pełne godziny bez minut", () => {
    expect(formatDuration(120)).toBe("2h");
  });
});
