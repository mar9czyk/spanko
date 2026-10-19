import PocketBase from "pocketbase";
import type { UserRecord } from "@/lib/types/database";

export const DEFAULT_POCKETBASE_INTERNAL_URL = "http://127.0.0.1:8090";
const BEARER_PREFIX = "Bearer ";

export interface AuthenticatedRequestContext {
  readonly pb: PocketBase;
  readonly user: UserRecord & { readonly household_id: string };
}

export class ApiAuthError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 429 | 503,
  ) {
    super(message);
    this.name = "ApiAuthError";
  }
}

/**
 * Adres PocketBase używany po stronie serwera (może być wewnętrznym adresem loopback).
 *
 * @returns {string} URL instancji PocketBase
 */
export function resolveServerPocketBaseUrl(): string {
  return (
    process.env.POCKETBASE_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_POCKETBASE_URL ||
    DEFAULT_POCKETBASE_INTERNAL_URL
  );
}

/**
 * Wyciąga token użytkownika z nagłówka Authorization.
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {string | null} Token lub null
 */
function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith(BEARER_PREFIX)) {
    return null;
  }
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Weryfikuje token z żądania (authRefresh) i zwraca klienta PocketBase w imieniu użytkownika.
 *
 * @param {Request} request - Żądanie HTTP
 * @throws {ApiAuthError} 401 przy braku/nieważnym tokenie
 * @returns {Promise<{ pb: PocketBase; user: UserRecord }>} Klient i użytkownik z serwera
 */
async function verifyRequestToken(request: Request): Promise<{ pb: PocketBase; user: UserRecord }> {
  const token = extractBearerToken(request);
  if (!token) {
    throw new ApiAuthError("Wymagane uwierzytelnienie.", 401);
  }

  const pb = new PocketBase(resolveServerPocketBaseUrl());
  pb.autoCancellation(false);
  pb.authStore.save(token, null);

  let user: UserRecord;
  try {
    const authData = await pb.collection("users").authRefresh();
    user = authData.record as unknown as UserRecord;
  } catch {
    throw new ApiAuthError("Nieprawidłowy lub wygasły token.", 401);
  }

  if (user.is_blocked === true) {
    throw new ApiAuthError("Konto zostało zablokowane.", 403);
  }
  void touchLastSeen(user);
  return { pb, user };
}

export const LAST_SEEN_THROTTLE_MS = 15 * 60_000;

/**
 * Czy `last_seen_at` wymaga odświeżenia (brak wartości lub starsza niż próg).
 *
 * @param {string | undefined} lastSeenAt - Poprzednia wartość (ISO)
 * @param {number} nowMs - Bieżący czas w ms
 * @returns {boolean} True, gdy należy zapisać nową wartość
 */
export function shouldTouchLastSeen(lastSeenAt: string | undefined, nowMs: number): boolean {
  if (!lastSeenAt) return true;
  const previous = new Date(lastSeenAt).getTime();
  return Number.isNaN(previous) || nowMs - previous >= LAST_SEEN_THROTTLE_MS;
}

/**
 * Aktualizuje `last_seen_at` (najwyżej raz na 15 min, klient serwisowy, best effort).
 *
 * @param {UserRecord} user - Zalogowany użytkownik
 */
async function touchLastSeen(user: UserRecord): Promise<void> {
  if (!shouldTouchLastSeen(user.last_seen_at, Date.now())) return;
  try {
    const service = await getServiceClient();
    await service?.collection("users").update(user.id, { last_seen_at: new Date().toISOString() });
  } catch {
    // Błąd zapisu znacznika aktywności nigdy nie przerywa żądania.
  }
}

