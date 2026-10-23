import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ failure: null as unknown }));

vi.mock("@/lib/dev-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dev-auth")>()),
  isDevLoginEnabled: () => true,
}));

vi.mock("pocketbase", () => {
  class ClientResponseError extends Error {
    constructor(readonly status: number) {
      super(`HTTP ${status}`);
    }
  }
  class FakePocketBase {
    collection = () => ({
      authWithPassword: async () => {
        if (state.failure) throw state.failure;
        return { token: "tok", record: { id: "u1" } };
      },
    });
  }
  return { default: FakePocketBase, ClientResponseError };
});

import { ClientResponseError } from "pocketbase";
import { POST } from "../route";

function loginRequest(): Request {
  return new Request("http://localhost/api/dev/login", {
    method: "POST",
    body: JSON.stringify({ role: "user" }),
  });
}

describe("POST /api/dev/login", () => {
  beforeEach(() => {
    state.failure = null;
    process.env.DEV_USER_EMAIL = "dev@spanko.test";
    process.env.DEV_USER_PASSWORD = "x";
  });

  it("zwraca token po poprawnym logowaniu", async () => {
    const response = await POST(loginRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ token: "tok" });
  });

  it("loguje rolę rodziny danymi z jej prefiksu", async () => {
    process.env.DEV_FAMILY_TODDLER_EMAIL = "maluch@spanko.test";
    process.env.DEV_FAMILY_TODDLER_PASSWORD = "y";
    const response = await POST(
      new Request("http://localhost/api/dev/login", {
        method: "POST",
        body: JSON.stringify({ role: "family-toddler" }),
      }),
    );
    expect(response.status).toBe(200);
  });

  it("zwraca 401 z podpowiedzią dev:seed, gdy PocketBase odrzuci dane logowania", async () => {
    state.failure = new (ClientResponseError as unknown as new (status: number) => Error)(400);
    const response = await POST(loginRequest());
    expect(response.status).toBe(401);
    expect((await response.json()).error).toContain("dev:seed");
  });

  it("zwraca 503 z informacją o niedziałającym PocketBase, a nie mylący 401", async () => {
    state.failure = new TypeError("fetch failed");
    const response = await POST(loginRequest());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("PocketBase nie odpowiada");
  });

  it("traktuje status 0 (brak połączenia w SDK) jak niedziałający PocketBase", async () => {
    state.failure = new (ClientResponseError as unknown as new (status: number) => Error)(0);
    expect((await POST(loginRequest())).status).toBe(503);
  });
});
