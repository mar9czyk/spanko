import { beforeEach, describe, expect, it, vi } from "vitest";

const pbState = vi.hoisted(() => ({
  result: { record: {} } as { record: Record<string, unknown> } | Error,
}));

vi.mock("pocketbase", () => ({
  default: class FakePocketBase {
    authStore = { save: vi.fn(), isValid: false };
    autoCancellation = vi.fn();
    collection = () => ({
      authRefresh: async () => {
        if (pbState.result instanceof Error) throw pbState.result;
        return pbState.result;
      },
    });
  },
}));

import { POST as sandboxPost } from "@/app/api/admin/sandbox/route";
import { PUT as settingsPut } from "@/app/api/admin/settings/route";
import {
  AdminSettingsUpdateSchema,
  AiCallsQuerySchema,
  HouseholdLimitPatchSchema,
  SandboxRequestSchema,
  UserDeleteSchema,
  UserPatchSchema,
} from "../adminSchemas";
import { DEFAULT_AI_DAILY_LIMIT_PER_HOUSEHOLD, resolveDailyAiLimit } from "../aiLimit";
import { ApiAuthError, authenticateRequest, requireAdmin, shouldTouchLastSeen } from "../auth";

function requestWithToken(token?: string, body: unknown = {}): Request {
  return new Request("http://localhost/api/admin/x", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  });
}

function mockUser(user: Record<string, unknown>) {
  pbState.result = { record: { id: "u1", ...user } };
}

describe("requireAdmin", () => {
  beforeEach(() => {
    pbState.result = { record: {} };
  });

  it("zwraca 401 bez tokena", async () => {
    await expect(requireAdmin(requestWithToken())).rejects.toMatchObject({ status: 401 });
  });

  it("zwraca 401 gdy token jest nieważny", async () => {
    pbState.result = new Error("invalid");
    await expect(requireAdmin(requestWithToken("bad"))).rejects.toMatchObject({ status: 401 });
  });

  it("zwraca 403 dla użytkownika bez is_admin", async () => {
    mockUser({ is_admin: false, household_id: "h1" });
    await expect(requireAdmin(requestWithToken("t"))).rejects.toMatchObject({ status: 403 });
  });

  it("przepuszcza admina nawet bez gospodarstwa", async () => {
    mockUser({ is_admin: true });
    const context = await requireAdmin(requestWithToken("t"));
    expect(context.user.is_admin).toBe(true);
  });

  it("authenticateRequest nadal wymaga gospodarstwa (403 dla admina bez household_id)", async () => {
    mockUser({ is_admin: true });
    await expect(authenticateRequest(requestWithToken("t"))).rejects.toBeInstanceOf(ApiAuthError);
  });
});

