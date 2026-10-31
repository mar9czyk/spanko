import { NextResponse } from "next/server";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { requireServiceClient, requireUser } from "@/lib/server/auth";
import { CreateHouseholdSchema, createHouseholdWithChild } from "@/lib/server/household";

/**
 * POST /api/household — zakłada rodzinę z pierwszym dzieckiem dla zalogowanego rodzica.
 *
 * @description
 * Wymaga zgód (regulamin + dane o zdrowiu dziecka) i braku istniejącej rodziny. Zapisy robi konto
 * serwisowe, bo użytkownik nie może sam ustawić `household_id` (reguła `users.updateRule`).
 *
 * @param {Request} request - Dane dziecka i rodziny
 * @returns {Promise<NextResponse>} Utworzone gospodarstwo z kodem zaproszenia
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { user } = await requireUser(request);
    const input = await parseJsonBody(request, CreateHouseholdSchema);
    const service = await requireServiceClient();
    const household = await createHouseholdWithChild(service, user, input);
    return NextResponse.json({ success: true, household }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się założyć rodziny.");
  }
}
