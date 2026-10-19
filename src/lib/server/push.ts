import type PocketBase from "pocketbase";
import webpush from "web-push";

export type PushLocale = "pl" | "en";

export interface PushSubscriptionRecord {
  readonly id: string;
  readonly user_id: string;
  readonly household_id: string;
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
  readonly locale?: PushLocale | "";
}

export interface WakeAlertPayload {
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly tag: string;
}

const WAKE_ALERT_COPY: Record<PushLocale, { title: string; body: string }> = {
  pl: {
    title: "Możliwa pobudka: {name}",
    body: "Mikrofon przy łóżeczku słyszy dłuższy dźwięk. Dotknij, aby otworzyć Spanko.",
  },
  en: {
    title: "Possible waking: {name}",
    body: "The microphone by the crib hears a sustained sound. Tap to open Spanko.",
  },
};

/** Ile sekund usługa push ma próbować dostarczyć alert (po tym czasie jest już nieaktualny). */
const WAKE_ALERT_TTL_SECONDS = 120;

/**
 * Klucze VAPID z env serwera; null, gdy powiadomienia push nie są skonfigurowane.
 */
export function readVapidConfig(): {
  publicKey: string;
  privateKey: string;
  subject: string;
} | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject: process.env.VAPID_SUBJECT || "mailto:admin@spanko.app",
  };
}

/**
 * Treść powiadomienia o możliwej pobudce w języku odbiorcy.
 *
 * @param childName - Imię dziecka
 * @param locale - Język zapisany przy subskrypcji odbiorcy
 * @returns Tytuł, treść, adres po dotknięciu i tag (kolejny alert zastępuje poprzedni)
 */
export function buildWakeAlertPayload(
  childName: string,
  locale: PushLocale | "" | undefined,
): WakeAlertPayload {
  const copy = WAKE_ALERT_COPY[locale === "pl" ? "pl" : "en"];
  return {
    title: copy.title.replace("{name}", childName),
    body: copy.body,
    url: "/dashboard",
    tag: "spanko-wake-alert",
  };
}

/**
 * Odbiorcy alertu: wszystkie urządzenia gospodarstwa poza telefonem, który nasłuchuje.
 */
export function selectWakeAlertRecipients(
  subscriptions: readonly PushSubscriptionRecord[],
  senderEndpoint: string | undefined,
): PushSubscriptionRecord[] {
  return subscriptions.filter((subscription) => subscription.endpoint !== senderEndpoint);
}

/**
 * Wysyła alert o pobudce do odbiorców; wygasłe subskrypcje (404/410) usuwa.
 *
 * @returns Liczba urządzeń, do których usługa push przyjęła powiadomienie
 */
export async function sendWakeAlert(
  service: PocketBase,
  recipients: readonly PushSubscriptionRecord[],
  childName: string,
): Promise<number> {
  const vapid = readVapidConfig();
  if (!vapid) return 0;

  const results = await Promise.all(
    recipients.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(buildWakeAlertPayload(childName, subscription.locale)),
          {
            vapidDetails: vapid,
            TTL: WAKE_ALERT_TTL_SECONDS,
            urgency: "high",
            topic: "wake-alert",
          },
        );
        return true;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await service
            .collection("push_subscriptions")
            .delete(subscription.id)
            .catch(() => undefined);
        }
        return false;
      }
    }),
  );
  return results.filter(Boolean).length;
}
