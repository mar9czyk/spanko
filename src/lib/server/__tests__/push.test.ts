import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildWakeAlertPayload,
  type PushSubscriptionRecord,
  readVapidConfig,
  selectWakeAlertRecipients,
} from "../push";

function subscription(id: string, endpoint: string): PushSubscriptionRecord {
  return { id, user_id: "u1", household_id: "h1", endpoint, p256dh: "k", auth: "a" };
}

describe("selectWakeAlertRecipients", () => {
  it("skips the listening phone and keeps every other household device", () => {
    const all = [subscription("1", "https://push/a"), subscription("2", "https://push/b")];
    expect(selectWakeAlertRecipients(all, "https://push/a").map((s) => s.id)).toEqual(["2"]);
    expect(selectWakeAlertRecipients(all, undefined)).toHaveLength(2);
  });
});

describe("buildWakeAlertPayload", () => {
  it("uses the recipient's language and falls back to English", () => {
    expect(buildWakeAlertPayload("Tymon", "pl").title).toBe("Możliwa pobudka: Tymon");
    expect(buildWakeAlertPayload("Tymon", "").title).toBe("Possible waking: Tymon");
    expect(buildWakeAlertPayload("Tymon", "en").url).toBe("/dashboard");
  });
});

describe("readVapidConfig", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns null until both VAPID keys are set", () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    expect(readVapidConfig()).toBeNull();
    vi.stubEnv("VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
    expect(readVapidConfig()).toMatchObject({ publicKey: "pub", privateKey: "priv" });
  });
});
