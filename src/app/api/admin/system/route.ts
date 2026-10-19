import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/server/apiResponse";
import { getServiceClient, requireAdmin, resolveServerPocketBaseUrl } from "@/lib/server/auth";
import packageJson from "../../../../../package.json";

const HEALTH_TIMEOUT_MS = 4000;

/**
 * Sprawdza `/api/health` PocketBase.
 *
 * @returns {Promise<{ ok: boolean; message: string }>} Stan zdrowia
 */
async function checkPocketBaseHealth(): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(`${resolveServerPocketBaseUrl()}/api/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      cache: "no-store",
    });
    return { ok: response.ok, message: response.ok ? "healthy" : `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "niedostępny" };
  }
}

/**
 * GET /api/admin/system — wersja aplikacji, stan PocketBase, konfiguracja serwera i kopie zapasowe.
 *
 * @description
 * Nie ujawnia wartości sekretów — tylko informację, czy zmienne są ustawione. Lista kopii wymaga
 * konta serwisowego (superusera).
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Stan systemu
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const [health, service] = await Promise.all([checkPocketBaseHealth(), getServiceClient()]);

    let backups: { key: string; size: number; modified: string }[] | null = null;
    if (service) {
      try {
        const files = await service.backups.getFullList();
        backups = files
          .map((file) => ({ key: file.key, size: file.size, modified: file.modified }))
          .sort((a, b) => b.modified.localeCompare(a.modified));
      } catch {
        backups = null;
      }
    }

    return NextResponse.json({
      success: true,
      app: { name: packageJson.name, version: packageJson.version, node: process.version },
      pocketbase: { url: resolveServerPocketBaseUrl(), ...health },
      config: {
        serviceAccount: Boolean(service),
        openRouterKey: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
      },
      backups,
      lastBackupAt: backups?.[0]?.modified ?? null,
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać stanu systemu.");
  }
}
