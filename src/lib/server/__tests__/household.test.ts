import type PocketBase from "pocketbase";
import { beforeEach, describe, expect, it } from "vitest";
import type { UserRecord } from "@/lib/types/database";
import {
  assertJoinAttemptsAllowed,
  createHouseholdWithChild,
  isPrematureDueDate,
  isValidInviteCodeShape,
  joinHousehold,
  MAX_FAILED_JOIN_ATTEMPTS,
  recordFailedJoinAttempt,
  resetJoinAttempts,
} from "../household";

const consented = { terms_accepted_at: "2026-10-31", health_consent_at: "2026-10-31" };
const baseUser = { id: "u1", ...consented } as unknown as UserRecord;

interface FakeState {
  households: Record<string, Record<string, unknown>>;
  children: Record<string, Record<string, unknown>>;
  userUpdates: Record<string, unknown>[];
  failChild: boolean;
  activeCode: string;
}

function fakeService(state: FakeState): PocketBase {
  let seq = 0;
  return {
    filter: (_raw: string, params: { code: string }) => params.code,
    collection: (name: string) => ({
      getFirstListItem: async (code: string) => {
        if (code !== state.activeCode) throw new Error("not found");
        return { id: "h1", name: "Rodzina Test" };
      },
      create: async (data: Record<string, unknown>) => {
        if (name === "children" && state.failChild) throw new Error("boom");
        const id = `${name}-${++seq}`;
        (name === "households" ? state.households : state.children)[id] = data;
        return { id, ...data };
      },
      update: async (_id: string, data: Record<string, unknown>) => {
        state.userUpdates.push(data);
        return data;
      },
      delete: async (id: string) => {
        delete state.households[id];
        delete state.children[id];
      },
    }),
  } as unknown as PocketBase;
}

let state: FakeState;
beforeEach(() => {
  resetJoinAttempts();
  state = { households: {}, children: {}, userUpdates: [], failChild: false, activeCode: "ABC234" };
});

describe("joinHousehold", () => {
  it("dołącza z poprawnym kodem (normalizacja wielkości liter i spacji)", async () => {
    const household = await joinHousehold(fakeService(state), baseUser, " abc-234 ");
    expect(household.id).toBe("h1");
    expect(state.userUpdates).toEqual([{ household_id: "h1" }]);
  });
  it("odrzuca zły lub wygasły kod (404)", async () => {
    await expect(joinHousehold(fakeService(state), baseUser, "ZZZZZZ")).rejects.toMatchObject({
      status: 404,
    });
    await expect(joinHousehold(fakeService(state), baseUser, "BAD")).rejects.toMatchObject({
      status: 404,
    });
    expect(state.userUpdates).toHaveLength(0);
  });
  it("odrzuca użytkownika, który ma już rodzinę (409)", async () => {
    const user = { ...baseUser, household_id: "x" } as UserRecord;
    await expect(joinHousehold(fakeService(state), user, "ABC234")).rejects.toMatchObject({
      status: 409,
    });
  });
  it("wymaga zgód (403)", async () => {
    const user = { id: "u1" } as UserRecord;
    await expect(joinHousehold(fakeService(state), user, "ABC234")).rejects.toMatchObject({
      status: 403,
    });
  });
  it("blokuje zgadywanie kodów (429)", async () => {
    for (let i = 0; i < MAX_FAILED_JOIN_ATTEMPTS; i++) recordFailedJoinAttempt("u1");
    expect(() => assertJoinAttemptsAllowed("u1")).toThrow();
    await expect(joinHousehold(fakeService(state), baseUser, "ABC234")).rejects.toMatchObject({
      status: 429,
    });
  });
});

describe("createHouseholdWithChild", () => {
  const input = {
    childName: "Lena",
    birthDate: "2026-08-01",
    timezone: "Europe/Warsaw",
    locale: "pl" as const,
  };
  it("tworzy rodzinę z dzieckiem i przypisuje użytkownika", async () => {
    const household = await createHouseholdWithChild(fakeService(state), baseUser, input);
    expect(household.name).toBe("Rodzina Lena");
    expect(Object.values(state.children)).toHaveLength(1);
    expect(state.userUpdates).toEqual([{ household_id: household.id }]);
  });
  it("cofa zmiany, gdy zapis dziecka się nie uda", async () => {
    state.failChild = true;
    await expect(createHouseholdWithChild(fakeService(state), baseUser, input)).rejects.toThrow(
      "boom",
    );
    expect(Object.keys(state.households)).toHaveLength(0);
  });
  it("zapisuje termin porodu tylko dla wcześniaka (>= 3 tyg.)", async () => {
    await createHouseholdWithChild(fakeService(state), baseUser, {
      ...input,
      dueDate: "2026-08-05",
    });
    expect(Object.values(state.children)[0]).not.toHaveProperty("due_date");
    expect(isPrematureDueDate("2026-08-01", "2026-08-25")).toBe(true);
  });
});

describe("isValidInviteCodeShape", () => {
  it("akceptuje 6 znaków z alfabetu i odrzuca mylące", () => {
    expect(isValidInviteCodeShape("ABC234")).toBe(true);
    expect(isValidInviteCodeShape("ABC0O1")).toBe(false);
    expect(isValidInviteCodeShape("ABC23")).toBe(false);
  });
});
