import { describe, expect, it } from "vitest";
import {
  computeRms,
  createWakeDetector,
  stepWakeDetector,
  WAKE_SENSITIVITY_PRESETS,
  type WakeDetectorState,
} from "../wake-detector";

const CONFIG = WAKE_SENSITIVITY_PRESETS.medium;
const TICK_MS = 250;

/** Podaje stały poziom przez `durationMs` i zwraca stan oraz czasy wykrytych pobudek. */
function feed(
  state: WakeDetectorState,
  fromMs: number,
  durationMs: number,
  level: number,
): { state: WakeDetectorState; triggers: number[]; endMs: number } {
  let current = state;
  const triggers: number[] = [];
  let atMs = fromMs;
  for (; atMs < fromMs + durationMs; atMs += TICK_MS) {
    const step = stepWakeDetector(current, level, atMs, CONFIG);
    current = step.state;
    if (step.triggered) triggers.push(atMs);
  }
  return { state: current, triggers, endMs: atMs };
}

describe("stepWakeDetector", () => {
  it("does not trigger on steady background noise such as white noise", () => {
    const quiet = feed(createWakeDetector(0), 0, 60000, 0.03);
    expect(quiet.triggers).toEqual([]);
  });

  it("triggers once crying lasts longer than the sustain time", () => {
    const calm = feed(createWakeDetector(0), 0, 10000, 0.005);
    const cry = feed(calm.state, calm.endMs, 8000, 0.2);
    expect(cry.triggers).toHaveLength(1);
    const firstTrigger = cry.triggers[0] ?? 0;
    expect(firstTrigger - calm.endMs).toBeGreaterThanOrEqual(CONFIG.sustainMs);
  });

  it("ignores a short bang or cough", () => {
    const calm = feed(createWakeDetector(0), 0, 10000, 0.005);
    const bang = feed(calm.state, calm.endMs, 1000, 0.5);
    const after = feed(bang.state, bang.endMs, 10000, 0.005);
    expect([...bang.triggers, ...after.triggers]).toEqual([]);
  });

  it("does not trigger during warm-up calibration", () => {
    const loudStart = feed(createWakeDetector(0), 0, CONFIG.warmupMs, 0.3);
    expect(loudStart.triggers).toEqual([]);
  });

  it("waits for the cooldown before reporting another waking", () => {
    const calm = feed(createWakeDetector(0), 0, 10000, 0.005);
    const cry = feed(calm.state, calm.endMs, 30000, 0.2);
    expect(cry.triggers).toHaveLength(1);
    const later = feed(cry.state, cry.endMs, CONFIG.cooldownMs, 0.2);
    expect(later.triggers).toHaveLength(1);
  });

  it("is more eager on high sensitivity than on low", () => {
    const run = (sensitivity: "low" | "high") => {
      let state = createWakeDetector(0);
      let triggeredAt: number | null = null;
      for (let atMs = 0; atMs < 30000 && triggeredAt === null; atMs += TICK_MS) {
        const level = atMs < 10000 ? 0.005 : 0.06;
        const step = stepWakeDetector(state, level, atMs, WAKE_SENSITIVITY_PRESETS[sensitivity]);
        state = step.state;
        if (step.triggered) triggeredAt = atMs;
      }
      return triggeredAt;
    };
    expect(run("high")).not.toBeNull();
    expect(run("low")).not.toBeNull();
    expect(run("high") ?? 0).toBeLessThan(run("low") ?? 0);
  });
});

describe("computeRms", () => {
  it("returns 0 for silence and the amplitude for a square wave", () => {
    expect(computeRms(new Float32Array(128))).toBe(0);
    expect(computeRms([0.5, -0.5, 0.5, -0.5])).toBeCloseTo(0.5);
  });
});
