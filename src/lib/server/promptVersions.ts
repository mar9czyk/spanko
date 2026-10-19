import type PocketBase from "pocketbase";
import { getServiceClient } from "@/lib/server/auth";
import type { AdminSettingsRecord, PromptVersionRecord } from "@/lib/types/database";

export const PROMPT_CACHE_TTL_MS = 30_000;
export const MAX_PROMPT_VERSIONS_LISTED = 100;

export interface ActivePromptVersion {
  readonly version: number;
  readonly systemPrompt: string;
}

let activePromptCache: {
  readonly value: ActivePromptVersion | null;
  readonly expiresAt: number;
} | null = null;

/**
 * Czyści pamięć podręczną aktywnego promptu (po utworzeniu/aktywacji wersji).
 */
export function invalidatePromptCache(): void {
  activePromptCache = null;
}

/**
 * Pobiera aktywną wersję promptu (cache 30 s, konto serwisowe); null, gdy brak wersji lub błąd.
 *
 * @returns {Promise<ActivePromptVersion | null>} Aktywna wersja
 */
export async function fetchActivePromptVersion(): Promise<ActivePromptVersion | null> {
  if (activePromptCache && activePromptCache.expiresAt > Date.now()) {
    return activePromptCache.value;
  }
  try {
    const service = await getServiceClient();
    if (!service) return null;
    const result = await service
      .collection("prompt_versions")
      .getList<PromptVersionRecord>(1, 1, { filter: "is_active = true", sort: "-version" });
    const record = result.items[0];
    const value = record ? { version: record.version, systemPrompt: record.system_prompt } : null;
    activePromptCache = { value, expiresAt: Date.now() + PROMPT_CACHE_TTL_MS };
    return value;
  } catch {
    return null;
  }
}

/**
 * Lista wersji promptu od najnowszej.
 *
 * @param {PocketBase} pb - Klient admina
 * @returns {Promise<PromptVersionRecord[]>} Wersje (maks. 100)
 */
export async function listPromptVersions(pb: PocketBase): Promise<PromptVersionRecord[]> {
  const result = await pb
    .collection("prompt_versions")
    .getList<PromptVersionRecord>(1, MAX_PROMPT_VERSIONS_LISTED, { sort: "-version" });
  return result.items;
}

/**
 * Zapisuje treść aktywnego promptu w `admin_settings.system_prompt_insights` (źródło zapasowe
 * dla kodu czytającego ustawienia bez kolekcji wersji).
 *
 * @param {PocketBase} pb - Klient admina
 * @param {string} systemPrompt - Treść promptu
 */
async function syncSettingsPrompt(pb: PocketBase, systemPrompt: string): Promise<void> {
  const existing = await pb.collection("admin_settings").getList<AdminSettingsRecord>(1, 1);
  const current = existing.items[0];
  if (current) {
    await pb
      .collection("admin_settings")
      .update(current.id, { system_prompt_insights: systemPrompt });
  } else {
    await pb.collection("admin_settings").create({ system_prompt_insights: systemPrompt });
  }
}

/**
 * Dezaktywuje wszystkie aktywne wersje poza wskazaną.
 *
 * @param {PocketBase} pb - Klient admina
 * @param {string} exceptId - Id wersji, która ma pozostać aktywna
 */
async function deactivateOthers(pb: PocketBase, exceptId: string): Promise<void> {
  const active = await pb.collection("prompt_versions").getFullList<PromptVersionRecord>({
    filter: "is_active = true",
  });
  for (const record of active) {
    if (record.id !== exceptId) {
      await pb.collection("prompt_versions").update(record.id, { is_active: false });
    }
  }
}

/**
 * Tworzy nową wersję promptu i od razu ją aktywuje.
 *
 * @param {PocketBase} pb - Klient admina
 * @param {object} input - Treść, notatka i autor
 * @returns {Promise<PromptVersionRecord>} Utworzona (aktywna) wersja
 */
export async function createPromptVersion(
  pb: PocketBase,
  input: { readonly systemPrompt: string; readonly note?: string; readonly authorId: string },
): Promise<PromptVersionRecord> {
  const latest = await pb
    .collection("prompt_versions")
    .getList<PromptVersionRecord>(1, 1, { sort: "-version" });
  const nextVersion = (latest.items[0]?.version ?? 0) + 1;
  const created = await pb.collection("prompt_versions").create<PromptVersionRecord>({
    version: nextVersion,
    system_prompt: input.systemPrompt,
    note: input.note ?? "",
    author_id: input.authorId,
    is_active: true,
  });
  await deactivateOthers(pb, created.id);
  await syncSettingsPrompt(pb, input.systemPrompt);
  invalidatePromptCache();
  return created;
}

/**
 * Aktywuje wskazaną (np. starszą) wersję promptu — rollback.
 *
 * @param {PocketBase} pb - Klient admina
 * @param {string} id - Id wersji do aktywacji
 * @returns {Promise<PromptVersionRecord>} Aktywowana wersja
 */
export async function activatePromptVersion(
  pb: PocketBase,
  id: string,
): Promise<PromptVersionRecord> {
  const target = await pb.collection("prompt_versions").getOne<PromptVersionRecord>(id);
  const activated = await pb
    .collection("prompt_versions")
    .update<PromptVersionRecord>(id, { is_active: true });
  await deactivateOthers(pb, id);
  await syncSettingsPrompt(pb, target.system_prompt);
  invalidatePromptCache();
  return activated;
}
