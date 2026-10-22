import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "sk-or-v1-abcdef0123456789a1b2";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  writeAuditLog: vi.fn(),
  validate: vi.fn(),
  store: vi.fn(),
  record: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/server/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/auth")>("@/lib/server/auth");
  return { ...actual, requireAdmin: mocks.requireAdmin };
});
vi.mock("@/lib/server/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/server/openrouterKey", () => ({
  validateOpenRouterKey: mocks.validate,
  storeOpenRouterKey: mocks.store,
  deleteOpenRouterKey: vi.fn(),
  fetchOpenRouterSecretRecord: async () => mocks.record,
  resolveOpenRouterKey: async () => ({ key: KEY, source: "panel" }),
}));

import { ApiAuthError } from "@/lib/server/auth";
import { GET, PUT } from "../route";

const put = (apiKey: string) =>
  PUT(
    new Request("http://x/api/admin/openrouter/key", {
      method: "PUT",
      body: JSON.stringify({ apiKey }),
    }),
  );

describe("/api/admin/openrouter/key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SPANKO_SECRETS_KEY", randomBytes(32).toString("base64"));
    mocks.record = {
      id: "r1",
      key_suffix: "a1b2",
      updated: "2026-10-22T10:00:00Z",
      ciphertext: "v1:secret",
    };
    mocks.requireAdmin.mockResolvedValue({
      pb: { collection: () => ({ getOne: async () => ({ email: "a@b.pl" }) }) },
      user: { id: "u1", email: "a@b.pl", is_admin: true },
    });
  });

  it("GET nie zwraca klucza ani szyfrogramu", async () => {
    const body = JSON.stringify(await (await GET(new Request("http://x"))).json());
    expect(body).toContain("a1b2");
    expect(body).not.toContain(KEY);
    expect(body).not.toContain("v1:secret");
  });

  it("wymaga admina", async () => {
    mocks.requireAdmin.mockRejectedValue(
      new ApiAuthError("Wymagane uprawnienia administratora.", 403),
    );
    expect((await GET(new Request("http://x"))).status).toBe(403);
    expect((await put(KEY)).status).toBe(403);
  });

  it("PUT nie zapisuje klucza odrzuconego przez OpenRouter", async () => {
    mocks.validate.mockResolvedValue({ ok: false, reason: "invalid", message: "odrzucony" });
    const response = await put(KEY);
    expect(response.status).toBe(400);
    expect(mocks.store).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("PUT bez SPANKO_SECRETS_KEY zwraca 503 z instrukcją", async () => {
    vi.stubEnv("SPANKO_SECRETS_KEY", "");
    const response = await put(KEY);
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("SPANKO_SECRETS_KEY");
    expect(mocks.validate).not.toHaveBeenCalled();
  });

  it("PUT zapisuje po udanym teście, a audyt zawiera tylko końcówkę", async () => {
    mocks.validate.mockResolvedValue({ ok: true });
    mocks.store.mockResolvedValue({ id: "r1", updated: "2026-10-22T10:00:00Z" });
    const response = await put(KEY);
    expect(response.status).toBe(200);
    expect(mocks.store).toHaveBeenCalledWith(KEY, "u1", "a1b2");
    expect(mocks.writeAuditLog).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mocks.writeAuditLog.mock.calls)).not.toContain(KEY);
    expect(JSON.stringify(await response.json())).not.toContain(KEY);
  });

  it("odrzuca klucz o złym formacie", async () => {
    expect((await put("not-a-key-at-all-not-a-key")).status).toBe(400);
  });
});
