import { NextResponse } from "next/server";
import type PocketBase from "pocketbase";
import { checkAdminDemotion } from "@/lib/admin/stats";
import { UserDeleteSchema, UserPatchSchema } from "@/lib/server/adminSchemas";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiAuthError, getServiceClient, requireAdmin } from "@/lib/server/auth";
import type { UserRecord } from "@/lib/types/database";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

/**
 * Zlicza administratorów (do ochrony przed odebraniem uprawnień ostatniemu z nich).
 *
 * @param {PocketBase} pb - Klient admina
 * @returns {Promise<number>} Liczba kont z is_admin = true
 */
async function countAdmins(pb: PocketBase): Promise<number> {
  const result = await pb.collection("users").getList(1, 1, { filter: "is_admin = true" });
  return result.totalItems;
}

/**
 * PATCH /api/admin/users/[id] — zmiana roli admina, blokady konta lub przypisania do gospodarstwa.
 *
 * @param {Request} request - Żądanie HTTP
 * @param {RouteContext} context - Parametry ścieżki
 * @returns {Promise<NextResponse>} Zaktualizowany użytkownik
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { pb, user: actor } = await requireAdmin(request);
    const { id } = await context.params;
    const body = await parseJsonBody(request, UserPatchSchema);
    const target = await pb.collection("users").getOne<UserRecord>(id);

    if (body.is_admin !== undefined) {
      const conflict = checkAdminDemotion({
        actorId: actor.id,
        targetId: target.id,
        targetIsAdmin: target.is_admin === true,
        adminCount: await countAdmins(pb),
        nextIsAdmin: body.is_admin,
      });
      if (conflict) throw new ApiAuthError(conflict, 409);
    }
    if (body.is_blocked === true && actor.id === target.id) {
      throw new ApiAuthError("Nie możesz zablokować własnego konta.", 409);
    }

    const update: Record<string, unknown> = {};
    if (body.is_admin !== undefined) update.is_admin = body.is_admin;
    if (body.is_blocked !== undefined) update.is_blocked = body.is_blocked;
    if (body.household_id !== undefined) update.household_id = body.household_id ?? "";

    const saved = await pb.collection("users").update<UserRecord>(id, update);
    const action =
      body.is_admin !== undefined
        ? "user.set_admin"
        : body.is_blocked !== undefined
          ? "user.set_blocked"
          : "user.set_household";
    await writeAuditLog({
      actor,
      action,
      targetCollection: "users",
      targetId: id,
      before: {
        email: target.email,
        is_admin: target.is_admin === true,
        is_blocked: target.is_blocked === true,
        household_id: target.household_id ?? null,
      },
      after: update,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: saved.id,
        is_admin: saved.is_admin === true,
        is_blocked: saved.is_blocked === true,
        household_id: saved.household_id ?? null,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się zaktualizować użytkownika.");
  }
}

/**
 * DELETE /api/admin/users/[id] — usunięcie konta (RODO); wymaga `confirmEmail` zgodnego z kontem.
 *
 * @description
 * Gdy usuwany użytkownik był ostatnim członkiem gospodarstwa, gospodarstwo (a kaskadowo dzieci
 * i ich dane) jest usuwane kontem serwisowym.
 *
 * @param {Request} request - Żądanie HTTP
 * @param {RouteContext} context - Parametry ścieżki
 * @returns {Promise<NextResponse>} Potwierdzenie usunięcia
 */
export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { pb, user: actor } = await requireAdmin(request);
    const { id } = await context.params;
    const body = await parseJsonBody(request, UserDeleteSchema);
    const target = await pb.collection("users").getOne<UserRecord>(id);

    if (body.confirmEmail.toLowerCase() !== target.email.toLowerCase()) {
      throw new ApiAuthError("Podany e-mail nie zgadza się z kontem do usunięcia.", 400);
    }
    if (actor.id === target.id) {
      throw new ApiAuthError("Nie możesz usunąć własnego konta z panelu admina.", 409);
    }
    const conflict = checkAdminDemotion({
      actorId: actor.id,
      targetId: target.id,
      targetIsAdmin: target.is_admin === true,
      adminCount: await countAdmins(pb),
      nextIsAdmin: false,
    });
    if (conflict) throw new ApiAuthError(conflict, 409);

    let householdDeleted = false;
    const householdId = target.household_id;
    const siblings = householdId
      ? await pb.collection("users").getList(1, 1, {
          filter: pb.filter("household_id = {:householdId} && id != {:id}", {
            householdId,
            id: target.id,
          }),
        })
      : null;

    await pb.collection("users").delete(id);

    if (householdId && siblings?.totalItems === 0) {
      const service = await getServiceClient();
      if (service) {
        await service.collection("households").delete(householdId);
        householdDeleted = true;
      }
    }

    await writeAuditLog({
      actor,
      action: "user.delete",
      targetCollection: "users",
      targetId: id,
      before: { email: target.email, household_id: householdId ?? null },
      after: { householdDeleted },
    });
    return NextResponse.json({ success: true, householdDeleted });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się usunąć użytkownika.");
  }
}
