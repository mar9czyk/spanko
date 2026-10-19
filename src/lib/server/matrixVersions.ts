import type PocketBase from "pocketbase";

export type MatrixVersionSource = "save" | "restore" | "reset";

export interface MatrixVersionRecord {
  readonly id: string;
  readonly matrix_json: unknown;
  readonly note?: string;
  readonly source: MatrixVersionSource;
  readonly author_id?: string;
  readonly created: string;
}

export const MAX_MATRIX_VERSIONS_LISTED = 50;

/**
 * Zapisuje wersję matrycy snu (historia zmian). Best effort — błąd zapisu historii nie przerywa
 * zapisu ustawień, ale jest zgłaszany w logu serwera.
 *
 * @param {PocketBase} pb - Klient admina
 * @param {object} input - Matryca (null = reset do domyślnej), notatka, źródło i autor
 */
export async function recordMatrixVersion(
  pb: PocketBase,
  input: {
    readonly matrix: unknown;
    readonly note?: string;
    readonly source: MatrixVersionSource;
    readonly authorId: string;
  },
): Promise<void> {
  try {
    await pb.collection("sleep_matrix_versions").create({
      matrix_json: input.matrix,
      note: input.note ?? "",
      source: input.source,
      author_id: input.authorId,
    });
  } catch (error) {
    console.error("[matrix] nie udało się zapisać wersji matrycy", error);
  }
}

/**
 * Lista wersji matrycy od najnowszej.
 *
 * @param {PocketBase} pb - Klient admina
 * @returns {Promise<MatrixVersionRecord[]>} Wersje (maks. 50)
 */
export async function listMatrixVersions(pb: PocketBase): Promise<MatrixVersionRecord[]> {
  const result = await pb
    .collection("sleep_matrix_versions")
    .getList<MatrixVersionRecord>(1, MAX_MATRIX_VERSIONS_LISTED, { sort: "-created" });
  return result.items;
}
