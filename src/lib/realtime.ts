import type { RecordSubscription } from "pocketbase";

/** Fragment RecordService potrzebny do subskrypcji (ułatwia testy). */
export interface RealtimeCollection<T> {
  subscribe(
    topic: string,
    callback: (event: RecordSubscription<T>) => void,
  ): Promise<() => Promise<void>>;
}

/**
 * Subskrybuje zmiany kolekcji PocketBase (SSE) i zwraca funkcję sprzątającą.
 *
 * @description
 * Sprząta wyłącznie własny nasłuch (funkcja zwrócona przez `subscribe`), a nie `unsubscribe('*')`,
 * które usuwało nasłuchy wszystkich komponentów i, gdy nie zostawał żaden, zamykało połączenie SSE.
 * Subskrypcja jest asynchroniczna: gdy sprzątanie nastąpi przed jej zakończeniem (React StrictMode,
 * szybka zmiana dziecka), nasłuch jest zdejmowany zaraz po ustanowieniu, więc nic nie wycieka.
 *
 * @param {RealtimeCollection<T>} collection - Serwis kolekcji PocketBase
 * @param {(event: RecordSubscription<T>) => void} onEvent - Obsługa zdarzenia create/update/delete
 * @param {(error: unknown) => void} onError - Błąd nawiązania subskrypcji
 * @returns {() => void} Funkcja zdejmująca nasłuch
 */
export function subscribeToCollection<T>(
  collection: RealtimeCollection<T>,
  onEvent: (event: RecordSubscription<T>) => void,
  onError: (error: unknown) => void,
): () => void {
  let disposed = false;
  let unsubscribe: (() => Promise<void>) | null = null;
  collection
    .subscribe("*", onEvent)
    .then((remove) => {
      if (disposed) void remove().catch(() => undefined);
      else unsubscribe = remove;
    })
    .catch(onError);
  return () => {
    disposed = true;
    if (unsubscribe) void unsubscribe().catch(() => undefined);
    unsubscribe = null;
  };
}
