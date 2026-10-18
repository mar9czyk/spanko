const LOCAL_HOSTNAMES: readonly string[] = ["localhost", "127.0.0.1", "[::1]"];

export type DevLoginRole = "user" | "admin";

/**
 * Sprawdza, czy adres PocketBase wskazuje na maszynę lokalną.
 *
 * @param {string | undefined} url - Adres PocketBase
 * @returns {boolean} true dla localhost, 127.0.0.1 i [::1]
 */
export function isLocalPocketBaseUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  try {
    return LOCAL_HOSTNAMES.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Decyduje, czy dev-logowanie hasłem jest dozwolone.
 *
 * @param {string | undefined} nodeEnv - Wartość NODE_ENV
 * @param {string | undefined} pocketBaseUrl - Adres PocketBase
 * @returns {boolean} true tylko w development z lokalnym PocketBase
 */
export function isDevLoginEnabled(
  nodeEnv: string | undefined,
  pocketBaseUrl: string | undefined,
): boolean {
  return nodeEnv === "development" && isLocalPocketBaseUrl(pocketBaseUrl);
}

// process.env.NODE_ENV jest podstawiany w buildzie, więc w produkcji stała to `false` i kod dev jest martwy.
export const IS_DEV_LOGIN_ENABLED =
  process.env.NODE_ENV === "development" &&
  isLocalPocketBaseUrl(process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090");
