import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "GOCSPX-super-secret";
const CLIENT_ID = "123-abc.apps.googleusercontent.com";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  writeAuditLog: vi.fn(),
  update: vi.fn(),
  collection: {} as Record<string, unknown>,
}));

vi.mock("@/lib/server/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/auth")>("@/lib/server/auth");
  return {
    ...actual,
    requireAdmin: mocks.requireAdmin,
    requireServiceClient: async () => ({
      collections: { getOne: async () => mocks.collection, update: mocks.update },
    }),
  };
});
vi.mock("@/lib/server/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));

import { ApiAuthError } from "@/lib/server/auth";
import { PUT as putGoogle } from "../google/route";
import { GET, PUT } from "../route";

const request = (body?: unknown) =>
  new Request("http://x/api/admin/auth-config", {
    method: body ? "PUT" : "GET",
    body: body ? JSON.stringify(body) : undefined,
  });
const toggles = (email: boolean, google: boolean) => ({ email, google });

describe("/api/admin/auth-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.collection = {
      createRule: "@request.body.is_admin:isset = false",
      passwordAuth: { enabled: true, identityFields: ["email"] },
      oauth2: { enabled: true, providers: [{ name: "google", clientId: CLIENT_ID }] },
    };
    mocks.requireAdmin.mockResolvedValue({ user: { id: "u1", is_admin: true } });
  });

  it("wymaga admina", async () => {
    mocks.requireAdmin.mockRejectedValue(new ApiAuthError("Brak.", 403));
    expect((await GET(request())).status).toBe(403);
    expect((await PUT(request({}))).status).toBe(403);
    expect((await putGoogle(request({}))).status).toBe(403);
  });

  it("GET zwraca stan i Client ID", async () => {
    const body = await (await GET(request())).json();
    expect(body.methods.login).toEqual(toggles(true, true));
    expect(body.google).toEqual({ configured: true, clientId: CLIENT_ID });
  });

  it("GET bez dostawcy pokazuje Google jako wyłączone, mimo oauth2.enabled", async () => {
    mocks.collection.oauth2 = { enabled: true, providers: [] };
    const body = await (await GET(request())).json();
    expect(body.methods.login.google).toBe(false);
    expect(body.methods.signup.google).toBe(false);
  });

  it("PUT odrzuca wyłączenie ostatniej metody i niczego nie zapisuje", async () => {
    const response = await PUT(
      request({ login: toggles(false, false), signup: toggles(false, true) }),
    );
    expect(response.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("PUT nie wysyła listy dostawców, więc klucze Google zostają", async () => {
    const response = await PUT(
      request({ login: toggles(true, true), signup: toggles(true, false) }),
    );
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith("users", {
      createRule: '@request.body.is_admin:isset = false && @request.context != "oauth2"',
      passwordAuth: { enabled: true, identityFields: ["email"] },
      oauth2: { enabled: true },
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledTimes(1);
  });

  it("zapis kluczy nie ujawnia sekretu w odpowiedzi ani w dzienniku", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "invalid_grant" }, { status: 400 })),
    );
    const response = await putGoogle(request({ clientId: CLIENT_ID, clientSecret: SECRET }));
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith("users", {
      oauth2: { providers: [{ name: "google", clientId: CLIENT_ID, clientSecret: SECRET }] },
    });
    expect(JSON.stringify(await response.json())).not.toContain(SECRET);
    expect(JSON.stringify(mocks.writeAuditLog.mock.calls)).not.toContain(SECRET);
  });

  it("nie zapisuje kluczy odrzuconych przez Google", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "invalid_client" }, { status: 401 })),
    );
    const response = await putGoogle(request({ clientId: CLIENT_ID, clientSecret: SECRET }));
    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("niedostępność Google nie blokuje zapisu kluczy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );
    expect((await putGoogle(request({ clientId: CLIENT_ID, clientSecret: SECRET }))).status).toBe(
      200,
    );
  });

  it("odrzuca Client ID o złym formacie", async () => {
    expect((await putGoogle(request({ clientId: "abc", clientSecret: SECRET }))).status).toBe(400);
  });
});
