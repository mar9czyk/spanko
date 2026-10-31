import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({ authenticateRequest: vi.fn() }));

vi.mock("@/lib/server/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/auth")>("@/lib/server/auth");
  return {
    ...actual,
    authenticateRequest: authMock.authenticateRequest,
    getServiceClient: vi.fn().mockResolvedValue(null),
  };
});

import { ApiAuthError } from "@/lib/server/auth";
import { POST as correctInsightPost } from "../correct-insight/route";
import { POST as evaluateInsightsPost } from "../evaluate-insights/route";

const HOUSEHOLD_ID = "household_a";
const NOW = new Date().toISOString();

const CHILD = {
  id: "child_test_123",
  household_id: HOUSEHOLD_ID,
  name: "Tymon",
  birth_date: new Date(Date.now() - 150 * 86_400_000).toISOString(),
  active_day_mode: "home",
  anti_orthosomnia_mode: false,
  created: NOW,
  updated: NOW,
};

const EXISTING_INSIGHT = {
  id: "insight_abc",
  child_id: CHILD.id,
  category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
  diagnosis_code: "OVERTIRED_FUSS",
  status: "active",
  title: "Wniosek",
  explanation: "Opis",
  created: NOW,
  updated: NOW,
};

interface FakeStore {
  child: typeof CHILD | null;
  insightsCount: number;
  householdLimitOverride?: number;
  insightStatus?: string;
  creates: Record<string, unknown>[];
  updates: { collection: string; id: string; data: Record<string, unknown> }[];
}

function createFakePocketBase(store: FakeStore) {
  return {
    filter: (expression: string) => expression,
    collection: (name: string) => ({
      getOne: async (id: string) => {
        if (name === "children" && store.child && store.child.id === id) return store.child;
        if (name === "child_insights" && id === EXISTING_INSIGHT.id) {
          return { ...EXISTING_INSIGHT, status: store.insightStatus ?? EXISTING_INSIGHT.status };
        }
        if (name === "households" && id === HOUSEHOLD_ID) {
          return { id, name: "Dom", ai_daily_limit_override: store.householdLimitOverride };
        }
        throw new Error("not found");
      },
      getList: async () => {
        if (name === "child_insights") {
          return { items: [], totalItems: store.insightsCount };
        }
        return { items: [], totalItems: 0 };
      },
      create: async (data: Record<string, unknown>) => {
        store.creates.push(data);
        return { ...data, id: "insight_new", created: NOW, updated: NOW };
      },
      update: async (id: string, data: Record<string, unknown>) => {
        store.updates.push({ collection: name, id, data });
        return { ...EXISTING_INSIGHT, ...data, id };
      },
    }),
  };
}

function authenticateAs(store: FakeStore, householdId = HOUSEHOLD_ID) {
  authMock.authenticateRequest.mockResolvedValue({
    pb: createFakePocketBase(store),
    user: { id: "user_1", household_id: householdId, ai_consent: true },
  });
}

function postRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { authorization: "Bearer test-token" },
    body: JSON.stringify(body),
  });
}

