export const SANDBOX_SAMPLES = ["balanced", "sleep_debt", "newborn"] as const;
export type SandboxSample = (typeof SANDBOX_SAMPLES)[number];
