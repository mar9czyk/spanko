import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: {} as Record<string, unknown>,
  siblings: 0,
  deleted: [] as string[],
}));

vi.mock("@/lib/server/audit", () => ({ writeAuditLog: vi.fn() }));

vi.mock("pocketbase", () => ({
  default: class FakePocketBase {
    authStore = { save: vi.fn(), isValid: false };
    autoCancellation = vi.fn();
    filter = (raw: string) => raw;
    collection = (name: string) => ({
      authRefresh: async () => ({ record: state.user }),
      update: async () => state.user,
      getList: async () => ({ totalItems: state.siblings }),
      delete: async (id: string) => {
        state.deleted.push(`${name}/${id}`);
        return true;
      },
    });
  },
}));

import { DELETE } from "../route";

function deleteRequest(body: unknown, token: string | null = "t"): Request {
  return new Request("http://localhost/api/account", {
    method: "DELETE",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  });
}

describe("DELETE /api/account", () => {
  beforeEach(() => {
    state.user = {
      id: "u1",
      email: "Rodzic@Example.com",
      household_id: "h1",
      is_admin: false,
      last_seen_at: new Date().toISOString(),
    };
    state.siblings = 0;
    state.deleted = [];
  });

  it("zwraca 401 bez tokena", async () => {
    const response = await DELETE(deleteRequest({ confirmEmail: "x@y.z" }, null));
    expect(response.status).toBe(401);
  });

  it("odrzuca niezgodny e-mail i niczego nie usuwa", async () => {
    const response = await DELETE(deleteRequest({ confirmEmail: "inny@example.com" }));
    expect(response.status).toBe(400);
    expect(state.deleted).toEqual([]);
  });

  it("nie pozwala administratorowi usunąć własnego konta", async () => {
    state.user.is_admin = true;
    const response = await DELETE(deleteRequest({ confirmEmail: "rodzic@example.com" }));
    expect(response.status).toBe(409);
    expect(state.deleted).toEqual([]);
  });

  it("ostatni członek usuwa najpierw gospodarstwo, potem konto", async () => {
    const response = await DELETE(deleteRequest({ confirmEmail: "rodzic@example.com" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, householdDeleted: true });
    expect(state.deleted).toEqual(["households/h1", "users/u1"]);
  });

  it("zostawia gospodarstwo, gdy należy do niego drugi rodzic", async () => {
    state.siblings = 1;
    const response = await DELETE(deleteRequest({ confirmEmail: "rodzic@example.com" }));
    expect(await response.json()).toMatchObject({ householdDeleted: false });
    expect(state.deleted).toEqual(["users/u1"]);
  });
});
