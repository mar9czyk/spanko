import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/server/apiResponse";
import { requireAdmin } from "@/lib/server/auth";
import { listMatrixVersions } from "@/lib/server/matrixVersions";

/**
 * GET /api/admin/matrix/versions — historia zapisanych wersji matrycy snu (od najnowszej).
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Lista wersji
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { pb } = await requireAdmin(request);
    return NextResponse.json({ success: true, items: await listMatrixVersions(pb) });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać historii matrycy.");
  }
}
