import type PocketBase from "pocketbase";
import { z } from "zod";
import { normalizeInviteCode } from "@/lib/invite-code";
import {
  calculateInviteExpirationDate,
  generateInviteCode,
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
} from "@/lib/pocketbase";
import { ApiAuthError } from "@/lib/server/auth";
import type { HouseholdRecord, UserRecord } from "@/lib/types/database";

export const MAX_FAILED_JOIN_ATTEMPTS = 8;
export const JOIN_ATTEMPT_WINDOW_MS = 10 * 60_000;
const MS_PER_HOUR = 3_600_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const DateOnlySchema = z.string().regex(DATE_PATTERN, "oczekiwano daty RRRR-MM-DD");

export const CreateHouseholdSchema = z.object({
  childName: z.string().trim().min(1).max(100),
  birthDate: DateOnlySchema,
  dueDate: DateOnlySchema.optional(),
  timezone: z.string().trim().min(1).max(64).default("UTC"),
  householdName: z.string().trim().max(100).optional(),
  locale: z.enum(["pl", "en"]).default("pl"),
});
export type CreateHouseholdInput = z.infer<typeof CreateHouseholdSchema>;

export const JoinHouseholdSchema = z.object({ code: z.string().trim().min(1).max(16) });

/**
 * Czy kod ma poprawny kształt (6 znaków z alfabetu kodów).
 *
 * @param {string} code - Znormalizowany kod
 * @returns {boolean} True, gdy kod może istnieć
 */
export function isValidInviteCodeShape(code: string): boolean {
  return (
    code.length === INVITE_CODE_LENGTH && [...code].every((char) => INVITE_ALPHABET.includes(char))
  );
}

/**
 * Domyślna nazwa rodziny na podstawie imienia dziecka.
 *
 * @param {string} childName - Imię dziecka
 * @param {"pl" | "en"} locale - Język interfejsu
 * @returns {string} Np. "Rodzina Lena" lub "Lena's family"
 */
export function defaultHouseholdName(childName: string, locale: "pl" | "en"): string {
  return locale === "pl" ? `Rodzina ${childName}` : `${childName}'s family`;
}

/**
 * Czy termin porodu jest sensownym dopełnieniem daty urodzenia (wcześniak: >= 3 tyg. przed terminem).
 *
 * @param {string} birthDate - Data urodzenia (RRRR-MM-DD)
 * @param {string} dueDate - Termin porodu (RRRR-MM-DD)
 * @returns {boolean} True, gdy termin wypada co najmniej 21 dni po urodzeniu
 */
