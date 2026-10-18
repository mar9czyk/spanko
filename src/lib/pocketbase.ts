import PocketBase from "pocketbase";
import type { HouseholdRecord, UserRecord } from "@/lib/types/database";

export const DEFAULT_POCKETBASE_URL = "http://127.0.0.1:8090";
export const INVITE_CODE_LENGTH = 6;
export const INVITE_EXPIRATION_HOURS = 24;
export const MILLISECONDS_PER_HOUR = 3_600_000;
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const pocketBaseUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL || DEFAULT_POCKETBASE_URL;

/**
 * Globalna instancja klienta PocketBase dla aplikacji Spanko.
 */
export const pb = new PocketBase(pocketBaseUrl);

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
 * Wymaga obecności zalogowanego użytkownika i zwraca jego identyfikator.
 *
 * @throws {Error} Gdy użytkownik nie jest zalogowany
 * @returns {string} Identyfikator zalogowanego użytkownika
 */
function requireCurrentUserId(): string {
  const currentUser = getCurrentAuthenticatedUser();
  if (!currentUser?.id) {
    throw new Error("Operacja wymaga zalogowanego użytkownika.");
  }
  return currentUser.id;
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
 * Przypisuje gospodarstwo domowe do rekordu użytkownika i odświeża sesję.
 *
 * @param {string} userId - Identyfikator użytkownika
 * @param {string} householdId - Identyfikator gospodarstwa
 */
async function assignHouseholdToUser(userId: string, householdId: string): Promise<void> {
  await pb.collection("users").update(userId, { household_id: householdId });
  await pb.collection("users").authRefresh();
}

/**
 * Tworzy nowe gospodarstwo domowe i przypisuje je do bieżącego użytkownika.
 *
 * @param {string} householdName - Nazwa tworzonego gospodarstwa domowego
 * @returns {Promise<HouseholdRecord>} Utworzone gospodarstwo domowe
 */
export async function createHousehold(householdName: string): Promise<HouseholdRecord> {
  const userId = requireCurrentUserId();
  const inviteCode = generateInviteCode();
  const inviteExpiresAt = calculateInviteExpirationDate();

  const household = await pb.collection("households").create<HouseholdRecord>({
    name: householdName.trim(),
    invite_code: inviteCode,
    invite_expires_at: inviteExpiresAt,
  });

  await assignHouseholdToUser(userId, household.id);
  return household;
}

/**
 * Wyszukuje aktywne gospodarstwo domowe po ważnym kodzie zaproszenia.
 *
 * @param {string} normalizedCode - Znormalizowany kod zaproszenia
 * @returns {Promise<HouseholdRecord>} Znalezione gospodarstwo
 */
async function findActiveHouseholdByCode(normalizedCode: string): Promise<HouseholdRecord> {
  const currentIsoDate = new Date().toISOString();
  const filterExpression = pb.filter("invite_code = {:code} && invite_expires_at > {:now}", {
    code: normalizedCode,
    now: currentIsoDate,
  });

  // Reguła API wymaga zgodności invite_code z parametrem ?code=, co uniemożliwia listowanie cudzych kodów.
  return pb
    .collection("households")
    .getFirstListItem<HouseholdRecord>(filterExpression, { query: { code: normalizedCode } });
}

/**
 * Dołącza bieżącego użytkownika do gospodarstwa za pomocą 6-znakowego kodu zaproszenia.
 *
 * @param {string} inviteCode - 6-znakowy kod zaproszenia
 * @returns {Promise<HouseholdRecord>} Dołączone gospodarstwo domowe
 */
export async function joinHouseholdByInviteCode(inviteCode: string): Promise<HouseholdRecord> {
  const userId = requireCurrentUserId();
  const normalizedCode = inviteCode.trim().toUpperCase();

  try {
    const household = await findActiveHouseholdByCode(normalizedCode);
    await assignHouseholdToUser(userId, household.id);
    return household;
  } catch (error) {
    throw new Error(
      `Nieprawidłowy lub wygasły kod zaproszenia: ${normalizedCode}. Błąd: ${
        error instanceof Error ? error.message : "nieznany"
      }`,
    );
  }
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
