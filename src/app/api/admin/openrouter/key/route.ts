import { NextResponse } from "next/server";
import { OpenRouterKeySchema } from "@/lib/server/adminSchemas";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiAuthError, requireAdmin } from "@/lib/server/auth";
import {
  deleteOpenRouterKey,
  fetchOpenRouterSecretRecord,
  resolveOpenRouterKey,
  storeOpenRouterKey,
  validateOpenRouterKey,
} from "@/lib/server/openrouterKey";
import { keySuffix, loadMasterKey, SecretsError } from "@/lib/server/secrets";
import type { UserRecord } from "@/lib/types/database";

const MASTER_KEY_HELP =
  "Brak SPANKO_SECRETS_KEY. Wygeneruj klucz: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\" i wpisz go do .env.local (lokalnie) lub .env.production, potem zrestartuj serwer.";

/**
 * Sprawdza, czy klucz główny jest ustawiony i poprawny.
 *
 * @throws {ApiAuthError} 503 z instrukcją, gdy brakuje lub jest niepoprawny
 */
function requireMasterKey(): void {
  try {
    if (!loadMasterKey()) throw new ApiAuthError(MASTER_KEY_HELP, 503);
  } catch (error) {
    if (error instanceof SecretsError) throw new ApiAuthError(error.message, 503);
    throw error;
  }
}

/**
 * GET /api/admin/openrouter/key — źródło klucza, zamaskowana końcówka i kto go zmienił.
 * Nigdy nie zwraca klucza ani szyfrogramu.
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Metadane klucza
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { pb } = await requireAdmin(request);
    const resolved = await resolveOpenRouterKey();
    let masterKeyConfigured = false;
    try {
      masterKeyConfigured = loadMasterKey() !== null;
    } catch {
      masterKeyConfigured = false;
    }
    const record = await fetchOpenRouterSecretRecord().catch(() => null);
    let updatedByEmail: string | null = null;
    if (record?.updated_by) {
      updatedByEmail = await pb
        .collection("users")
        .getOne<UserRecord>(record.updated_by, { fields: "email" })
        .then((user) => user.email)
        .catch(() => null);
    }
    return NextResponse.json({
      success: true,
      source: resolved.source,
      suffix: record?.key_suffix ?? null,
      updatedAt: record?.updated ?? null,
      updatedByEmail,
      masterKeyConfigured,
      problem: resolved.panelError ?? null,
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać stanu klucza.");
  }
}

/**
 * PUT /api/admin/openrouter/key — sprawdza klucz w OpenRouter, szyfruje i zapisuje.
 *
 * @param {Request} request - Żądanie HTTP z `{ apiKey }`
 * @returns {Promise<NextResponse>} Metadane zapisanego klucza
 */
export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const { user } = await requireAdmin(request);
    const { apiKey } = await parseJsonBody(request, OpenRouterKeySchema);
    requireMasterKey();

    const validation = await validateOpenRouterKey(apiKey);
    if (!validation.ok) {
      throw new ApiAuthError(validation.message, validation.reason === "invalid" ? 400 : 503);
    }

    const suffix = keySuffix(apiKey);
    const record = await storeOpenRouterKey(apiKey, user.id, suffix);
    await writeAuditLog({
      actor: user,
      action: "secret.openrouter.set",
      targetCollection: "app_secrets",
      targetId: record.id,
      after: { suffix },
    });
    return NextResponse.json({ success: true, suffix, updatedAt: record.updated });
  } catch (error) {
    if (error instanceof SecretsError) {
      return toErrorResponse(new ApiAuthError(error.message, 503), "");
    }
    return toErrorResponse(error, "Nie udało się zapisać klucza.");
  }
}

/**
 * DELETE /api/admin/openrouter/key — usuwa klucz z panelu (wraca zapas ze zmiennej środowiskowej).
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Potwierdzenie
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const { user } = await requireAdmin(request);
    const before = await fetchOpenRouterSecretRecord();
    const deleted = await deleteOpenRouterKey();
    if (deleted) {
      await writeAuditLog({
        actor: user,
        action: "secret.openrouter.delete",
        targetCollection: "app_secrets",
        targetId: before?.id,
        before: { suffix: before?.key_suffix },
      });
    }
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    if (error instanceof SecretsError) {
      return toErrorResponse(new ApiAuthError(error.message, 503), "");
    }
    return toErrorResponse(error, "Nie udało się usunąć klucza.");
  }
}
