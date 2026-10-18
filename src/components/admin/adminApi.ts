import { authorizedFetch } from "@/lib/client-data";

/**
 * Wywołuje endpoint admina z tokenem PocketBase i zwraca zdekodowany JSON.
 * Prawdziwa kontrola dostępu jest po stronie API (`requireAdmin`) — UI tylko ją odzwierciedla.
 *
 * @param {string} path - Ścieżka endpointu (np. `/api/admin/settings`)
 * @param {RequestInit} [init] - Opcje fetch (metoda, body)
 * @throws {Error} Z komunikatem serwera, gdy odpowiedź nie jest sukcesem
 * @returns {Promise<T>} Dane odpowiedzi
 */
export async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await authorizedFetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const data = await response.json().catch(() => ({ success: false, error: "Błąd odpowiedzi." }));
  if (!response.ok || data.success === false) {
    throw new Error(data.error ?? `HTTP ${response.status}`);
  }
  return data as T;
}

export function jsonBody(payload: unknown): RequestInit {
  return { body: JSON.stringify(payload) };
}
