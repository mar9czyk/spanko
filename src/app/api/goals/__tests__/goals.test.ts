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

import { POST as goalCoachPost } from "@/app/api/ai/goal-coach/route";
import { generatePlan } from "@/lib/goals-engine/plans";
import type { GoalBaseline } from "@/lib/goals-engine/types";
import { ApiAuthError } from "@/lib/server/auth";
import { POST as previewPost } from "../preview/route";
import { POST as createGoalPost } from "../route";
import { POST as statusPost } from "../status/route";

const HOUSEHOLD_ID = "household_a";
const MS_PER_DAY = 86_400_000;
const NOW = new Date().toISOString();

const CHILD = {
  id: "child_1",
  household_id: HOUSEHOLD_ID,
  name: "Zosia",
  birth_date: new Date(Date.now() - 270 * MS_PER_DAY).toISOString(),
  active_day_mode: "home",
  anti_orthosomnia_mode: false,
  timezone: "Europe/Warsaw",
  created: NOW,
  updated: NOW,
};

const BASELINE: GoalBaseline = {
  dayCount: 7,
  avgNightWakings: 3,
  avgNightFeedCount: 0,
  avgNightMilkMl: 0,
  avgLatencyMin: 25,
  dominantRung: "pat",
};

function dateOffset(offset: number): string {
  return new Date(Date.now() - offset * MS_PER_DAY).toISOString().slice(0, 10);
}

function nightLog(offset: number) {
  const date = dateOffset(offset);
  return {
    id: `night_${offset}`,
    child_id: CHILD.id,
    physiological_date: date,
    type: "night",
    status: "completed",
    put_down_at: `${date}T18:50:00.000Z`,
    fell_asleep_at: `${date}T19:20:00.000Z`,
    woke_up_at: `${date}T05:30:00.000Z`,
    interventions: ["patting"],
    mood: "easy",
    night_wakings: [1, 2, 3].map((n) => ({
      wokeAt: `${date}T0${n}:00:00.000Z`,
      estimatedDurationMin: 10,
      fedMilk: false,
      interventions: ["patting"],
    })),
    is_rebound_sleep: false,
    ignore_in_calibration: false,
    created: NOW,
    updated: NOW,
  };
}

interface FakeStore {
  nights: number;
  activeGoal: Record<string, unknown> | null;
  dailyTasks: Record<string, unknown>[];
  creates: { collection: string; data: Record<string, unknown> }[];
  updates: { collection: string; id: string; data: Record<string, unknown> }[];
}

function createFakePocketBase(store: FakeStore) {
  return {
    filter: (expression: string) => expression,
    collection: (name: string) => ({
      getOne: async (id: string) => {
        if (name === "children" && id === CHILD.id) return CHILD;
        if (name === "households") return { id, name: "Dom" };
        if (name === "child_goals" && store.activeGoal && store.activeGoal.id === id) {
          return store.activeGoal;
        }
        throw new Error("not found");
      },
      getList: async () => {
        if (name === "sleep_logs") {
          const items = Array.from({ length: store.nights }, (_, i) => nightLog(i + 1));
          return { items, totalItems: items.length };
        }
        if (name === "child_goals") {
          const items = store.activeGoal ? [store.activeGoal] : [];
          return { items, totalItems: items.length };
        }
        if (name === "goal_daily_tasks") {
          return { items: store.dailyTasks, totalItems: store.dailyTasks.length };
        }
        return { items: [], totalItems: 0 };
      },
      create: async (data: Record<string, unknown>) => {
        store.creates.push({ collection: name, data });
        const record = { ...data, id: `${name}_new`, created: NOW, updated: NOW };
        if (name === "goal_daily_tasks") store.dailyTasks.push(record);
        return record;
      },
      update: async (id: string, data: Record<string, unknown>) => {
        store.updates.push({ collection: name, id, data });
        return { ...(store.activeGoal ?? {}), ...data, id };
      },
    }),
  };
}

function postRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { authorization: "Bearer test-token" },
    body: JSON.stringify(body),
  });
}

const selection = {
  childId: CHILD.id,
  goal: "reduce_night_wakings",
  method: "gentle_fading",
  redFlagsAcknowledged: true,
};

function activeGoal() {
  const plan = generatePlan({
    goal: "reduce_night_wakings",
    method: "gentle_fading",
    baseline: BASELINE,
  });
  return {
    id: "goal_1",
    child_id: CHILD.id,
    goal_type: "reduce_night_wakings",
    method: "gentle_fading",
    status: "active",
    started_on: dateOffset(3),
    step_started_on: dateOffset(3),
    current_step: 0,
    baseline_json: BASELINE,
    plan_json: plan,
    created: NOW,
    updated: NOW,
  };
}

