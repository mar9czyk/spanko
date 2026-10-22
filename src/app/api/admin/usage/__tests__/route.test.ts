import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn() }));

vi.mock("@/lib/server/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/auth")>("@/lib/server/auth");
  const service = {
    filter: (expression: string) => expression,
    collection: () => ({ getFullList: async () => [], getOne: async () => null }),
  };
  return {
    ...actual,
    requireAdmin: mocks.requireAdmin,
    requireServiceClient: async () => service,
  };
});

import { ApiAuthError } from "@/lib/server/auth";
import { GET } from "../route";

describe("GET /api/admin/usage", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockResolvedValue({ pb: {}, user: { id: "a", is_admin: true } });
  });

  it("wymaga admina", async () => {
    mocks.requireAdmin.mockRejectedValue(
      new ApiAuthError("Wymagane uprawnienia administratora.", 403),
    );
    expect((await GET(new Request("http://x/api/admin/usage"))).status).toBe(403);
  });

  it("domyślnie 7 dni, odrzuca niedozwolony okres", async () => {
    const ok = await GET(new Request("http://x/api/admin/usage"));
    expect(ok.status).toBe(200);
    expect((await ok.json()).days).toBe(7);
    expect((await GET(new Request("http://x/api/admin/usage?days=5"))).status).toBe(400);
  });
});