describe("endpointy admina", () => {
  beforeEach(() => {
    pbState.result = { record: {} };
  });

  it("sandbox zwraca 401 bez tokena i 403 dla zwykłego użytkownika", async () => {
    expect((await sandboxPost(requestWithToken())).status).toBe(401);
    mockUser({ is_admin: false, household_id: "h1" });
    expect((await sandboxPost(requestWithToken("t"))).status).toBe(403);
  });

  it("settings PUT zwraca 403 dla nie-admina", async () => {
    mockUser({ is_admin: false, household_id: "h1" });
    const response = await settingsPut(requestWithToken("t", { ai_daily_limit_per_household: 5 }));
    expect(response.status).toBe(403);
  });

  it("settings PUT zwraca 400 dla niepoprawnych danych admina", async () => {
    mockUser({ is_admin: true });
    const response = await settingsPut(requestWithToken("t", { ai_daily_limit_per_household: -1 }));
    expect(response.status).toBe(400);
  });

  it("settings PUT zwraca 400 dla niepoprawnej matrycy snu", async () => {
    mockUser({ is_admin: true });
    const response = await settingsPut(
      requestWithToken("t", { sleep_matrix_override_json: [{ minAgeDays: 5 }] }),
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("matryca");
  });
});

describe("schematy wejścia admina", () => {
  it("AdminSettingsUpdateSchema odrzuca nieznane pola i limity poza zakresem", () => {
    expect(AdminSettingsUpdateSchema.safeParse({ is_admin: true }).success).toBe(false);
    expect(AdminSettingsUpdateSchema.safeParse({ ai_daily_limit_per_household: 1.5 }).success).toBe(
      false,
    );
    expect(AdminSettingsUpdateSchema.safeParse({ ai_daily_limit_per_household: 25 }).success).toBe(
      true,
    );
  });

  it("SandboxRequestSchema ustawia domyślny wariant danych i odrzuca nieznany", () => {
    expect(SandboxRequestSchema.parse({}).sample).toBe("balanced");
    expect(SandboxRequestSchema.safeParse({ sample: "unknown" }).success).toBe(false);
  });

  it("AiCallsQuerySchema koryguje typy i ogranicza rozmiar strony", () => {
    expect(AiCallsQuerySchema.parse({ page: "2", perPage: "10" })).toMatchObject({
      page: 2,
      perPage: 10,
    });
    expect(AiCallsQuerySchema.safeParse({ perPage: "500" }).success).toBe(false);
    expect(AiCallsQuerySchema.safeParse({ status: "weird" }).success).toBe(false);
  });

  it("HouseholdLimitPatchSchema dopuszcza null (czyszczenie nadpisania)", () => {
    expect(
      HouseholdLimitPatchSchema.safeParse({ householdId: "h1", limitOverride: null }).success,
    ).toBe(true);
    expect(HouseholdLimitPatchSchema.safeParse({ householdId: "", limitOverride: 3 }).success).toBe(
      false,
    );
    expect(
      HouseholdLimitPatchSchema.safeParse({ householdId: "h1", limitOverride: -5 }).success,
    ).toBe(false);
  });
});

describe("resolveDailyAiLimit", () => {
  it("używa nadpisania gospodarstwa, potem limitu globalnego, potem domyślnego", () => {
    expect(resolveDailyAiLimit(5, 30)).toBe(5);
    expect(resolveDailyAiLimit(undefined, 30)).toBe(30);
    expect(resolveDailyAiLimit(null, undefined)).toBe(DEFAULT_AI_DAILY_LIMIT_PER_HOUSEHOLD);
  });

  it("traktuje 0 z PocketBase (niewypełnione pole liczbowe) jako brak wartości", () => {
    expect(resolveDailyAiLimit(0, 0)).toBe(DEFAULT_AI_DAILY_LIMIT_PER_HOUSEHOLD);
    expect(resolveDailyAiLimit(0, 12)).toBe(12);
  });
});

describe("blokada kont i znacznik aktywności", () => {
  beforeEach(() => {
    pbState.result = { record: {} };
  });

  it("zwraca 403 dla zablokowanego użytkownika (authenticateRequest i requireAdmin)", async () => {
    mockUser({ is_admin: true, is_blocked: true, household_id: "h1" });
    await expect(authenticateRequest(requestWithToken("t"))).rejects.toMatchObject({ status: 403 });
    await expect(requireAdmin(requestWithToken("t"))).rejects.toMatchObject({ status: 403 });
  });

  it("shouldTouchLastSeen odświeża brak wartości i wpisy starsze niż 15 min", () => {
    const now = Date.now();
    expect(shouldTouchLastSeen(undefined, now)).toBe(true);
    expect(shouldTouchLastSeen(new Date(now - 20 * 60_000).toISOString(), now)).toBe(true);
    expect(shouldTouchLastSeen(new Date(now - 5 * 60_000).toISOString(), now)).toBe(false);
  });
});

describe("schematy użytkowników", () => {
  it("UserPatchSchema wymaga co najmniej jednego pola i odrzuca nieznane", () => {
    expect(UserPatchSchema.safeParse({}).success).toBe(false);
    expect(UserPatchSchema.safeParse({ is_blocked: true }).success).toBe(true);
    expect(UserPatchSchema.safeParse({ email: "x@y.z" }).success).toBe(false);
  });

  it("UserDeleteSchema wymaga confirmEmail", () => {
    expect(UserDeleteSchema.safeParse({}).success).toBe(false);
    expect(UserDeleteSchema.safeParse({ confirmEmail: "a@b.pl" }).success).toBe(true);
  });
});