describe("Goals Route Handlers", () => {
  let store: FakeStore;

  beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    store = { nights: 7, activeGoal: null, dailyTasks: [], creates: [], updates: [] };
    authMock.authenticateRequest.mockReset();
    authMock.authenticateRequest.mockResolvedValue({
      pb: createFakePocketBase(store),
      user: { id: "user_1", household_id: HOUSEHOLD_ID },
    });
  });

  it("preview: zwraca gotowość, baseline i plan", async () => {
    const response = await previewPost(postRequest("/api/goals/preview", selection));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.readiness.ready).toBe(true);
    expect(json.baseline.avgNightWakings).toBe(3);
    expect(json.plan.steps.length).toBeGreaterThan(1);
  });

  it("preview: bez potwierdzenia czerwonych flag cel nie jest gotowy", async () => {
    const response = await previewPost(
      postRequest("/api/goals/preview", { ...selection, redFlagsAcknowledged: false }),
    );
    const json = await response.json();
    expect(json.readiness.ready).toBe(false);
    expect(json.readiness.blockers).toContain("RED_FLAGS_NOT_ACKNOWLEDGED");
  });

  it("preview: 400 dla niepoprawnego ciała i 401 bez uwierzytelnienia", async () => {
    const bad = await previewPost(postRequest("/api/goals/preview", { childId: "x" }));
    expect(bad.status).toBe(400);
    authMock.authenticateRequest.mockRejectedValue(new ApiAuthError("Wymagane.", 401));
    const unauth = await previewPost(postRequest("/api/goals/preview", selection));
    expect(unauth.status).toBe(401);
  });

  it("preview: 403 dla dziecka z innego gospodarstwa", async () => {
    authMock.authenticateRequest.mockResolvedValue({
      pb: createFakePocketBase(store),
      user: { id: "user_2", household_id: "household_b" },
    });
    const response = await previewPost(postRequest("/api/goals/preview", selection));
    expect(response.status).toBe(403);
  });

  it("tworzy aktywny cel z planem, gdy dziecko jest gotowe", async () => {
    const response = await createGoalPost(postRequest("/api/goals", selection));
    expect(response.status).toBe(200);
    const created = store.creates.find((c) => c.collection === "child_goals");
    expect(created?.data).toMatchObject({
      child_id: CHILD.id,
      goal_type: "reduce_night_wakings",
      status: "active",
      current_step: 0,
    });
  });

  it("odmawia utworzenia celu, gdy dziecko nie jest gotowe", async () => {
    const response = await createGoalPost(
      postRequest("/api/goals", { ...selection, redFlagsAcknowledged: false }),
    );
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe("NOT_READY");
    expect(store.creates).toHaveLength(0);
  });

  it("odmawia drugiego aktywnego celu", async () => {
    store.activeGoal = activeGoal();
    const response = await createGoalPost(postRequest("/api/goals", selection));
    expect(response.status).toBe(400);
  });

  it("status: pozwala wstrzymać aktywny cel, ale nie wznowić ukończonego", async () => {
    store.activeGoal = activeGoal();
    const paused = await statusPost(
      postRequest("/api/goals/status", { goalId: "goal_1", status: "paused" }),
    );
    expect(paused.status).toBe(200);
    store.activeGoal = { ...activeGoal(), status: "achieved" };
    const invalid = await statusPost(
      postRequest("/api/goals/status", { goalId: "goal_1", status: "active" }),
    );
    expect(invalid.status).toBe(400);
  });

  it("goal-coach: zapisuje zadania dnia z tekstem awaryjnym bez klucza AI", async () => {
    store.activeGoal = activeGoal();
    const response = await goalCoachPost(
      postRequest("/api/ai/goal-coach", { goalId: "goal_1", locale: "pl" }),
    );
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.cached).toBe(false);
    const daily = store.creates.find((c) => c.collection === "goal_daily_tasks");
    expect(daily?.data.tasks_json).toBeInstanceOf(Array);
    const coach = daily?.data.coach_json as { todayAdvice: string[] } | undefined;
    expect(coach?.todayAdvice.length).toBeGreaterThan(0);
    expect(daily?.data.progress_json).toMatchObject({ action: expect.any(String) });
  });

  it("goal-coach: drugie wywołanie tej doby zwraca zapis z pamięci podręcznej", async () => {
    store.activeGoal = activeGoal();
    await goalCoachPost(postRequest("/api/ai/goal-coach", { goalId: "goal_1" }));
    const second = await goalCoachPost(postRequest("/api/ai/goal-coach", { goalId: "goal_1" }));
    const json = await second.json();
    expect(json.cached).toBe(true);
    expect(store.creates.filter((c) => c.collection === "goal_daily_tasks")).toHaveLength(1);
  });

  it("goal-coach: 400 dla nieaktywnego celu", async () => {
    store.activeGoal = { ...activeGoal(), status: "paused" };
    const response = await goalCoachPost(postRequest("/api/ai/goal-coach", { goalId: "goal_1" }));
    expect(response.status).toBe(400);
  });
});
