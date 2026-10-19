/**
 * Lokalny detektor pobudki z poziomu głośności mikrofonu.
 *
 * @description
 * Działa wyłącznie na liczbach (poziom RMS 0–1), bez nagrywania dźwięku. Śledzi poziom tła
 * (szum biały, wentylator) i zgłasza pobudkę, gdy dźwięk wyraźnie głośniejszy od tła trwa
 * łącznie dłużej niż `sustainMs` w oknie `windowMs`. Pojedyncze trzaski i kaszlnięcia
 * są ignorowane. Po zgłoszeniu detektor czeka `cooldownMs`, zanim zgłosi kolejną pobudkę.
 */

export type WakeSensitivity = "low" | "medium" | "high";

export interface WakeDetectorConfig {
  /** Ile razy głośniej od tła musi być, żeby próbka liczyła się jako hałas. */
  readonly ratio: number;
  /** Minimalny bezwzględny poziom RMS hałasu (chroni przed alarmem w całkowitej ciszy). */
  readonly minLevel: number;
  /** Łączny czas hałasu w oknie potrzebny do zgłoszenia pobudki. */
  readonly sustainMs: number;
  /** Okno, w którym sumujemy czas hałasu. */
  readonly windowMs: number;
  /** Przerwa po zgłoszeniu, zanim detektor zgłosi kolejną pobudkę. */
  readonly cooldownMs: number;
  /** Czas kalibracji tła po starcie, bez zgłoszeń. */
  readonly warmupMs: number;
}

export const WAKE_SENSITIVITY_PRESETS: Record<WakeSensitivity, WakeDetectorConfig> = {
  low: {
    ratio: 4,
    minLevel: 0.04,
    sustainMs: 6000,
    windowMs: 12000,
    cooldownMs: 120000,
    warmupMs: 3000,
  },
  medium: {
    ratio: 3,
    minLevel: 0.025,
    sustainMs: 4000,
    windowMs: 10000,
    cooldownMs: 90000,
    warmupMs: 3000,
  },
  high: {
    ratio: 2.2,
    minLevel: 0.015,
    sustainMs: 2500,
    windowMs: 8000,
    cooldownMs: 60000,
    warmupMs: 3000,
  },
};

interface Sample {
  readonly atMs: number;
  readonly loud: boolean;
}

export interface WakeDetectorState {
  readonly startedAtMs: number;
  /** Poziom tła (średnia krocząca cichych próbek). */
  readonly noiseFloor: number;
  readonly samples: readonly Sample[];
  readonly lastTriggerAtMs: number | null;
}

export interface WakeDetectorStep {
  readonly state: WakeDetectorState;
  readonly triggered: boolean;
  /** Łączny czas hałasu w bieżącym oknie (ms) — do podglądu w UI. */
  readonly loudMs: number;
}

/** Wolna adaptacja tła: tło nie „ucieka” w górę podczas płaczu. */
const FLOOR_ADAPT = 0.02;
const FLOOR_MIN = 0.002;

export function createWakeDetector(nowMs: number): WakeDetectorState {
  return { startedAtMs: nowMs, noiseFloor: FLOOR_MIN, samples: [], lastTriggerAtMs: null };
}

/**
 * Zwraca łączny czas (ms) próbek głośnych w oknie, licząc każdą próbkę do następnej.
 */
function sumLoudMs(samples: readonly Sample[], nowMs: number): number {
  let total = 0;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (!sample?.loud) continue;
    const nextAt = samples[i + 1]?.atMs ?? nowMs;
    total += nextAt - sample.atMs;
  }
  return total;
}

/**
 * Przetwarza jedną próbkę poziomu głośności.
 *
 * @param state - Bieżący stan detektora
 * @param level - Poziom RMS próbki (0–1)
 * @param nowMs - Czas próbki w ms
 * @param config - Próg czułości
 * @returns Nowy stan i informacja, czy właśnie wykryto pobudkę
 */
export function stepWakeDetector(
  state: WakeDetectorState,
  level: number,
  nowMs: number,
  config: WakeDetectorConfig,
): WakeDetectorStep {
  const inWarmup = nowMs - state.startedAtMs < config.warmupMs;
  const threshold = Math.max(config.minLevel, state.noiseFloor * config.ratio);
  const loud = !inWarmup && level >= threshold;

  // W kalibracji tło dopasowuje się szybko, potem tylko do cichych próbek i powoli.
  const adapt = inWarmup ? 0.3 : FLOOR_ADAPT;
  const noiseFloor = loud
    ? state.noiseFloor
    : Math.max(FLOOR_MIN, state.noiseFloor + (level - state.noiseFloor) * adapt);

  const samples = [...state.samples, { atMs: nowMs, loud }].filter(
    (sample) => nowMs - sample.atMs <= config.windowMs,
  );
  const loudMs = sumLoudMs(samples, nowMs);

  const inCooldown =
    state.lastTriggerAtMs !== null && nowMs - state.lastTriggerAtMs < config.cooldownMs;
  const triggered = !inCooldown && loudMs >= config.sustainMs;

  return {
    state: {
      startedAtMs: state.startedAtMs,
      noiseFloor,
      samples: triggered ? [] : samples,
      lastTriggerAtMs: triggered ? nowMs : state.lastTriggerAtMs,
    },
    triggered,
    loudMs,
  };
}

/**
 * Liczy poziom RMS z próbek sygnału w zakresie -1..1 (np. z `AnalyserNode.getFloatTimeDomainData`).
 */
export function computeRms(buffer: ArrayLike<number>): number {
  if (buffer.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const value = buffer[i] ?? 0;
    sum += value * value;
  }
  return Math.sqrt(sum / buffer.length);
}
