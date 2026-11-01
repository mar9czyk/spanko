import { NextResponse } from "next/server";
import { DEFAULT_AUTH_METHODS } from "@/lib/authMethods";
import { getServiceClient } from "@/lib/server/auth";
import { loadAuthConfig } from "@/lib/server/authConfig";

/**
 * GET /api/auth/methods — publiczna lista metod logowania i rejestracji dla ekranów logowania.
 * Służy tylko do ukrycia przycisków; metody egzekwuje PocketBase, więc błąd odczytu pokazuje wszystkie.
 *
 * @returns {Promise<NextResponse>} Włączone metody
 */
export async function GET(): Promise<NextResponse> {
  let methods = DEFAULT_AUTH_METHODS;
  try {
    const service = await getServiceClient();
    if (service) methods = (await loadAuthConfig(service)).methods;
  } catch {
    methods = DEFAULT_AUTH_METHODS;
  }
  return NextResponse.json(methods, { headers: { "Cache-Control": "no-store" } });
}
