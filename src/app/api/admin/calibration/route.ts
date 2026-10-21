import { NextResponse } from "next/server";
import type PocketBase from "pocketbase";
import {
  replayPredictionsForChild,
  summarizeCalibration,
  toSleepPredictionDraft,
  windowStartIso,
} from "@/lib/admin/calibration";
import { computeFeedbackByDiagnosis } from "@/lib/admin/quality";
import {
  CalibrationQuerySchema,
  CalibrationRecomputeSchema,
} from "@/lib/server/adminSchemasSupport";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiAuthError, requireAdmin, requireServiceClient } from "@/lib/server/auth";
import { DIAGNOSTIC_WINDOW_DAYS } from "@/lib/sleep-engine";
import type {
  ChildInsightRecord,
  ChildRecord,
  SleepLogRecord,
  SleepPredictionRecord,
} from "@/lib/types/database";

/** Zapisy do PocketBase wysyłamy partiami, żeby nie zalać bazy setkami równoległych żądań. */
const WRITE_CHUNK_SIZE = 10;

/**
 * GET /api/admin/calibration — trafność prognoz SweetSpot i odrzucenia wniosków per diagnoza.
 *
 * @param {Request} request - Żądanie HTTP (query: days — okno raportu w dobach)
 * @returns {Promise<NextResponse>} Raport kalibracji
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const query = CalibrationQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!query.success) {
      throw new ApiAuthError("Niepoprawne parametry zapytania.", 400);
    }
    const service = await requireServiceClient();
    const from = new Date(windowStartIso(new Date().toISOString(), query.data.days));

    const [predictions, insights] = await Promise.all([
      service.collection("sleep_predictions").getFullList<SleepPredictionRecord>({
        filter: service.filter("actual_put_down_at >= {:from}", { from }),
        fields:
          "type,effective_age_days,put_down_error_min,fell_asleep_error_min,latency_min,duration_min,within_compass,created",
      }),
      service.collection("child_insights").getFullList<ChildInsightRecord>({
        filter: service.filter("created >= {:from}", { from }),
        fields: "diagnosis_code,parent_feedback,status",
      }),
    ]);

    return NextResponse.json({
      success: true,
      days: query.data.days,
      measured: predictions.length,
      lastComputedAt: predictions.reduce(
        (latest, p) => (p.created > latest ? p.created : latest),
        "",
      ),
      rows: summarizeCalibration(predictions),
      feedback: computeFeedbackByDiagnosis(
        insights.map((insight) => ({
          diagnosisCode: insight.diagnosis_code,
          feedback: insight.parent_feedback,
          insightStatus: insight.status,
        })),
      ),
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać raportu trafności prognoz.");
  }
}

/**
 * Odtwarza prognozy jednego dziecka i zapisuje brakujące (lub wszystkie przy `overwrite`).
 *
 * @param {PocketBase} service - Klient serwisowy
 * @param {ChildRecord} child - Dziecko
 * @param {string} fromIso - Początek okna pomiaru
 * @param {boolean} overwrite - Czy nadpisywać istniejące pomiary
 * @returns {Promise<{ created: number; updated: number; skipped: number }>} Liczniki
 */
async function recomputeChild(
  service: PocketBase,
  child: ChildRecord,
  fromIso: string,
  overwrite: boolean,
): Promise<{ created: number; updated: number; skipped: number }> {
  // Dług snu i kotwica potrzebują dób sprzed okna pomiaru
  const historyFrom = new Date(windowStartIso(fromIso, DIAGNOSTIC_WINDOW_DAYS));
  const [logs, insights, existing] = await Promise.all([
    service.collection("sleep_logs").getFullList<SleepLogRecord>({
      filter: service.filter("child_id = {:childId} && put_down_at >= {:from}", {
        childId: child.id,
        from: historyFrom,
      }),
    }),
    service.collection("child_insights").getFullList<ChildInsightRecord>({
      filter: service.filter("child_id = {:childId}", { childId: child.id }),
      fields: "id,status,algorithm_override_json,created",
    }),
    service.collection("sleep_predictions").getFullList<SleepPredictionRecord>({
      filter: service.filter("child_id = {:childId} && actual_put_down_at >= {:from}", {
        childId: child.id,
        from: new Date(fromIso),
      }),
      fields: "id,sleep_log_id",
    }),
  ]);

  const existingByLog = new Map(existing.map((p) => [p.sleep_log_id, p.id]));
  const outcomes = replayPredictionsForChild({ child, logs, insights, fromIso });
  const counts = { created: 0, updated: 0, skipped: 0 };

  for (let index = 0; index < outcomes.length; index += WRITE_CHUNK_SIZE) {
    const chunk = outcomes.slice(index, index + WRITE_CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (outcome) => {
        const draft = toSleepPredictionDraft(outcome, "replay");
        const existingId = existingByLog.get(outcome.sleepLogId);
        if (existingId && !overwrite) {
          counts.skipped++;
        } else if (existingId) {
          await service.collection("sleep_predictions").update(existingId, draft);
          counts.updated++;
        } else {
          await service.collection("sleep_predictions").create(draft);
          counts.created++;
        }
      }),
    );
  }
  return counts;
}

/**
 * POST /api/admin/calibration — odtwarza prognozy SweetSpot z logów snu i zapisuje błąd prognozy.
 *
 * @description
 * Dla każdego zakończonego snu z okna liczy prognozę tak, jak pulpit w chwili odłożenia,
 * i zapisuje ją w `sleep_predictions` razem z faktycznym odłożeniem, zaśnięciem, latencją
 * i długością snu. Bez `overwrite` istniejące pomiary zostają (zamrożony stan silnika z dnia
 * pomiaru); z `overwrite` przelicza je obecnym silnikiem.
 *
 * @param {Request} request - Żądanie HTTP (`days`, `overwrite`)
 * @returns {Promise<NextResponse>} Liczniki zapisów
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { user } = await requireAdmin(request);
    const body = await parseJsonBody(request, CalibrationRecomputeSchema);
    const service = await requireServiceClient();
    const fromIso = windowStartIso(new Date().toISOString(), body.days);

    const children = await service.collection("children").getFullList<ChildRecord>();
    const totals = { created: 0, updated: 0, skipped: 0 };
    for (const child of children) {
      const counts = await recomputeChild(service, child, fromIso, body.overwrite);
      totals.created += counts.created;
      totals.updated += counts.updated;
      totals.skipped += counts.skipped;
    }

    await writeAuditLog({
      actor: user,
      action: "calibration.recompute",
      targetCollection: "sleep_predictions",
      after: { days: body.days, overwrite: body.overwrite, ...totals },
    });

    return NextResponse.json({ success: true, children: children.length, ...totals });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się przeliczyć trafności prognoz.");
  }
}
