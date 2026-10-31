import { NextResponse } from "next/server";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { requireServiceClient, requireUser } from "@/lib/server/auth";
import {
  assertCanOnboard,
  assertJoinAttemptsAllowed,
  findHouseholdByActiveCode,
  JoinHouseholdSchema,
  joinHousehold,
  normalizeInviteCode,
  recordFailedJoinAttempt,
} from "@/lib/server/household";

/**
 * GET /api/household/join?code= — podgląd rodziny przed dołączeniem (tylko nazwa).
 *
 * @param {Request} request - Żądanie z kodem w query
 * @returns {Promise<NextResponse>} Nazwa rodziny
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { user } = await requireUser(request);
    assertCanOnboard(user);
    assertJoinAttemptsAllowed(user.id);
    const code = normalizeInviteCode(new URL(request.url).searchParams.get("code") ?? "");
    const service = await requireServiceClient();
    try {
      const household = await findHouseholdByActiveCode(service, code);
      return NextResponse.json({ success: true, householdName: household.name });
    } catch (error) {
      recordFailedJoinAttempt(user.id);
      throw error;
    }
  } catch (error) {
    return toErrorResponse(error, "Nie udało się sprawdzić kodu.");
  }
}

/**
 * POST /api/household/join — dołącza zalogowanego rodzica do rodziny po kodzie zaproszenia.
 *
 * @param {Request} request - Ciało z polem `code`
 * @returns {Promise<NextResponse>} Dołączona rodzina
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { user } = await requireUser(request);
    const { code } = await parseJsonBody(request, JoinHouseholdSchema);
    const service = await requireServiceClient();
    const household = await joinHousehold(service, user, code);
    return NextResponse.json({ success: true, householdName: household.name });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się dołączyć do rodziny.");
  }
}
