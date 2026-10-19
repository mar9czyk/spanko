import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { ApiAuthError, authenticateRequest, getServiceClient } from "@/lib/server/auth";
import {
  type PushSubscriptionRecord,
  readVapidConfig,
  selectWakeAlertRecipients,
  sendWakeAlert,
} from "@/lib/server/push";
import type { ChildRecord } from "@/lib/types/database";

const WakeAlertBodySchema = z.object({
  childId: z.string().min(1),
  /** Subskrypcja telefonu, który nasłuchuje — on sam alertu nie dostaje. */
  senderEndpoint: z.string().max(1000).optional(),
});

/** Najkrótszy odstęp między alertami jednego gospodarstwa (ochrona przed zalewem powiadomień). */
const MIN_ALERT_INTERVAL_MS = 30_000;
const lastAlertAtByHousehold = new Map<string, number>();

/**
 * POST /api/push/wake-alert — telefon przy dziecku zgłasza możliwą pobudkę;
 * powiadomienie push idzie do pozostałych urządzeń gospodarstwa.
 *
 * @returns {Promise<NextResponse>} `sent` — liczba urządzeń, do których wysłano alert
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { pb, user } = await authenticateRequest(request);
    const { childId, senderEndpoint } = await parseJsonBody(request, WakeAlertBodySchema);

    let child: ChildRecord;
    try {
      // Reguły kolekcji children ograniczają odczyt do własnego gospodarstwa.
      child = await pb.collection("children").getOne<ChildRecord>(childId);
    } catch {
      throw new ApiAuthError("Nie znaleziono dziecka.", 404);
    }

    const service = await getServiceClient();
    if (!service || !readVapidConfig()) {
      return NextResponse.json({ success: true, sent: 0, configured: false });
    }

    const nowMs = Date.now();
    const lastAt = lastAlertAtByHousehold.get(user.household_id) ?? 0;
    if (nowMs - lastAt < MIN_ALERT_INTERVAL_MS) {
      return NextResponse.json({ success: true, sent: 0, configured: true, throttled: true });
    }
    const subscriptions = await service
      .collection("push_subscriptions")
      .getFullList<PushSubscriptionRecord>({
        filter: service.filter("household_id = {:household}", { household: user.household_id }),
      });
    const recipients = selectWakeAlertRecipients(subscriptions, senderEndpoint);
    const sent = await sendWakeAlert(service, recipients, child.name);
    if (sent > 0) lastAlertAtByHousehold.set(user.household_id, nowMs);
    return NextResponse.json({ success: true, sent, configured: true });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się wysłać powiadomienia.");
  }
}
