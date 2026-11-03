import { NextResponse } from "next/server";
import { validateAuthMethods } from "@/lib/authMethods";
import { AuthMethodsSchema } from "@/lib/server/adminSchemas";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiAuthError, requireAdmin, requireServiceClient } from "@/lib/server/auth";
import { loadAuthConfig, saveAuthMethods } from "@/lib/server/authConfig";

/**
 * GET /api/admin/auth-config — metody logowania i rejestracji oraz Client ID Google (bez sekretu).
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Konfiguracja
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const config = await loadAuthConfig(await requireServiceClient());
    return NextResponse.json({ success: true, ...config });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać konfiguracji logowania.");
  }
}

/**
 * PUT /api/admin/auth-config — zapisuje metody; 409, gdy żadna metoda by nie została.
 *
 * @param {Request} request - Żądanie HTTP z `{ login, signup }`
 * @returns {Promise<NextResponse>} Zapisana konfiguracja
 */
export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const { user } = await requireAdmin(request);
    const methods = await parseJsonBody(request, AuthMethodsSchema);
    const service = await requireServiceClient();
    const before = await loadAuthConfig(service);
    const problem = validateAuthMethods(methods, before.google.configured);
    if (problem) throw new ApiAuthError(problem, 409);

    await saveAuthMethods(service, methods);
    await writeAuditLog({
      actor: user,
      action: "auth.methods.update",
      targetCollection: "users",
      before: before.methods,
      after: methods,
    });
    return NextResponse.json({ success: true, methods });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się zapisać metod logowania.");
  }
}
