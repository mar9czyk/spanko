import type PocketBase from "pocketbase";
import { describe, expect, it } from "vitest";
import { isAiDisabled } from "../aiLimit";

describe("isAiDisabled — zgoda RODO", () => {
  it("wyłącza AI bez zgody rodzica, bez odpytywania bazy", async () => {
    const pb = {} as unknown as PocketBase;
    expect(await isAiDisabled(pb, "h1", {})).toBe(true);
    expect(await isAiDisabled(pb, "h1", { ai_consent: false })).toBe(true);
  });
});
