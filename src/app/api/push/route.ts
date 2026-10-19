import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { ApiAuthError, authenticateRequest, getServiceClient } from "@/lib/server/auth";
import { type PushSubscriptionRecord, readVapidConfig } from "@/lib/server/push";

const SubscribeBodySchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  locale: z.enum(["pl", "en"]),
});

const UnsubscribeBodySchema = z.object({ endpoint: z.string().min(1).max(1000) });

async function requireService() {
  const service = await getServiceClient();
  if (!service) throw new ApiAuthError("Powiadomienia są niedostępne.", 503);
  return service;
}

/**
 * GET /api/push — publiczny klucz VAPID do subskrypcji (null, gdy push nie jest skonfigurowany).
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await authenticateRequest(request);
    return NextResponse.json({ success: true, publicKey: readVapidConfig()?.publicKey ?? null });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać konfiguracji powiadomień.");
  }
}

/**
 * POST /api/push — zapisuje to urządzenie jako odbiorcę alertów o pobudce w gospodarstwie.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { user } = await authenticateRequest(request);
    const body = await parseJsonBody(request, SubscribeBodySchema);
    const service = await requireService();
    const data = {
      user_id: user.id,
      household_id: user.household_id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      locale: body.locale,
    };
    const existing = await service
      .collection("push_subscriptions")
      .getFirstListItem<PushSubscriptionRecord>(
        service.filter("endpoint = {:endpoint}", { endpoint: body.endpoint }),
      )
      .catch(() => null);
    if (existing) {
      await service.collection("push_subscriptions").update(existing.id, data);
    } else {
      await service.collection("push_subscriptions").create(data);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się włączyć powiadomień.");
  }
}

/**
 * DELETE /api/push — wyłącza alerty na tym urządzeniu (tylko własna subskrypcja).
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const { user } = await authenticateRequest(request);
    const { endpoint } = await parseJsonBody(request, UnsubscribeBodySchema);
    const service = await requireService();
    const existing = await service
      .collection("push_subscriptions")
      .getFirstListItem<PushSubscriptionRecord>(
        service.filter("endpoint = {:endpoint}", { endpoint }),
      )
      .catch(() => null);
    if (existing && existing.user_id === user.id) {
      await service.collection("push_subscriptions").delete(existing.id);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się wyłączyć powiadomień.");
  }
}
