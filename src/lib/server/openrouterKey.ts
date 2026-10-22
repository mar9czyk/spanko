import { getServiceClient } from "@/lib/server/auth";
import {
  decryptSecret,
  encryptSecret,
  loadMasterKey,
  OPENROUTER_SECRET_NAME,
  SecretsError,
} from "@/lib/server/secrets";
import type { AppSecretRecord } from "@/lib/types/database";

export type OpenRouterKeySource = "panel" | "env" | "none";

export interface ResolvedOpenRouterKey {
  readonly key: string | undefined;
  readonly source: OpenRouterKeySource;
  /** Klucz z panelu istnieje, ale nie dało się go odszyfrować (użyto zapasu z env) */
  readonly panelError?: string;
}

export const SECRETS_CACHE_TTL_MS = 30_000;

let cache: { readonly value: ResolvedOpenRouterKey; readonly expiresAt: number } | null = null;

/**
 * Czyści pamięć podręczną klucza (po zapisie lub usunięciu w panelu).
 */
export function invalidateOpenRouterKeyCache(): void {
  cache = null;
}

/**
 * Ustala kolejność źródeł: klucz z panelu → zmienna `OPENROUTER_API_KEY` → brak.
 *
 * @param {string | undefined} panelKey - Odszyfrowany klucz z panelu
 * @param {string | undefined} envKey - Wartość zmiennej środowiskowej
 * @param {string} [panelError] - Powód, dla którego nie udało się odczytać klucza z panelu
 * @returns {ResolvedOpenRouterKey} Wybrany klucz i jego źródło
 */
export function pickOpenRouterKey(
  panelKey: string | undefined,
  envKey: string | undefined,
  panelError?: string,
): ResolvedOpenRouterKey {
  const panel = panelKey?.trim();
  if (panel) return { key: panel, source: "panel" };
  const env = envKey?.trim();
  if (env) return { key: env, source: "env", panelError };
  return { key: undefined, source: "none", panelError };
}

/**
 * Pobiera rekord zaszyfrowanego klucza z `app_secrets` (konto serwisowe).
 *
 * @returns {Promise<AppSecretRecord | null>} Rekord albo null
 */
export async function fetchOpenRouterSecretRecord(): Promise<AppSecretRecord | null> {
  const service = await getServiceClient();
  if (!service) return null;
  const result = await service.collection("app_secrets").getList<AppSecretRecord>(1, 1, {
    filter: service.filter("name = {:name}", { name: OPENROUTER_SECRET_NAME }),
  });
  return result.items[0] ?? null;
}

/**
 * Zwraca aktywny klucz OpenRouter (cache 30 s): panel (zaszyfrowany) → env → brak.
 *
 * @description
 * Brak klucza głównego lub błąd odszyfrowania nie przerywa działania — używany jest zapas z env,
 * a powód trafia do `panelError` (pulpit pokazuje alert).
 *
 * @returns {Promise<ResolvedOpenRouterKey>} Klucz i źródło
 */
export async function resolveOpenRouterKey(): Promise<ResolvedOpenRouterKey> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  const envKey = process.env.OPENROUTER_API_KEY;
  let value: ResolvedOpenRouterKey;
  try {
    const record = await fetchOpenRouterSecretRecord();
    if (!record) {
      value = pickOpenRouterKey(undefined, envKey);
    } else {
      const master = loadMasterKey();
      value = master
        ? pickOpenRouterKey(
            decryptSecret(OPENROUTER_SECRET_NAME, record.ciphertext, master),
            envKey,
          )
        : pickOpenRouterKey(
            undefined,
            envKey,
            "Klucz jest zapisany w panelu, ale brakuje SPANKO_SECRETS_KEY.",
          );
    }
  } catch (error) {
    value = pickOpenRouterKey(
      undefined,
      envKey,
      error instanceof SecretsError ? error.message : undefined,
    );
  }
  cache = { value, expiresAt: Date.now() + SECRETS_CACHE_TTL_MS };
  return value;
}

/**
 * Szyfruje i zapisuje klucz OpenRouter w `app_secrets` (tworzy albo aktualizuje rekord).
 *
 * @param {string} apiKey - Klucz jawny (już zweryfikowany)
 * @param {string} actorId - Id admina zapisującego
 * @param {string} suffix - Ostatnie znaki klucza
 * @throws {SecretsError} Gdy brak `SPANKO_SECRETS_KEY`
 * @returns {Promise<AppSecretRecord>} Zapisany rekord
 */
export async function storeOpenRouterKey(
  apiKey: string,
  actorId: string,
  suffix: string,
): Promise<AppSecretRecord> {
  const master = loadMasterKey();
  if (!master) throw new SecretsError("Brak SPANKO_SECRETS_KEY.");
  const service = await getServiceClient();
  if (!service) throw new SecretsError("Brak konta serwisowego PocketBase.");
  const data = {
    name: OPENROUTER_SECRET_NAME,
    ciphertext: encryptSecret(OPENROUTER_SECRET_NAME, apiKey, master),
    key_suffix: suffix,
    key_version: 1,
    updated_by: actorId,
  };
  const existing = await fetchOpenRouterSecretRecord();
  const record = existing
    ? await service.collection("app_secrets").update<AppSecretRecord>(existing.id, data)
    : await service.collection("app_secrets").create<AppSecretRecord>(data);
  invalidateOpenRouterKeyCache();
  return record;
}

/**
 * Usuwa klucz OpenRouter z panelu (wraca zapas z env).
 *
 * @returns {Promise<boolean>} true, gdy rekord istniał
 */
export async function deleteOpenRouterKey(): Promise<boolean> {
  const service = await getServiceClient();
  if (!service) throw new SecretsError("Brak konta serwisowego PocketBase.");
  const existing = await fetchOpenRouterSecretRecord();
  if (!existing) return false;
  await service.collection("app_secrets").delete(existing.id);
  invalidateOpenRouterKeyCache();
  return true;
}

export const OPENROUTER_CREDITS_URL = "https://openrouter.ai/api/v1/credits";
const VALIDATION_TIMEOUT_MS = 8000;

export type KeyValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "invalid" | "unreachable"; readonly message: string };

/**
 * Sprawdza klucz w OpenRouter (`/credits`) przed zapisem.
 *
 * @description
 * 401 = klucz odrzucony. 403 oznacza uwierzytelniony klucz bez uprawnień do kredytów — przyjmujemy go.
 * Inne błędy i brak sieci nie dowodzą, że klucz jest zły, więc nie zapisujemy go „w ciemno”.
 *
 * @param {string} apiKey - Klucz do sprawdzenia
 * @param {typeof fetch} [fetchImpl] - Podmieniany w testach
 * @returns {Promise<KeyValidation>} Wynik walidacji
 */
export async function validateOpenRouterKey(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<KeyValidation> {
  try {
    const response = await fetchImpl(OPENROUTER_CREDITS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
    });
    if (response.ok || response.status === 403) return { ok: true };
    if (response.status === 401) {
      return { ok: false, reason: "invalid", message: "OpenRouter odrzucił ten klucz (401)." };
    }
    return {
      ok: false,
      reason: "unreachable",
      message: `Nie udało się zweryfikować klucza (HTTP ${response.status}).`,
    };
  } catch {
    return {
      ok: false,
      reason: "unreachable",
      message: "Nie udało się połączyć z OpenRouter, żeby sprawdzić klucz.",
    };
  }
}
