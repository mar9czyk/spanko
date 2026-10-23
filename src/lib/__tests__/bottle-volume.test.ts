import { describe, expect, it } from "vitest";
import {
  clampBottleMl,
  MAX_BOTTLE_ML,
  MIN_BOTTLE_ML,
  parseBottleInput,
  stepBottleMl,
  toDisplayAmount,
} from "../bottle-volume";

describe("stepBottleMl", () => {
  it("metric: krok 10 ml", () => {
    expect(stepBottleMl(120, "metric", 1)).toBe(130);
    expect(stepBottleMl(120, "metric", -1)).toBe(110);
  });

  it("metric: wyrównuje do pełnych dziesiątek", () => {
    expect(stepBottleMl(125, "metric", -1)).toBe(120);
  });

  it("imperial: krok 0,5 oz", () => {
    expect(toDisplayAmount(stepBottleMl(118, "imperial", 1), "imperial")).toBe(4.5);
    expect(toDisplayAmount(stepBottleMl(118, "imperial", -1), "imperial")).toBe(3.5);
  });

  it("nie wychodzi poza zakres", () => {
    expect(stepBottleMl(MIN_BOTTLE_ML, "metric", -1)).toBe(MIN_BOTTLE_ML);
    expect(stepBottleMl(MAX_BOTTLE_ML, "metric", 1)).toBe(MAX_BOTTLE_ML);
  });
});

describe("parseBottleInput", () => {
  it("parsuje ml i przecinek", () => {
    expect(parseBottleInput("135", "metric")).toBe(135);
    expect(parseBottleInput("97,6", "metric")).toBe(98);
  });

  it("parsuje oz do ml", () => {
    expect(parseBottleInput("4", "imperial")).toBe(118);
  });

  it("odrzuca puste i błędne wpisy", () => {
    expect(parseBottleInput("", "metric")).toBeNull();
    expect(parseBottleInput("abc", "metric")).toBeNull();
    expect(parseBottleInput("-5", "metric")).toBeNull();
  });

  it("przycina do zakresu", () => {
    expect(parseBottleInput("9000", "metric")).toBe(MAX_BOTTLE_ML);
    expect(clampBottleMl(1)).toBe(MIN_BOTTLE_ML);
  });
});
