import { describe, expect, it } from "vitest";
import {
  type CalibrationInput,
  MAX_PREDICTION_GAP_MINUTES,
  median,
  replayPredictionForLog,
  resolveAgeBucket,
  summarizeCalibration,
} from "@/lib/admin/calibration";
import { computeFeedbackByDiagnosis } from "@/lib/admin/quality";
import type { ChildInsightRecord, ChildRecord, SleepLogRecord } from "@/lib/types/database";

const child: ChildRecord = {
  id: "child1",
  household_id: "h1",
  name: "Test",
  birth_date: "2026-01-15T00:00:00.000Z",
  active_day_mode: "home",
  anti_orthosomnia_mode: false,
  timezone: "UTC",
  created: "2026-01-15T00:00:00.000Z",
  updated: "2026-01-15T00:00:00.000Z",
};

/**
 * Buduje zakończony log snu.
 *
 * @param {Partial<SleepLogRecord>} patch - Pola do nadpisania
 * @returns {SleepLogRecord} Log
 */
function log(patch: Partial<SleepLogRecord> & Pick<SleepLogRecord, "id">): SleepLogRecord {
  return {
    child_id: child.id,
    physiological_date: "2026-10-10",
    type: "nap",
    status: "completed",
    is_rebound_sleep: false,
    ignore_in_calibration: false,
    created: patch.put_down_at ?? "2026-10-10T00:00:00.000Z",
    updated: patch.put_down_at ?? "2026-10-10T00:00:00.000Z",
    ...patch,
  };
}

const night = log({
  id: "night",
  type: "night",
  physiological_date: "2026-10-09",
  put_down_at: "2026-10-09T19:00:00.000Z",
  fell_asleep_at: "2026-10-09T19:10:00.000Z",
  woke_up_at: "2026-10-10T07:00:00.000Z",
});
const nap = log({
  id: "nap1",
  put_down_at: "2026-10-10T09:50:00.000Z",
  fell_asleep_at: "2026-10-10T10:05:00.000Z",
  woke_up_at: "2026-10-10T11:15:00.000Z",
});

describe("replayPredictionForLog", () => {
  it("liczy błąd odłożenia i zaśnięcia, latencję i długość snu względem prognozy", () => {
    const outcome = replayPredictionForLog({
      child,
      logs: [night, nap],
      insights: [],
      target: nap,
    });
    expect(outcome).not.toBeNull();
    if (!outcome) return;
    // 268 dni: okno poranne 155 min − 15 min za dług (jedna krótka doba w historii) = SweetSpot 09:20
    expect(outcome.predictedSweetSpotAt).toBe("2026-10-10T09:20:00.000Z");
    expect(outcome.putDownErrorMin).toBe(30);
    expect(outcome.fellAsleepErrorMin).toBe(45);
    expect(outcome.latencyMin).toBe(15);
    expect(outcome.durationMin).toBe(70);
    expect(outcome.withinCompassWindow).toBe(false);
  });

  it("uwzględnia przesunięcie z wniosku obowiązującego w chwili odłożenia", () => {
    const insight: ChildInsightRecord = {
      id: "i1",
      child_id: child.id,
      category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
      diagnosis_code: "OVERTIRED_CORTISOL_SPIKE",
      status: "active",
      title: "",
      explanation: "",
      algorithm_override_json: { wakeWindowOffsetMinutes: -20 },
      created: "2026-10-09T12:00:00.000Z",
      updated: "2026-10-09T12:00:00.000Z",
    };
    const later: ChildInsightRecord = { ...insight, id: "i2", created: "2026-10-10T12:00:00.000Z" };
    const outcome = replayPredictionForLog({
      child,
      logs: [night, nap],
      insights: [insight, { ...later, algorithm_override_json: { wakeWindowOffsetMinutes: 30 } }],
      target: nap,
    });
    expect(outcome?.insightWwOffsetMin).toBe(-20);
    expect(outcome?.predictedSweetSpotAt).toBe("2026-10-10T09:00:00.000Z");
  });

  it("pomija sen bez wcześniejszej pobudki, z luką w danych lub oznaczony do pominięcia", () => {
    expect(replayPredictionForLog({ child, logs: [nap], insights: [], target: nap })).toBeNull();
    const farNap = log({
      id: "far",
      put_down_at: new Date(
        Date.parse(night.woke_up_at as string) + (MAX_PREDICTION_GAP_MINUTES + 1) * 60_000,
      ).toISOString(),
      fell_asleep_at: "2026-10-10T15:10:00.000Z",
      woke_up_at: "2026-10-10T16:00:00.000Z",
    });
    expect(
      replayPredictionForLog({ child, logs: [night, farNap], insights: [], target: farNap }),
    ).toBeNull();
    const ignored = { ...nap, ignore_in_calibration: true };
    expect(
      replayPredictionForLog({ child, logs: [night, ignored], insights: [], target: ignored }),
    ).toBeNull();
  });
});

describe("summarizeCalibration", () => {
  const row = (patch: Partial<CalibrationInput>): CalibrationInput => ({
    type: "nap",
    effective_age_days: 200,
    put_down_error_min: 0,
    fell_asleep_error_min: 0,
    latency_min: 10,
    duration_min: 60,
    within_compass: true,
    ...patch,
  });

  it("grupuje po wieku i typie, liczy medianę błędu, bias i odsetek długiej latencji", () => {
    const rows = summarizeCalibration([
      row({ put_down_error_min: -30, within_compass: false }),
      row({ put_down_error_min: 10 }),
      row({ put_down_error_min: 20, latency_min: 25 }),
      row({ type: "night", effective_age_days: 30 }),
    ]);
    expect(rows.map((r) => `${r.ageBucket} ${r.type}`)).toEqual([
      "0–3 mies. night",
      "6–9 mies. nap",
    ]);
    const naps = rows[1];
    expect(naps?.count).toBe(3);
    expect(naps?.medianAbsErrorMin).toBe(20);
    expect(naps?.medianBiasMin).toBe(10);
    expect(naps?.withinCompassRate).toBeCloseTo(2 / 3);
    expect(naps?.longLatencyRate).toBeCloseTo(1 / 3);
  });

  it("median i przedziały wieku", () => {
    expect(median([])).toBe(0);
    expect(median([5, 1, 3, 9])).toBe(4);
    expect(resolveAgeBucket(0)).toBe("0–3 mies.");
    expect(resolveAgeBucket(365)).toBe("12–18 mies.");
    expect(resolveAgeBucket(900)).toBe("18+ mies.");
  });
});

describe("computeFeedbackByDiagnosis", () => {
  it("liczy odrzucenia per kod diagnozy (rejected, adjusted i korekta rodzica)", () => {
    const [row] = computeFeedbackByDiagnosis([
      { diagnosisCode: "EARLY", feedback: "accepted" },
      { diagnosisCode: "EARLY", feedback: "rejected" },
      { diagnosisCode: "EARLY", feedback: "pending", insightStatus: "corrected_by_parent" },
      { diagnosisCode: "EARLY", feedback: "pending" },
    ]);
    expect(row).toMatchObject({ key: "EARLY", total: 4, accepted: 1, corrected: 2, pending: 1 });
    expect(row?.acceptanceRate).toBeCloseTo(1 / 3);
  });
});
