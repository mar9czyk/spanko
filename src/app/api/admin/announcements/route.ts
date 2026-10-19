import { NextResponse } from "next/server";
import { AnnouncementCreateSchema } from "@/lib/server/adminSchemasSupport";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";

interface AnnouncementRecord {
  readonly id: string;
  readonly message: string;
  readonly level: "info" | "warning";
  readonly starts_at?: string;
  readonly ends_at?: string;
  readonly active: boolean;
  readonly created: string;
}

/**
 * GET /api/admin/announcements — wszystkie ogłoszenia (także nieaktywne i wygasłe).
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Lista ogłoszeń
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { pb } = await requireAdmin(request);
    const items = await pb
      .collection("announcements")
      .getFullList<AnnouncementRecord>({ sort: "-created" });
    return NextResponse.json({ success: true, items });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać ogłoszeń.");
  }
}

/**
 * POST /api/admin/announcements — tworzy ogłoszenie widoczne jako baner dla zalogowanych użytkowników.
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Utworzone ogłoszenie
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { pb, user } = await requireAdmin(request);
    const body = await parseJsonBody(request, AnnouncementCreateSchema);
    const created = await pb.collection("announcements").create<AnnouncementRecord>({
      message: body.message,
      level: body.level,
      starts_at: body.starts_at ?? "",
      ends_at: body.ends_at ?? "",
      active: body.active,
    });
    await writeAuditLog({
      actor: user,
      action: "announcement.create",
      targetCollection: "announcements",
      targetId: created.id,
      after: { message: body.message, level: body.level, active: body.active },
    });
    return NextResponse.json({ success: true, item: created });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się utworzyć ogłoszenia.");
  }
}
