import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  records: [] as Record<string, unknown>[],
  audit: [] as unknown[],
}));

vi.mock("@/lib/server/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/auth")>("@/lib/server/auth");
  const service = {
    filter: (expression: string) => expression,
    collection: () => ({
      getList: async () => ({ items: state.records.slice(0, 1) }),
      create: async (data: Record<string, unknown>) => {
        const record = { id: "rec1", updated: "2026-10-22T10:00:00Z", ...data };
        state.records = [record];
        return record;
      },
      update: async (id: string, data: Record<string, unknown>) => {
        const record = { ...state.records[0], id, ...data };
        state.records = [record];
        return record;
      },
      delete: async () => {
        state.records = [];
      },
    }),
  };
  return { ...actual, getServiceClient: vi.fn().mockResolvedValue(service) };
});

import {
  invalidateOpenRouterKeyCache,
  pickOpenRouterKey,
  resolveOpenRouterKey,
  storeOpenRouterKey,
  validateOpenRouterKey,
} from "../openrouterKey";
import { decryptSecret } from "../secrets";

const KEY = "sk-or-v1-abcdef0123456789a1b2";

describe("openrouterKey", () => {
  beforeEach(() => {
    state.records = [];
    invalidateOpenRouterKeyCache();
    vi.unstubAllEnvs();
  });

  it("pickOpenRouterKey: panel > env > brak", () => {
    expect(pickOpenRouterKey("p", "e")).toEqual({ key: "p", source: "panel" });
    expect(pickOpenRouterKey(undefined, " e ").source).toBe("env");
    expect(pickOpenRouterKey(" ", "").source).toBe("none");
  });

  it("zapisuje szyfrogram (nie klucz) i odczytuje go jako źródło „panel”", async () => {
    const master = randomBytes(32);
    vi.stubEnv("SPANKO_SECRETS_KEY", master.toString("base64"));
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-from-env-0000000000");

    const record = await storeOpenRouterKey(KEY, "user1", "a1b2");
    expect(JSON.stringify(record)).not.toContain(KEY);
    expect(decryptSecret("openrouter_api_key", record.ciphertext, master)).toBe(KEY);

    const resolved = await resolveOpenRouterKey();
    expect(resolved).toMatchObject({ key: KEY, source: "panel" });
  });

  it("brak mastera przy zapisanym kluczu → zapas z env + opis problemu", async () => {
    const master = randomBytes(32);
    vi.stubEnv("SPANKO_SECRETS_KEY", master.toString("base64"));
    await storeOpenRouterKey(KEY, "user1", "a1b2");
    vi.stubEnv("SPANKO_SECRETS_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-from-env-0000000000");
    invalidateOpenRouterKeyCache();

    const resolved = await resolveOpenRouterKey();
    expect(resolved.source).toBe("env");
    expect(resolved.panelError).toContain("SPANKO_SECRETS_KEY");
  });

  it("zły master → nie zwraca śmieci, tylko zapas", async () => {
    vi.stubEnv("SPANKO_SECRETS_KEY", randomBytes(32).toString("base64"));
    await storeOpenRouterKey(KEY, "user1", "a1b2");
    vi.stubEnv("SPANKO_SECRETS_KEY", randomBytes(32).toString("base64"));
    vi.stubEnv("OPENROUTER_API_KEY", "");
    invalidateOpenRouterKeyCache();

    const resolved = await resolveOpenRouterKey();
    expect(resolved.source).toBe("none");
    expect(resolved.key).toBeUndefined();
    expect(resolved.panelError).toBeTruthy();
  });

  it("validateOpenRouterKey: 200/403 ok, 401 odrzucony, 500 i brak sieci to „unreachable”", async () => {
    const respond = (status: number) =>
      vi.fn().mockResolvedValue(new Response("{}", { status })) as unknown as typeof fetch;
    expect((await validateOpenRouterKey(KEY, respond(200))).ok).toBe(true);
    expect((await validateOpenRouterKey(KEY, respond(403))).ok).toBe(true);
    expect(await validateOpenRouterKey(KEY, respond(401))).toMatchObject({
      ok: false,
      reason: "invalid",
    });
    expect(await validateOpenRouterKey(KEY, respond(500))).toMatchObject({ reason: "unreachable" });
    const failing = vi.fn().mockRejectedValue(new Error("net")) as unknown as typeof fetch;
    expect(await validateOpenRouterKey(KEY, failing)).toMatchObject({ reason: "unreachable" });
  });
});
