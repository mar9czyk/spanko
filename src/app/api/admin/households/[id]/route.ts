import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiAuthError, requireAdmin, requireServiceClient } from "@/lib/server/auth";
import type { ChildRecord, HouseholdRecord, UserRecord } from "@/lib/types/database";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/households/[id] — szczegóły gospodarstwa: członkowie, dzieci i aktywny kod zaproszenia.
 * Każdy odczyt trafia do dziennika działań.
 *
 * @param {Request} request - Żądanie HTTP
 * @param {RouteContext} context - Parametry ścieżki
 * @returns {Promise<NextResponse>} Szczegóły gospodarstwa
 */
export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { user } = await requireAdmin(request);
    const { id } = await context.params;
    const service = await requireServiceClient();

    let household: HouseholdRecord;
    try {
      household = await service.collection("households").getOne<HouseholdRecord>(id);
    } catch {
      throw new ApiAuthError("Nie znaleziono gospodarstwa.", 404);
    }

    const [members, children] = await Promise.all([
      service.collection("users").getFullList<UserRecord>({
        filter: service.filter("household_id = {:id}", { id }),
      }),
      service.collection("children").getFullList<ChildRecord>({
        filter: service.filter("household_id = {:id}", { id }),
      }),
    ]);

    await writeAuditLog({
      actor: user,
      action: "household.view",
      targetCollection: "households",
      targetId: id,
    });

    const inviteActive =
      Boolean(household.invite_code) &&
      Boolean(household.invite_expires_at) &&
      new Date(household.invite_expires_at as string).getTime() > Date.now();

    return NextResponse.json({
      success: true,
      household: {
        id: household.id,
        name: household.name,
        created: household.created,
        invite: {
          code: household.invite_code || null,
          expiresAt: household.invite_expires_at || null,
          active: inviteActive,
        },
      },
      members: members.map((member) => ({
        id: member.id,
        email: member.email,
        name: member.name,
        is_admin: member.is_admin === true,
        is_blocked: member.is_blocked === true,
        last_seen_at: member.last_seen_at ?? null,
      })),
      children: children.map((child) => ({
        id: child.id,
        name: child.name,
        birth_date: child.birth_date,
        active_day_mode: child.active_day_mode,
      })),
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać szczegółów gospodarstwa.");
  }
}
