import {
  calculateChronicDrive,
  calculateCircadianParameters,
  calculateEffectiveAgeDays,
  DEFAULT_SLEEP_MATRIX,
  DEFAULT_TIME_ZONE,
  getAgeBracket,
  getMinutesFromMidnightInTimeZone,
  MILLISECONDS_PER_DAY,
  MILLISECONDS_PER_MINUTE,
  predictNextSleepSlot,
  resolveInsightWwOffset,
} from "@/lib/sleep-engine";
import type { AgeBracketConfig, SleepType } from "@/lib/sleep-engine/types";
import { aggregateDailySleepSummaries, calculateDurationInMinutes } from "@/lib/sleep-summary";
import type {
  ChildInsightRecord,
  ChildRecord,
  SleepLogRecord,
  SleepPredictionRecord,
} from "@/lib/types/database";

/** Liczba porannych pobudek dla kotwicy okołodobowej — tak samo jak na pulpicie. */
const MORNING_WAKE_SAMPLE_SIZE = 5;

/**
 * Najdłuższa przerwa od ostatniej pobudki, przy której prognoza ma sens.
 * Heurystyka Spanko: dłuższa przerwa to prawie zawsze brakujący wpis, a nie realne okno czuwania.
 */
export const MAX_PREDICTION_GAP_MINUTES = 480;

/**
 * Latencja zasypiania uznawana za długą (spec v2.0, CAT2: przemęczenie przy latencji >20 min).
 */
export const LONG_LATENCY_THRESHOLD_MINUTES = 20;

/** Statusy wniosku, które na pulpicie zmieniają prognozę (plus `superseded` — obowiązywał wcześniej). */
const PREDICTION_INSIGHT_STATUSES = new Set([
  "active",
  "validated",
  "corrected_by_parent",
  "superseded",
]);

/** Przedziały wieku do panelu kalibracji (niezależne od matrycy, żeby jej zmiana nie mieszała grup). */
export const CALIBRATION_AGE_BUCKETS = [
  { maxAgeDays: 91, label: "0–3 mies." },
  { maxAgeDays: 182, label: "3–6 mies." },
  { maxAgeDays: 273, label: "6–9 mies." },
  { maxAgeDays: 365, label: "9–12 mies." },
  { maxAgeDays: 548, label: "12–18 mies." },
  { maxAgeDays: Number.POSITIVE_INFINITY, label: "18+ mies." },
] as const;

/** Prognoza SweetSpot zestawiona z tym, co rodzic faktycznie zapisał. */
export interface PredictionOutcome {
  readonly childId: string;
  readonly sleepLogId: string;
  readonly type: SleepType;
  readonly physiologicalDate: string;
  readonly effectiveAgeDays: number;
  readonly predictedSweetSpotAt: string;
  readonly compassStartAt: string;
  readonly compassEndAt: string;
  readonly targetWakeWindowMin: number;
  readonly reasonCode: string;
  readonly insightWwOffsetMin: number;
  readonly actualPutDownAt: string;
  readonly actualFellAsleepAt: string;
  /** Odłożenie minus SweetSpot; dodatni = rodzic odłożył później, niż przewidział silnik. */
  readonly putDownErrorMin: number;
  /** Zaśnięcie minus SweetSpot. */
  readonly fellAsleepErrorMin: number;
  readonly latencyMin: number;
  readonly durationMin: number;
  readonly withinCompassWindow: boolean;
}

/** Wiersz kolekcji `sleep_predictions` (bez pól systemowych). */
export type SleepPredictionDraft = Omit<SleepPredictionRecord, "id" | "created" | "updated">;

export type PredictionSource = SleepPredictionDraft["source"];

const toMs = (iso: string | undefined): number => (iso ? new Date(iso).getTime() : Number.NaN);

/**
 * Sprawdza, czy log nadaje się do pomiaru: zakończony, z odłożeniem, zaśnięciem i pobudką w dobrej kolejności.
 *
 * @param {SleepLogRecord} log - Log snu
 * @returns {boolean} True, gdy da się policzyć błąd, latencję i długość snu
 */
