import { describe, expect, it } from "vitest";
import { normalizeInviteCode } from "../invite-code";
import { resolveOnboardingStep } from "../onboarding";

const consented = { terms_accepted_at: "2026-10-31", health_consent_at: "2026-10-31" };

describe("resolveOnboardingStep", () => {
  it("kieruje bez sesji do logowania", () => {
    expect(resolveOnboardingStep(null)).toBe("login");
  });
  it("wymaga obu zgód", () => {
    expect(resolveOnboardingStep({ terms_accepted_at: "x" })).toBe("consent");
    expect(resolveOnboardingStep({ health_consent_at: "x", household_id: "h" })).toBe("consent");
  });
  it("wymaga rodziny po zgodach", () => {
    expect(resolveOnboardingStep(consented)).toBe("choose");
  });
  it("wpuszcza użytkownika z rodziną", () => {
    expect(resolveOnboardingStep({ ...consented, household_id: "h" })).toBe("ready");
  });
});

describe("normalizeInviteCode", () => {
  it("usuwa spacje i myślniki oraz podnosi litery", () => {
    expect(normalizeInviteCode(" sp7-k92 ")).toBe("SP7K92");
  });
});
