import type { Locale } from "@/i18n/translate";
import { authorizedFetch } from "@/lib/client-data";

const SERVICE_WORKER_URL = "/sw.js";

export type PushSupport = "supported" | "unsupported" | "needsInstall";

/**
 * Czy to urządzenie może odbierać powiadomienia push. iPhone obsługuje je tylko
 * w aplikacji dodanej do ekranu początkowego.
 */
export function detectPushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const hasApis =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (hasApis) return "supported";
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches;
  return isIos && !isStandalone ? "needsInstall" : "unsupported";
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  return existing ?? navigator.serviceWorker.register(SERVICE_WORKER_URL);
}

/** Bieżąca subskrypcja push tego urządzenia (null, gdy brak lub brak wsparcia). */
export async function getOwnPushSubscription(): Promise<PushSubscription | null> {
  if (detectPushSupport() !== "supported") return null;
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export type EnablePushResult = "enabled" | "denied" | "notConfigured" | "failed";

/**
 * Włącza na tym urządzeniu powiadomienia o pobudce wykrytej przez telefon przy dziecku.
 */
export async function enableWakeAlerts(locale: Locale): Promise<EnablePushResult> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const keyResponse = await authorizedFetch("/api/push");
    const { publicKey } = (await keyResponse.json()) as { publicKey?: string | null };
    if (!keyResponse.ok || !publicKey) return "notConfigured";

    const registration = await getRegistration();
    await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));
    const json = subscription.toJSON();
    const response = await authorizedFetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, locale }),
    });
    return response.ok ? "enabled" : "failed";
  } catch {
    return "failed";
  }
}

/** Wyłącza powiadomienia o pobudce na tym urządzeniu. */
export async function disableWakeAlerts(): Promise<void> {
  const subscription = await getOwnPushSubscription();
  if (!subscription) return;
  await authorizedFetch("/api/push", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => undefined);
  await subscription.unsubscribe().catch(() => false);
}

/**
 * Zgłasza możliwą pobudkę z telefonu przy dziecku.
 *
 * @returns True, gdy powiadomienie dotarło do innego urządzenia (lub właśnie dotarło
 * poprzednie); false, gdy nie ma kogo powiadomić albo wysyłka się nie udała
 */
export async function notifyWakeDetected(childId: string): Promise<boolean> {
  try {
    const own = await getOwnPushSubscription().catch(() => null);
    const response = await authorizedFetch("/api/push/wake-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId, senderEndpoint: own?.endpoint }),
    });
    if (!response.ok) return false;
    const { sent, throttled } = (await response.json()) as { sent?: number; throttled?: boolean };
    return throttled === true || (sent ?? 0) > 0;
  } catch {
    return false;
  }
}
