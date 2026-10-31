import PocketBase from "pocketbase";
import { isLocalPocketBaseUrl } from "@/lib/dev-auth";
import type { HouseholdRecord, UserRecord } from "@/lib/types/database";

export const DEFAULT_POCKETBASE_URL = "http://127.0.0.1:8090";
export const INVITE_CODE_LENGTH = 6;
export const INVITE_EXPIRATION_HOURS = 24;
export const MILLISECONDS_PER_HOUR = 3_600_000;
export const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Adres PocketBase dla przeglądarki.
 *
 * @description
 * W development, gdy aplikację otwarto z innego hosta niż loopback (telefon w Wi-Fi, Tailscale),
 * adres 127.0.0.1 wskazywałby na telefon, więc używamy proxy `/pb` na tym samym originie (rewrite w next.config.ts).
 *
 * @param {string} configuredUrl - Skonfigurowany adres (NEXT_PUBLIC_POCKETBASE_URL)
 * @param {{ hostname: string; origin: string } | undefined} location - window.location (undefined na serwerze)
 * @returns {string} Adres bazowy dla klienta PocketBase
 */
export function resolveBrowserPocketBaseUrl(
  configuredUrl: string,
  location: { hostname: string; origin: string } | undefined,
): string {
  if (!location || process.env.NODE_ENV !== "development") {
    return configuredUrl;
  }
  const pageIsLoopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(location.hostname);
  return isLocalPocketBaseUrl(configuredUrl) && !pageIsLoopback
    ? `${location.origin}/pb`
    : configuredUrl;
}

const pocketBaseUrl = resolveBrowserPocketBaseUrl(
  process.env.NEXT_PUBLIC_POCKETBASE_URL || DEFAULT_POCKETBASE_URL,
  typeof window === "undefined" ? undefined : window.location,
);

/**
 * Globalna instancja klienta PocketBase dla aplikacji Spanko.
 */
export const pb = new PocketBase(pocketBaseUrl);
// Równoległe i podwójne (React StrictMode) zapytania do tej samej kolekcji nie mogą się wzajemnie anulować.
pb.autoCancellation(false);

/**
 * Pobiera singleton instancji PocketBase.
 *
 * @returns {PocketBase} Skonfigurowany klient PocketBase
 */
export function getPocketBaseClient(): PocketBase {
  return pb;
}

/**
 * Pobiera aktualnie zalogowanego użytkownika z magazynu autoryzacji.
 *
 * @returns {UserRecord | null} Dane użytkownika lub null
 */
export function getCurrentAuthenticatedUser(): UserRecord | null {
  const authRecord = pb.authStore.record;
  if (!authRecord) {
    return null;
  }
  return authRecord as unknown as UserRecord;
}

/**
 * Loguje użytkownika za pomocą Google OAuth2.
 *
 * @description
 * Otwiera okno autoryzacji Google OAuth2 w przeglądarce i zapisuje token w pb.authStore.
 *
 * @returns {Promise<UserRecord>} Zalogowany użytkownik
 */
export async function signInWithGoogle(): Promise<UserRecord> {
  const authData = await pb.collection("users").authWithOAuth2({
    provider: "google",
  });
  return authData.record as unknown as UserRecord;
}

/**
 * Wylogowuje aktualnego użytkownika i czyści magazyn sesji.
 */
export function signOutUser(): void {
  pb.authStore.clear();
}

/**
 * Generuje 6-znakowy alfanumeryczny kod zaproszenia pozbawiony mylących znaków.
 *
 * @param {number} [length=INVITE_CODE_LENGTH] - Długość generowanego kodu
 * @returns {string} Kod zaproszenia, np. 'SP7K92'
 */
export function generateInviteCode(length = INVITE_CODE_LENGTH): string {
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  let result = "";
  for (const value of randomValues) {
    // Długość alfabetu (32) dzieli 256 bez reszty, więc modulo nie wprowadza biasu.
    result += INVITE_ALPHABET.charAt(value % INVITE_ALPHABET.length);
  }
  return result;
}

/**
 * Oblicza czas wygaśnięcia kodu zaproszenia w formacie ISO.
 *
 * @param {number} [hoursAhead=INVITE_EXPIRATION_HOURS] - Liczba godzin ważności
 * @returns {string} Data wygaśnięcia w formacie ISO
 */
export function calculateInviteExpirationDate(hoursAhead = INVITE_EXPIRATION_HOURS): string {
  const expirationTimestamp = Date.now() + hoursAhead * MILLISECONDS_PER_HOUR;
  return new Date(expirationTimestamp).toISOString();
}

/**
 * Odświeża kod zaproszenia dla istniejącego gospodarstwa domowego na kolejne 24h.
 *
 * @param {string} householdId - Identyfikator gospodarstwa domowego
 * @returns {Promise<HouseholdRecord>} Zaktualizowane gospodarstwo domowe
 */
export async function regenerateHouseholdInviteCode(householdId: string): Promise<HouseholdRecord> {
  const newInviteCode = generateInviteCode();
  const newExpirationDate = calculateInviteExpirationDate();

  return pb.collection("households").update<HouseholdRecord>(householdId, {
    invite_code: newInviteCode,
    invite_expires_at: newExpirationDate,
  });
}
