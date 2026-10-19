import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { requireAdmin, requireServiceClient } from "@/lib/server/auth";

/**
 * Buduje nazwę pliku kopii: `spanko-YYYYMMDD-HHmmss.zip` (UTC).
 *
 * @param {Date} now - Bieżący czas
 * @returns {string} Nazwa pliku kopii
 */
export function buildBackupName(now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  return `spanko-${stamp}.zip`;
}

/**
 * POST /api/admin/system/backup — tworzy kopię zapasową PocketBase (API backupów, konto serwisowe).
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Nazwa utworzonej kopii
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { user } = await requireAdmin(request);
    const service = await requireServiceClient();
    const name = buildBackupName(new Date());
    await service.backups.create(name);
    await writeAuditLog({
      actor: user,
      action: "system.backup",
      targetCollection: "backups",
      targetId: name,
    });
    return NextResponse.json({ success: true, name });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się utworzyć kopii zapasowej.");
  }
}
