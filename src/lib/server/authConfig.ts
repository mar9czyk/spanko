import type PocketBase from "pocketbase";
import { type AuthMethods, applySignupMethods, readSignupMethods } from "@/lib/authMethods";
import { ApiAuthError } from "@/lib/server/auth";

const USERS_COLLECTION = "users";
const GOOGLE_PROVIDER = "google";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CHECK_TIMEOUT_MS = 5000;

interface OAuth2Provider {
  readonly name: string;
  readonly clientId?: string;
}

interface UsersAuthCollection {
  readonly createRule: string | null;
  readonly passwordAuth: { readonly enabled: boolean; readonly identityFields?: string[] };
  readonly oauth2: { readonly enabled: boolean; readonly providers?: readonly OAuth2Provider[] };
}

export interface AuthConfig {
  readonly methods: AuthMethods;
  readonly google: { readonly configured: boolean; readonly clientId: string | null };
}

/**
 * Pobiera ustawienia uwierzytelniania kolekcji `users`.
 *
 * @param {PocketBase} service - Klient serwisowy
 * @returns {Promise<UsersAuthCollection>} Kolekcja `users`
 */
function fetchUsersCollection(service: PocketBase): Promise<UsersAuthCollection> {
  return service.collections.getOne(USERS_COLLECTION) as unknown as Promise<UsersAuthCollection>;
}

/**
 * Wylicza faktycznie działające metody; źródłem prawdy jest konfiguracja PocketBase, która je egzekwuje.
 * PocketBase nie zwraca sekretu Google, więc nie może on trafić do odpowiedzi API.
 *
 * @param {UsersAuthCollection} collection - Kolekcja `users`
 * @returns {AuthConfig} Stan metod i kluczy Google
 */
export function toAuthConfig(collection: UsersAuthCollection): AuthConfig {
  const provider = collection.oauth2.providers?.find((item) => item.name === GOOGLE_PROVIDER);
  const configured = Boolean(provider?.clientId);
  const signup = readSignupMethods(collection.createRule);
  return {
    methods: {
      login: {
        email: collection.passwordAuth.enabled,
        google: collection.oauth2.enabled && configured,
      },
      signup: { email: signup.email, google: signup.google && configured },
    },
    google: { configured, clientId: provider?.clientId ?? null },
  };
}

/**
 * Odczytuje konfigurację uwierzytelniania.
 *
 * @param {PocketBase} service - Klient serwisowy
 * @returns {Promise<AuthConfig>} Stan metod i kluczy Google
 */
export async function loadAuthConfig(service: PocketBase): Promise<AuthConfig> {
  return toAuthConfig(await fetchUsersCollection(service));
}

/**
 * Zapisuje metody w kolekcji `users`. Lista dostawców nie jest wysyłana, więc klucze Google zostają.
 *
 * @param {PocketBase} service - Klient serwisowy
 * @param {AuthMethods} methods - Zwalidowane metody
 * @throws {ApiAuthError} 409, gdy rejestracja jest zamknięta regułą `null`
 */
export async function saveAuthMethods(service: PocketBase, methods: AuthMethods): Promise<void> {
  const collection = await fetchUsersCollection(service);
  if (collection.createRule === null) {
    throw new ApiAuthError("Rejestracja jest zamknięta regułą kolekcji users (createRule).", 409);
  }
  await service.collections.update(USERS_COLLECTION, {
    createRule: applySignupMethods(collection.createRule, methods.signup),
    passwordAuth: { ...collection.passwordAuth, enabled: methods.login.email },
    oauth2: { enabled: methods.login.google },
  });
}

/**
 * Zapisuje klucze Google w konfiguracji dostawców OAuth2 PocketBase.
 *
 * @param {PocketBase} service - Klient serwisowy
 * @param {string} clientId - Client ID
 * @param {string} clientSecret - Client Secret
 */
export async function saveGoogleCredentials(
  service: PocketBase,
  clientId: string,
  clientSecret: string,
): Promise<void> {
  const collection = await fetchUsersCollection(service);
  const others = (collection.oauth2.providers ?? []).filter(
    (provider) => provider.name !== GOOGLE_PROVIDER,
  );
  await service.collections.update(USERS_COLLECTION, {
    oauth2: { providers: [...others, { name: GOOGLE_PROVIDER, clientId, clientSecret }] },
  });
}

/**
 * Sprawdza klucze w Google próbą wymiany fikcyjnego kodu.
 *
 * @description
 * Poprawne klucze dają `invalid_grant`, błędne `invalid_client`. Odrzucamy tylko jawne
 * `invalid_client`: niedostępność Google nie blokuje zapisu.
 *
 * @param {string} clientId - Client ID
 * @param {string} clientSecret - Client Secret
 * @returns {Promise<boolean>} False tylko, gdy Google odrzuci klucze
 */
export async function areGoogleCredentialsAccepted(
  clientId: string,
  clientSecret: string,
): Promise<boolean> {
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: "spanko-credentials-check",
        grant_type: "authorization_code",
        redirect_uri: "https://localhost/",
      }),
      signal: AbortSignal.timeout(GOOGLE_CHECK_TIMEOUT_MS),
    });
    const body = (await response.json()) as { error?: string };
    return body.error !== "invalid_client";
  } catch {
    return true;
  }
}