describe("AI Route Handlers", () => {
  let store: FakeStore;

  beforeEach(() => {
    store = { child: CHILD, insightsCount: 0, creates: [], updates: [] };
    authMock.authenticateRequest.mockReset();
    authenticateAs(store);
  });

  describe("uwierzytelnianie", () => {
    it("zwraca 401 dla evaluate-insights bez ważnego tokena", async () => {
      authMock.authenticateRequest.mockRejectedValue(new ApiAuthError("Wymagane.", 401));
      const response = await evaluateInsightsPost(
        postRequest("/api/ai/evaluate-insights", { childId: CHILD.id }),
      );
      expect(response.status).toBe(401);
    });

    it("zwraca 401 dla correct-insight bez ważnego tokena", async () => {
      authMock.authenticateRequest.mockRejectedValue(new ApiAuthError("Wymagane.", 401));
      const response = await correctInsightPost(
        postRequest("/api/ai/correct-insight", { insightId: "x", feedback: "accepted" }),
      );
      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/ai/evaluate-insights", () => {
    it("zwraca 400 gdy brakuje parametru childId", async () => {
      const response = await evaluateInsightsPost(postRequest("/api/ai/evaluate-insights", {}));
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain("childId");
    });

    it("zwraca 404 dla dziecka niedostępnego dla użytkownika", async () => {
      store.child = null;
      const response = await evaluateInsightsPost(
        postRequest("/api/ai/evaluate-insights", { childId: "child_foreign" }),
      );
      expect(response.status).toBe(404);
    });

    it("zwraca 403 gdy dziecko należy do innego gospodarstwa", async () => {
      authenticateAs(store, "household_other");
      const response = await evaluateInsightsPost(
        postRequest("/api/ai/evaluate-insights", { childId: CHILD.id }),
      );
      expect(response.status).toBe(403);
      expect(store.creates).toHaveLength(0);
    });

    it("zwraca 429 po przekroczeniu dziennego limitu AI", async () => {
      store.insightsCount = 20;
      const response = await evaluateInsightsPost(
        postRequest("/api/ai/evaluate-insights", { childId: CHILD.id }),
      );
      expect(response.status).toBe(429);
      expect(store.creates).toHaveLength(0);
    });

    it("respektuje nadpisany limit gospodarstwa (admin) zamiast domyślnego", async () => {
      store.insightsCount = 5;
      store.householdLimitOverride = 5;
      const response = await evaluateInsightsPost(
        postRequest("/api/ai/evaluate-insights", { childId: CHILD.id }),
      );
      expect(response.status).toBe(429);
    });

    it("generuje i zapisuje wniosek dla dziecka z gospodarstwa użytkownika", async () => {
      const response = await evaluateInsightsPost(
        postRequest("/api/ai/evaluate-insights", { childId: CHILD.id }),
      );
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.insight.title).toBeDefined();
      expect(json.insight.explanation).toBeDefined();
      expect(store.creates).toHaveLength(1);
    });
  });

  describe("POST /api/ai/correct-insight", () => {
    it("zwraca 400 gdy brakuje wymaganych pól", async () => {
      const response = await correctInsightPost(postRequest("/api/ai/correct-insight", {}));
      expect(response.status).toBe(400);
    });

    it("zwraca 404 dla nieistniejącego lub cudzego wniosku", async () => {
      const response = await correctInsightPost(
        postRequest("/api/ai/correct-insight", {
          insightId: "insight_foreign",
          feedback: "accepted",
        }),
      );
      expect(response.status).toBe(404);
    });

    it("oznacza wniosek jako validated przy zatwierdzeniu przez rodzica", async () => {
      const response = await correctInsightPost(
        postRequest("/api/ai/correct-insight", { insightId: "insight_abc", feedback: "accepted" }),
      );
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.insight.status).toBe("validated");
      expect(json.insight.parent_feedback).toBe("accepted");
    });

    it("cofa zatwierdzenie i przywraca wniosek do aktywnych", async () => {
      store.insightStatus = "validated";
      const response = await correctInsightPost(
        postRequest("/api/ai/correct-insight", { insightId: "insight_abc", feedback: "pending" }),
      );
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.insight.status).toBe("active");
      expect(json.insight.parent_feedback).toBe("pending");
    });

    it("odrzuca cofnięcie wniosku, który nie był potwierdzony", async () => {
      const response = await correctInsightPost(
        postRequest("/api/ai/correct-insight", { insightId: "insight_abc", feedback: "pending" }),
      );
      expect(response.status).toBe(409);
    });

    it("oznacza wniosek jako corrected_by_parent z notatką i nadpisaniem algorytmu", async () => {
      const response = await correctInsightPost(
        postRequest("/api/ai/correct-insight", {
          insightId: "insight_abc",
          feedback: "adjusted",
          parentCorrectionNote: "Wczoraj wiercił sąsiad",
          algorithmOverrideJson: { wwOffsetMin: 15 },
        }),
      );
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.insight.status).toBe("corrected_by_parent");
      expect(json.insight.parent_feedback).toBe("adjusted");
      expect(json.insight.parent_correction_note).toBe("Wczoraj wiercił sąsiad");
      expect(json.insight.algorithm_override_json).toEqual({ wwOffsetMin: 15 });
    });
  });
});