/**
 * Uwierzytelnia żądanie tokenem PocketBase użytkownika i zwraca klienta ograniczonego do jego uprawnień.
 *
 * @description
 * Dla każdego żądania tworzony jest osobny klient PocketBase (brak współdzielenia sesji między
 * użytkownikami). Token jest weryfikowany przez authRefresh, a wszystkie kolejne zapytania
 * podlegają regułom API kolekcji (dostęp tylko do danych własnego gospodarstwa).
 *
 * @param {Request} request - Żądanie HTTP
 * @throws {ApiAuthError} 401 przy braku/nieważnym tokenie, 403 gdy użytkownik nie ma gospodarstwa
 * @returns {Promise<AuthenticatedRequestContext>} Klient i zalogowany użytkownik
 */
export async function authenticateRequest(request: Request): Promise<AuthenticatedRequestContext> {
  const { pb, user } = await verifyRequestToken(request);
  if (!user.household_id) {
    throw new ApiAuthError("Użytkownik nie należy do żadnego gospodarstwa domowego.", 403);
  }
  return { pb, user: { ...user, household_id: user.household_id } };
}

/**
 * Wymaga zalogowanego (niezablokowanego) użytkownika, bez wymogu przynależności do gospodarstwa.
 *
 * @param {Request} request - Żądanie HTTP
 * @throws {ApiAuthError} 401 przy braku/nieważnym tokenie, 403 dla zablokowanego konta
 * @returns {Promise<{ pb: PocketBase; user: UserRecord }>} Klient w imieniu użytkownika i jego rekord
 */
export function requireUser(request: Request): Promise<{ pb: PocketBase; user: UserRecord }> {
  return verifyRequestToken(request);
}

export interface AdminRequestContext {
  readonly pb: PocketBase;
  readonly user: UserRecord;
}

/**
 * Wymaga zalogowanego administratora (`is_admin === true` wg rekordu z serwera, nie z klienta).
 *
 * @description
 * Nie wymaga przynależności do gospodarstwa domowego.
 *
 * @param {Request} request - Żądanie HTTP
 * @throws {ApiAuthError} 401 przy braku/nieważnym tokenie, 403 gdy użytkownik nie jest adminem
 * @returns {Promise<AdminRequestContext>} Klient (z uprawnieniami admina wg reguł) i użytkownik
 */
export async function requireAdmin(request: Request): Promise<AdminRequestContext> {
  const context = await verifyRequestToken(request);
  if (context.user.is_admin !== true) {
    throw new ApiAuthError("Wymagane uprawnienia administratora.", 403);
  }
  return context;
}

let serviceClient: PocketBase | null = null;

/**
 * Zwraca klienta z uprawnieniami superusera (tylko serwer) do odczytu admin_settings.
 *
 * @description
 * Wymaga zmiennych POCKETBASE_SUPERUSER_EMAIL i POCKETBASE_SUPERUSER_PASSWORD.
 * Bez nich zwraca null, a wywołujący używa wartości domyślnych.
 *
 * @returns {Promise<PocketBase | null>} Klient serwisowy lub null
 */
export async function getServiceClient(): Promise<PocketBase | null> {
  const email = process.env.POCKETBASE_SUPERUSER_EMAIL;
  const password = process.env.POCKETBASE_SUPERUSER_PASSWORD;
  if (!email || !password) {
    return null;
  }

  try {
    if (!serviceClient) {
      serviceClient = new PocketBase(resolveServerPocketBaseUrl());
      serviceClient.autoCancellation(false);
    }
    if (!serviceClient.authStore.isValid) {
      await serviceClient.collection("_superusers").authWithPassword(email, password);
    }
    return serviceClient;
  } catch {
    return null;
  }
}

/**
 * Zwraca klienta serwisowego lub rzuca 503, gdy nie skonfigurowano konta superusera.
 *
 * @throws {ApiAuthError} 503 przy braku konfiguracji
 * @returns {Promise<PocketBase>} Klient z uprawnieniami superusera
 */
export async function requireServiceClient(): Promise<PocketBase> {
  const client = await getServiceClient();
  if (!client) {
    throw new ApiAuthError(
      "Brak konfiguracji konta serwisowego (POCKETBASE_SUPERUSER_EMAIL / _PASSWORD).",
      503,
    );
  }
  return client;
}
