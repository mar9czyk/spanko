import { NextResponse } from "next/server";
import { UserDeleteSchema } from "@/lib/server/adminSchemas";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiAuthError, requireUser } from "@/lib/server/auth";

/**
 * DELETE /api/account — rodzic usuwa własne konto (RODO); wymaga `confirmEmail` zgodnego z kontem.
 *
 * @description
 * Gdy rodzic jest ostatnim członkiem gospodarstwa, najpierw usuwane jest gospodarstwo (kaskadowo
 * dzieci i ich dane) — jego własnym tokenem, więc nie trzeba konta serwisowego. Konto admina
 * usuwa się w panelu admina (inny administrator), żeby nie zostawić aplikacji bez admina.
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Potwierdzenie usunięcia
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const { pb, user } = await requireUser(request);
    const body = await parseJsonBody(request, UserDeleteSchema);

    if (body.confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
      throw new ApiAuthError("Podany e-mail nie zgadza się z kontem do usunięcia.", 400);
    }
    if (user.is_admin === true) {
      throw new ApiAuthError(
        "Konto administratora może usunąć tylko inny administrator w panelu admina.",
        409,
      );
    }

    let householdDeleted = false;
    const householdId = user.household_id;
    if (householdId) {
      const siblings = await pb.collection("users").getList(1, 1, {
        filter: pb.filter("household_id = {:householdId} && id != {:id}", {
          householdId,
          id: user.id,
        }),
      });
      if (siblings.totalItems === 0) {
        await pb.collection("households").delete(householdId);
        householdDeleted = true;
      }
    }

    await pb.collection("users").delete(user.id);

    await writeAuditLog({
      actor: user,
      action: "user.self_delete",
      targetCollection: "users",
      targetId: user.id,
      before: { email: user.email, household_id: householdId ?? null },
      after: { householdDeleted },
    });
    return NextResponse.json({ success: true, householdDeleted });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się usunąć konta.");
  }
}
