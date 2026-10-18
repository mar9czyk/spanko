import { pb } from "@/lib/pocketbase";
import type { ChildRecord } from "@/lib/types/database";

/**
 * Wykonuje żądanie do własnego API z tokenem zalogowanego użytkownika PocketBase.
 *
 * @param {string} input - Ścieżka endpointu
 * @param {RequestInit} [init] - Opcje fetch
 * @returns {Promise<Response>} Odpowiedź HTTP
 */
export function authorizedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (pb.authStore.token) {
    headers.set("Authorization", `Bearer ${pb.authStore.token}`);
  }
  return fetch(input, { ...init, headers });
}

/**
 * Pobiera aktywne (pierwsze) dziecko z gospodarstwa zalogowanego użytkownika.
 *
 * @returns {Promise<ChildRecord | null>} Dziecko lub null, gdy gospodarstwo nie ma jeszcze dzieci
 */
export async function loadActiveChild(): Promise<ChildRecord | null> {
  const result = await pb.collection("children").getList<ChildRecord>(1, 1, { sort: "created" });
  return result.items[0] ?? null;
}
