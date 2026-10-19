import { NextResponse } from "next/server";
import { FeatureFlagCreateSchema } from "@/lib/server/adminSchemasSupport";
import { parseJsonBody, toErrorResponse } from "@/lib/server/apiResponse";
import { writeAuditLog } from "@/lib/server/audit";
import { ApiAuthError, requireAdmin } from "@/lib/server/auth";
import { invalidateFeatureFlagsCache } from "@/lib/server/featureFlags";

interface FeatureFlagRecord {
  readonly id: string;
  readonly key: string;
  readonly enabled: boolean;
  readonly rollout_household_ids?: unknown;
  readonly description?: string;
}

/**
 * GET /api/admin/feature-flags — lista przełączników funkcji.
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Lista flag
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { pb } = await requireAdmin(request);
    const items = await pb
      .collection("feature_flags")
      .getFullList<FeatureFlagRecord>({ sort: "key" });
    return NextResponse.json({ success: true, items });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się pobrać przełączników.");
  }
}

/**
 * POST /api/admin/feature-flags — tworzy flagę (klucz musi być unikalny).
 *
 * @param {Request} request - Żądanie HTTP
 * @returns {Promise<NextResponse>} Utworzona flaga
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { pb, user } = await requireAdmin(request);
    const body = await parseJsonBody(request, FeatureFlagCreateSchema);

    const duplicate = await pb
      .collection("feature_flags")
      .getList(1, 1, { filter: pb.filter("key = {:key}", { key: body.key }) });
    if (duplicate.totalItems > 0) {
      throw new ApiAuthError("Flaga o takim kluczu już istnieje.", 409);
    }

    const created = await pb.collection("feature_flags").create<FeatureFlagRecord>({
      key: body.key,
      enabled: body.enabled,
      rollout_household_ids: body.rollout_household_ids,
      description: body.description ?? "",
    });
    invalidateFeatureFlagsCache();
    await writeAuditLog({
      actor: user,
      action: "feature_flag.create",
      targetCollection: "feature_flags",
      targetId: created.id,
      after: { key: body.key, enabled: body.enabled },
    });
    return NextResponse.json({ success: true, item: created });
  } catch (error) {
    return toErrorResponse(error, "Nie udało się utworzyć przełącznika.");
  }
}
