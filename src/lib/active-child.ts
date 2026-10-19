/**
 * Klucz localStorage z identyfikatorem dziecka wybranego w przełączniku.
 */
export const ACTIVE_CHILD_STORAGE_KEY = "spanko.activeChildId";

/**
 * Wybiera aktywne dziecko: zapamiętane w przełączniku, a gdy go nie ma (usunięte, inne konto) — najstarsze.
 *
 * @param {readonly T[]} children - Dzieci gospodarstwa posortowane od najstarszego wpisu
 * @param {string | null} preferredId - Identyfikator zapamiętany w przeglądarce
 * @returns {T | null} Aktywne dziecko lub null, gdy gospodarstwo nie ma dzieci
 */
export function pickActiveChild<T extends { readonly id: string }>(
  children: readonly T[],
  preferredId: string | null,
): T | null {
  return children.find((child) => child.id === preferredId) ?? children[0] ?? null;
}

/**
 * Odczytuje zapamiętany wybór dziecka (prywatne okno lub zablokowany storage zwracają null).
 *
 * @returns {string | null} Identyfikator dziecka lub null
 */
export function readStoredActiveChildId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_CHILD_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Zapamiętuje wybór dziecka, aby pulpit, wnioski i cele pokazywały to samo dziecko.
 *
 * @param {string} childId - Identyfikator wybranego dziecka
 */
export function storeActiveChildId(childId: string): void {
  try {
    window.localStorage.setItem(ACTIVE_CHILD_STORAGE_KEY, childId);
  } catch {
    // Brak dostępu do storage: wybór obowiązuje tylko do przeładowania strony.
  }
}
