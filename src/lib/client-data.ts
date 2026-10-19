import { pickActiveChild, readStoredActiveChildId } from "@/lib/active-child";
import { pb } from "@/lib/pocketbase";
import type { ChildRecord, DayContextRecord, SleepLogRecord } from "@/lib/types/database";

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
 * Pobiera wszystkie dzieci z gospodarstwa zalogowanego użytkownika, od najstarszego wpisu.
 *
 * @returns {Promise<ChildRecord[]>} Dzieci gospodarstwa (pusta lista, gdy brak)
 */
export function loadChildren(): Promise<ChildRecord[]> {
  return pb.collection("children").getFullList<ChildRecord>({ sort: "created" });
}

/**
 * Pobiera aktywne dziecko: wybrane w przełączniku, a domyślnie najstarsze w gospodarstwie.
 *
 * @returns {Promise<ChildRecord | null>} Dziecko lub null, gdy gospodarstwo nie ma jeszcze dzieci
 */
export async function loadActiveChild(): Promise<ChildRecord | null> {
  return pickActiveChild(await loadChildren(), readStoredActiveChildId());
}

/**
 * Pobiera logi snu i wpisy day_context dziecka z zakresu dób fizjologicznych (włącznie).
 *
 * @param {string} childId - Id dziecka
 * @param {string} fromDate - Pierwsza doba YYYY-MM-DD
 * @param {string} toDate - Ostatnia doba YYYY-MM-DD
 * @returns {Promise<object>} Logi snu i wpisy kontekstu dnia
 */
export async function loadDaysRange(
  childId: string,
  fromDate: string,
  toDate: string,
): Promise<{ logs: SleepLogRecord[]; contexts: DayContextRecord[] }> {
  const filter = pb.filter(
    "child_id = {:childId} && physiological_date >= {:fromDate} && physiological_date <= {:toDate}",
    { childId, fromDate, toDate },
  );
  const [logs, contexts] = await Promise.all([
    pb.collection("sleep_logs").getFullList<SleepLogRecord>({ filter, sort: "-created" }),
    pb.collection("day_context").getFullList<DayContextRecord>({ filter, sort: "-timestamp" }),
  ]);
  return { logs, contexts };
}