function isMeasurable(log: SleepLogRecord): boolean {
  if (log.status !== "completed" || log.ignore_in_calibration) return false;
  const putDown = toMs(log.put_down_at);
  const asleep = toMs(log.fell_asleep_at);
  const woke = toMs(log.woke_up_at);
  return asleep >= putDown && woke > asleep;
}

/**
 * Wybiera wniosek, który obowiązywał na pulpicie w danej chwili (najnowszy utworzony wcześniej).
 *
 * @param {readonly ChildInsightRecord[]} insights - Wnioski dziecka
 * @param {number} atMs - Chwila prognozy
 * @returns {ChildInsightRecord | undefined} Wniosek albo brak
 */
function findInsightAt(
  insights: readonly ChildInsightRecord[],
  atMs: number,
): ChildInsightRecord | undefined {
  return insights
    .filter((i) => PREDICTION_INSIGHT_STATUSES.has(i.status) && toMs(i.created) <= atMs)
    .toSorted((a, b) => toMs(b.created) - toMs(a.created))[0];
}

/**
 * Odtwarza prognozę SweetSpot dla jednego snu z danymi, które pulpit miał w chwili odłożenia,
 * i zestawia ją z faktycznym odłożeniem, zaśnięciem i długością snu.
 *
 * @description
 * Odwzorowuje `useDashboardState`: ostatnia pobudka przed odłożeniem, liczba drzemek tej doby,
 * dług z dób poprzednich, kotwica z 5 ostatnich porannych pobudek i przesunięcie z wniosku.
 * Przybliżenia: tryb dnia przyjmujemy jako `home` (historii trybu nie zapisujemy), a logi
 * z `ignore_in_calibration` pomijamy.
 *
 * @param {object} params - Dziecko, jego logi (dowolna kolejność), wnioski, matryca i log docelowy
 * @returns {PredictionOutcome | null} Wynik albo null, gdy prognozy nie da się odtworzyć
 */
export function replayPredictionForLog(params: {
  readonly child: ChildRecord;
  readonly logs: readonly SleepLogRecord[];
  readonly insights: readonly ChildInsightRecord[];
  readonly target: SleepLogRecord;
  readonly matrix?: readonly AgeBracketConfig[];
}): PredictionOutcome | null {
  const { child, target } = params;
  if (!isMeasurable(target)) return null;
  const putDownIso = target.put_down_at as string;
  const putDownMs = toMs(putDownIso);
  const timeZone = child.timezone || DEFAULT_TIME_ZONE;

  const history = params.logs.filter(
    (l) => l.id !== target.id && l.status === "completed" && toMs(l.woke_up_at) <= putDownMs,
  );
  const lastWake = history.toSorted((a, b) => toMs(b.woke_up_at) - toMs(a.woke_up_at))[0];
  if (!lastWake?.woke_up_at) return null;
  if (
    (putDownMs - toMs(lastWake.woke_up_at)) / MILLISECONDS_PER_MINUTE >
    MAX_PREDICTION_GAP_MINUTES
  )
    return null;

  const effectiveAgeDays = calculateEffectiveAgeDays(child.birth_date, child.due_date, putDownIso);
  // Pulpit liczy na matrycy domyślnej (getAgeBracket bez nadpisania) — mierzymy to, co widział rodzic
  const bracket = getAgeBracket(effectiveAgeDays, params.matrix ?? DEFAULT_SLEEP_MATRIX);
  const chronicDrive = calculateChronicDrive(
    aggregateDailySleepSummaries(history).filter(
      (day) => day.physiologicalDate !== target.physiological_date,
    ),
    bracket,
  );
  const morningWakes = history
    .filter((l) => l.type === "night" && l.woke_up_at)
    .toSorted((a, b) => toMs(b.woke_up_at) - toMs(a.woke_up_at))
    .slice(0, MORNING_WAKE_SAMPLE_SIZE)
    .map((l) => getMinutesFromMidnightInTimeZone(l.woke_up_at as string, timeZone));
  const circadian = calculateCircadianParameters({
    morningWakeTimesLast5DaysMinutesFromMidnight: morningWakes,
    bracket,
  });
  const napIndexToday = history.filter(
    (l) => l.type === "nap" && l.physiological_date === target.physiological_date,
  ).length;
  const insightWwOffsetMin = resolveInsightWwOffset(findInsightAt(params.insights, putDownMs));

  const prediction = predictNextSleepSlot({
    lastWakeUpIso: lastWake.woke_up_at,
    previousNapDurationMin:
      lastWake.type === "nap"
        ? calculateDurationInMinutes(
            lastWake.fell_asleep_at || lastWake.put_down_at,
            lastWake.woke_up_at,
          )
        : null,
    napIndexToday,
    bracket,
    effectiveAgeDays,
    chronicSleepDebtMin: chronicDrive.chronicSleepDebtMin,
    dayMode: "home",
    biologicalBedtimeMinFromMidnight: circadian.biologicalBedtimeMinFromMidnight,
    insightWwOffsetMin,
    timeZone,
  });

  const sweetSpotMs = toMs(prediction.sweetSpotIso);
  const fellAsleepIso = target.fell_asleep_at as string;
  return {
    childId: child.id,
    sleepLogId: target.id,
    type: target.type,
    physiologicalDate: target.physiological_date,
    effectiveAgeDays,
    predictedSweetSpotAt: prediction.sweetSpotIso,
    compassStartAt: prediction.compassWindowStartIso,
    compassEndAt: prediction.compassWindowEndIso,
    targetWakeWindowMin: prediction.targetWakeWindowMin,
    reasonCode: prediction.reasonCode,
    insightWwOffsetMin,
    actualPutDownAt: putDownIso,
    actualFellAsleepAt: fellAsleepIso,
    putDownErrorMin: Math.round((putDownMs - sweetSpotMs) / MILLISECONDS_PER_MINUTE),
    fellAsleepErrorMin: Math.round((toMs(fellAsleepIso) - sweetSpotMs) / MILLISECONDS_PER_MINUTE),
    latencyMin: calculateDurationInMinutes(putDownIso, fellAsleepIso),
    durationMin: calculateDurationInMinutes(fellAsleepIso, target.woke_up_at),
    withinCompassWindow:
      putDownMs >= toMs(prediction.compassWindowStartIso) &&
      putDownMs <= toMs(prediction.compassWindowEndIso),
  };
}

