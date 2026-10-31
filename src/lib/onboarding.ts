import { authorizedFetch } from "@/lib/client-data";
import { normalizeInviteCode } from "@/lib/invite-code";
import { pb } from "@/lib/pocketbase";
import type { UserRecord } from "@/lib/types/database";

/** Wersja regulaminu i polityki prywatności, którą akceptuje użytkownik. */
export const CONSENT_VERSION = "2026-10";
const PENDING_INVITE_KEY = "spanko.pendingInvite";

export type OnboardingStep = "login" | "consent" | "choose" | "ready";

/**
 * Wyznacza, na którym etapie wejścia do aplikacji jest użytkownik.
 *
 * @param {Pick<UserRecord, "terms_accepted_at" | "health_consent_at" | "household_id"> | null} user - Sesja lub null
 * @returns {OnboardingStep} Brak sesji → login, brak zgód → consent, brak rodziny → choose, inaczej ready
 */
export function resolveOnboardingStep(
  user: Pick<UserRecord, "terms_accepted_at" | "health_consent_at" | "household_id"> | null,
): OnboardingStep {
  if (!user) return "login";
  if (!user.terms_accepted_at || !user.health_consent_at) return "consent";
  if (!user.household_id) return "choose";
  return "ready";
}

/**
 * Zapamiętuje kod z linku zaproszenia na czas logowania i zgód.
 *
 * @param {string} code - Kod z adresu /join/KOD
 */
export function storePendingInvite(code: string): void {
  try {
    window.sessionStorage.setItem(PENDING_INVITE_KEY, normalizeInviteCode(code));
  } catch {
    // Zablokowana pamięć sesji — użytkownik wpisze kod ręcznie.
  }
}

/**
 * Odczytuje zapamiętany kod zaproszenia.
 *
 * @returns {string | null} Kod lub null
 */
export function readPendingInvite(): string | null {
  try {
    return window.sessionStorage.getItem(PENDING_INVITE_KEY);
  } catch {
    return null;
  }
}

/** Usuwa zapamiętany kod zaproszenia. */
export function clearPendingInvite(): void {
  try {
    window.sessionStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    // Brak dostępu do pamięci sesji — nic do usunięcia.
  }
}

/**
 * Zapisuje zgody użytkownika (regulamin, dane o zdrowiu dziecka, opcjonalnie AI).
 *
 * @param {string} userId - Identyfikator użytkownika
 * @param {boolean} aiConsent - Zgoda na wnioski AI
 */
export async function saveConsents(userId: string, aiConsent: boolean): Promise<void> {
  const now = new Date().toISOString();
  await pb.collection("users").update(userId, {
    terms_accepted_at: now,
    health_consent_at: now,
    consent_version: CONSENT_VERSION,
    ai_consent: aiConsent,
  });
}

interface ApiResult {
  readonly success?: boolean;
  readonly error?: string;
  readonly householdName?: string;
}

async function callApi(path: string, init?: RequestInit): Promise<ApiResult> {
  const response = await authorizedFetch(path, init);
  const data = (await response.json().catch(() => ({}))) as ApiResult;
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
  return data;
}

export interface CreateFamilyInput {
  readonly childName: string;
  readonly birthDate: string;
  readonly dueDate?: string;
  readonly householdName?: string;
  readonly locale: "pl" | "en";
}

/**
 * Zakłada rodzinę z pierwszym dzieckiem (serwer) i odświeża sesję.
 *
 * @param {CreateFamilyInput} input - Dane dziecka i rodziny
 */
export async function createFamily(input: CreateFamilyInput): Promise<void> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  await callApi("/api/household", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, timezone }),
  });
  await pb.collection("users").authRefresh();
}

/**
 * Sprawdza kod zaproszenia i zwraca nazwę rodziny.
 *
 * @param {string} code - Kod zaproszenia
 * @returns {Promise<string>} Nazwa rodziny
 */
export async function previewInvite(code: string): Promise<string> {
  const data = await callApi(`/api/household/join?code=${encodeURIComponent(code)}`);
  return data.householdName ?? "";
}

/**
 * Dołącza do rodziny po kodzie i odświeża sesję.
 *
 * @param {string} code - Kod zaproszenia
 */
export async function joinFamily(code: string): Promise<void> {
  await callApi("/api/household/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  clearPendingInvite();
  await pb.collection("users").authRefresh();
}
