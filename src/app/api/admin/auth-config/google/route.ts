import { NextResponse } from "next/server";
import { GoogleCredentialsSchema } from "@/lib/server/adminSchemas";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiAuthError, requireAdmin, requireServiceClient } from "@/lib/server/auth";
import { areGoogleCredentialsAccepted, saveGoogleCredentials } from "@/lib/server/authConfig";

/**
 * PUT /api/admin/auth-config/google — sprawdza klucze w Google i zapisuje je w PocketBase.
 * Sekret nie wraca do przeglądarki ani do dziennika działań.
 *
 * @param {Request} request - Żądanie HTTP z `{ clientId, clientSecret }`
 * @returns {Promise<NextResponse>} Potwierdzenie
 */
export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const { user } = await requireAdmin(request);
    const { clientId, clientSecret } = await parseJsonBody(request, GoogleCredentialsSchema);
    const service = await requireServiceClient();
    if (!(await areGoogleCredentialsAccepted(clientId, clientSecret))) {
      throw new ApiAuthError("Google odrzucił Client ID lub Client Secret.", 400);
    }

    await saveGoogleCredentials(service, clientId, clientSecret);
    await writeAuditLog({
      actor: user,
      action: "auth.google.set",
      targetCollection: "users",
      after: { clientId },
    });
    return NextResponse.json({ success: true, clientId });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się zapisać kluczy Google.");
  }
}