/**
 * Odtwarza prognozy dla wszystkich mierzalnych snów dziecka odłożonych od `fromIso`.
 *
 * @param {object} params - Dziecko, logi (z historią sprzed okna dla długu), wnioski, początek okna
 * @returns {PredictionOutcome[]} Wyniki, najstarsze pierwsze
 */
export function replayPredictionsForChild(params: {
  readonly child: ChildRecord;
  readonly logs: readonly SleepLogRecord[];
  readonly insights: readonly ChildInsightRecord[];
  readonly fromIso: string;
  readonly matrix?: readonly AgeBracketConfig[];
}): PredictionOutcome[] {
  const fromMs = toMs(params.fromIso);
  return params.logs
    .filter((log) => toMs(log.put_down_at) >= fromMs)
    .toSorted((a, b) => toMs(a.put_down_at) - toMs(b.put_down_at))
    .map((target) => replayPredictionForLog({ ...params, target }))
    .filter((outcome): outcome is PredictionOutcome => outcome !== null);
}

/**
 * Zamienia wynik pomiaru na rekord kolekcji `sleep_predictions`.
 *
 * @param {PredictionOutcome} outcome - Wynik pomiaru
 * @param {PredictionSource} source - `replay` (odtworzone po fakcie) lub `live` (zapis z pulpitu)
 * @returns {SleepPredictionDraft} Rekord do zapisu
 */
export function toSleepPredictionDraft(
  outcome: PredictionOutcome,
  source: PredictionSource,
): SleepPredictionDraft {
  return {
    child_id: outcome.childId,
    sleep_log_id: outcome.sleepLogId,
    type: outcome.type,
    physiological_date: outcome.physiologicalDate,
    effective_age_days: outcome.effectiveAgeDays,
    predicted_sweet_spot_at: outcome.predictedSweetSpotAt,
    compass_start_at: outcome.compassStartAt,
    compass_end_at: outcome.compassEndAt,
    target_ww_min: outcome.targetWakeWindowMin,
    reason_code: outcome.reasonCode,
    insight_ww_offset_min: outcome.insightWwOffsetMin,
    actual_put_down_at: outcome.actualPutDownAt,
    actual_fell_asleep_at: outcome.actualFellAsleepAt,
    put_down_error_min: outcome.putDownErrorMin,
    fell_asleep_error_min: outcome.fellAsleepErrorMin,
    latency_min: outcome.latencyMin,
    duration_min: outcome.durationMin,
    within_compass: outcome.withinCompassWindow,
    source,
  };
}