export function isPrematureDueDate(birthDate: string, dueDate: string): boolean {
  const diff = Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${birthDate}T00:00:00Z`);
  return diff >= 21 * 24 * MS_PER_HOUR;
}

/**
 * Czy użytkownik złożył wymagane zgody (regulamin + dane o zdrowiu dziecka).
 *
 * @param {Pick<UserRecord, "terms_accepted_at" | "health_consent_at">} user - Rekord użytkownika
 * @returns {boolean} True, gdy obie zgody są zapisane
 */
export function hasRequiredConsents(
  user: Pick<UserRecord, "terms_accepted_at" | "health_consent_at">,
): boolean {
  return Boolean(user.terms_accepted_at) && Boolean(user.health_consent_at);
}

/**
 * Wymaga zgód i braku gospodarstwa — wspólne warunki założenia/dołączenia do rodziny.
 *
 * @param {UserRecord} user - Rekord użytkownika
 * @throws {ApiAuthError} 403 bez zgód, 409 gdy użytkownik ma już rodzinę
 */
export function assertCanOnboard(user: UserRecord): void {
  if (!hasRequiredConsents(user)) {
    throw new ApiAuthError("Najpierw zaakceptuj regulamin i zgodę na dane o dziecku.", 403);
  }
  if (user.household_id) {
    throw new ApiAuthError("Konto należy już do rodziny.", 409);
  }
}

const failedJoinAttempts = new Map<string, number[]>();

/**
 * Ogranicza zgadywanie kodów zaproszenia: najwyżej kilka nieudanych prób na użytkownika w oknie czasu.
 *
 * @param {string} userId - Identyfikator użytkownika
 * @param {number} [nowMs] - Bieżący czas (ms), do testów
 * @throws {ApiAuthError} 429 po przekroczeniu limitu
 */
export function assertJoinAttemptsAllowed(userId: string, nowMs = Date.now()): void {
  const recent = (failedJoinAttempts.get(userId) ?? []).filter(
    (at) => nowMs - at < JOIN_ATTEMPT_WINDOW_MS,
  );
  failedJoinAttempts.set(userId, recent);
  if (recent.length >= MAX_FAILED_JOIN_ATTEMPTS) {
    throw new ApiAuthError("Zbyt wiele prób. Spróbuj ponownie za kilka minut.", 429);
  }
}

/**
 * Zapisuje nieudaną próbę dołączenia (kod błędny lub wygasły).
 *
 * @param {string} userId - Identyfikator użytkownika
 * @param {number} [nowMs] - Bieżący czas (ms), do testów
 */
export function recordFailedJoinAttempt(userId: string, nowMs = Date.now()): void {
  failedJoinAttempts.set(userId, [...(failedJoinAttempts.get(userId) ?? []), nowMs]);
}

/** Czyści licznik prób (testy). */
export function resetJoinAttempts(): void {
  failedJoinAttempts.clear();
}

/**
 * Znajduje gospodarstwo z ważnym kodem zaproszenia (konto serwisowe).
 *
 * @param {PocketBase} service - Klient serwisowy
 * @param {string} code - Znormalizowany kod
 * @throws {ApiAuthError} 404 dla złego lub wygasłego kodu
 * @returns {Promise<HouseholdRecord>} Gospodarstwo
 */
export async function findHouseholdByActiveCode(
  service: PocketBase,
  code: string,
): Promise<HouseholdRecord> {
  if (!isValidInviteCodeShape(code)) {
    throw new ApiAuthError("Nieprawidłowy lub wygasły kod zaproszenia.", 404);
  }
  try {
    return await service.collection("households").getFirstListItem<HouseholdRecord>(
      service.filter("invite_code = {:code} && invite_expires_at > {:now}", {
        code,
        now: new Date().toISOString(),
      }),
    );
  } catch {
    throw new ApiAuthError("Nieprawidłowy lub wygasły kod zaproszenia.", 404);
  }
}

/**
 * Dołącza użytkownika do gospodarstwa po ważnym kodzie.
 *
 * @param {PocketBase} service - Klient serwisowy
 * @param {UserRecord} user - Dołączający użytkownik
 * @param {string} rawCode - Kod wpisany przez użytkownika
 * @throws {ApiAuthError} 403/409/404/429 zależnie od przyczyny
 * @returns {Promise<HouseholdRecord>} Dołączone gospodarstwo
 */
export async function joinHousehold(
  service: PocketBase,
  user: UserRecord,
  rawCode: string,
): Promise<HouseholdRecord> {
  assertCanOnboard(user);
  assertJoinAttemptsAllowed(user.id);
  let household: HouseholdRecord;
  try {
    household = await findHouseholdByActiveCode(service, normalizeInviteCode(rawCode));
  } catch (error) {
    recordFailedJoinAttempt(user.id);
    throw error;
  }
  await service.collection("users").update(user.id, { household_id: household.id });
  return household;
}

/**
 * Tworzy rodzinę z pierwszym dzieckiem i przypisuje ją użytkownikowi; przy błędzie cofa zmiany.
 *
 * @param {PocketBase} service - Klient serwisowy
 * @param {UserRecord} user - Zakładający rodzic
 * @param {CreateHouseholdInput} input - Dane rodziny i dziecka
 * @throws {ApiAuthError} 403/409 przy niespełnionych warunkach, błąd bazy po cofnięciu zmian
 * @returns {Promise<HouseholdRecord>} Utworzone gospodarstwo (z kodem zaproszenia)
 */
export async function createHouseholdWithChild(
  service: PocketBase,
  user: UserRecord,
  input: CreateHouseholdInput,
): Promise<HouseholdRecord> {
  assertCanOnboard(user);
  const name = input.householdName?.trim() || defaultHouseholdName(input.childName, input.locale);
  const dueDate =
    input.dueDate && isPrematureDueDate(input.birthDate, input.dueDate)
      ? `${input.dueDate}T00:00:00.000Z`
      : undefined;

  const household = await service.collection("households").create<HouseholdRecord>({
    name,
    invite_code: generateInviteCode(),
    invite_expires_at: calculateInviteExpirationDate(),
  });
  let childId: string | null = null;
  try {
    const child = await service.collection("children").create<{ id: string }>({
      household_id: household.id,
      name: input.childName,
      birth_date: `${input.birthDate}T00:00:00.000Z`,
      ...(dueDate ? { due_date: dueDate } : {}),
      active_day_mode: "home",
      anti_orthosomnia_mode: false,
      timezone: input.timezone,
    });
    childId = child.id;
    await service.collection("users").update(user.id, { household_id: household.id });
  } catch (error) {
    if (childId)
      await service
        .collection("children")
        .delete(childId)
        .catch(() => undefined);
    await service
      .collection("households")
      .delete(household.id)
      .catch(() => undefined);
    throw error;
  }
  return household;
}

export { normalizeInviteCode };