/** Pola potrzebne do raportu (podzbiór `sleep_predictions`). */
export type CalibrationInput = Pick<
  SleepPredictionDraft,
  | "type"
  | "effective_age_days"
  | "put_down_error_min"
  | "fell_asleep_error_min"
  | "latency_min"
  | "duration_min"
  | "within_compass"
>;

export interface CalibrationRow {
  readonly ageBucket: string;
  readonly type: SleepType;
  readonly count: number;
  /** Mediana |odłożenie − SweetSpot| w minutach. */
  readonly medianAbsErrorMin: number;
  /** Mediana błędu ze znakiem: dodatnia = rodzice kładą później, niż przewiduje silnik. */
  readonly medianBiasMin: number;
  readonly withinCompassRate: number;
  readonly longLatencyRate: number;
  readonly medianLatencyMin: number;
  readonly medianDurationMin: number;
}

/**
 * Mediana liczb (0 dla pustej listy).
 *
 * @param {readonly number[]} values - Liczby
 * @returns {number} Mediana zaokrąglona do pełnych minut
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 1
      ? (sorted[mid] as number)
      : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
  return Math.round(value);
}

/**
 * Zwraca etykietę przedziału wieku do panelu kalibracji.
 *
 * @param {number} effectiveAgeDays - Wiek efektywny w dniach
 * @returns {string} Etykieta przedziału
 */
export function resolveAgeBucket(effectiveAgeDays: number): string {
  const bucket = CALIBRATION_AGE_BUCKETS.find((b) => effectiveAgeDays < b.maxAgeDays);
  return bucket?.label ?? "18+ mies.";
}

/**
 * Buduje raport trafności prognoz: per przedział wieku i typ snu.
 *
 * @param {readonly CalibrationInput[]} rows - Zapisane pomiary
 * @returns {CalibrationRow[]} Wiersze w kolejności wieku, drzemki przed nocami
 */
export function summarizeCalibration(rows: readonly CalibrationInput[]): CalibrationRow[] {
  const groups = new Map<string, CalibrationInput[]>();
  for (const row of rows) {
    const key = `${resolveAgeBucket(row.effective_age_days)}|${row.type}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const bucketOrder: readonly string[] = CALIBRATION_AGE_BUCKETS.map((b) => b.label);
  return [...groups.entries()]
    .map(([key, items]) => {
      const [ageBucket = "", type = "nap"] = key.split("|");
      const count = items.length;
      return {
        ageBucket,
        type: type as SleepType,
        count,
        medianAbsErrorMin: median(items.map((i) => Math.abs(i.put_down_error_min))),
        medianBiasMin: median(items.map((i) => i.put_down_error_min)),
        withinCompassRate: items.filter((i) => i.within_compass).length / count,
        longLatencyRate:
          items.filter((i) => i.latency_min > LONG_LATENCY_THRESHOLD_MINUTES).length / count,
        medianLatencyMin: median(items.map((i) => i.latency_min)),
        medianDurationMin: median(items.map((i) => i.duration_min)),
      };
    })
    .sort(
      (a, b) =>
        bucketOrder.indexOf(a.ageBucket) - bucketOrder.indexOf(b.ageBucket) ||
        a.type.localeCompare(b.type),
    );
}

/**
 * Początek okna raportu: `days` dób przed `nowIso`.
 *
 * @param {string} nowIso - Czas odniesienia
 * @param {number} days - Liczba dób
 * @returns {string} ISO początku okna
 */
export function windowStartIso(nowIso: string, days: number): string {
  return new Date(toMs(nowIso) - days * MILLISECONDS_PER_DAY).toISOString();
}
