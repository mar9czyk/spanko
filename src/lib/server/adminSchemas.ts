import { z } from "zod";
import { SANDBOX_SAMPLES } from "@/lib/sandboxSamples";

export const MAX_MODEL_NAME_LENGTH = 120;
export const MAX_PROMPT_LENGTH = 8000;
export const MAX_AI_DAILY_LIMIT = 1000;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export const AdminSettingsUpdateSchema = z
  .object({
    openrouter_fast_model: z.string().trim().max(MAX_MODEL_NAME_LENGTH).optional(),
    openrouter_reasoning_model: z.string().trim().max(MAX_MODEL_NAME_LENGTH).optional(),
    system_prompt_insights: z.string().max(MAX_PROMPT_LENGTH).optional(),
    sleep_matrix_override_json: z.unknown().nullable().optional(),
    ai_daily_limit_per_household: z.number().int().min(0).max(MAX_AI_DAILY_LIMIT).optional(),
  })
  .strict();

export const SandboxRequestSchema = z.object({
  prompt: z.string().max(MAX_PROMPT_LENGTH).optional(),
  model: z.string().trim().max(MAX_MODEL_NAME_LENGTH).optional(),
  sample: z.enum(SANDBOX_SAMPLES).default("balanced"),
});

export const AiCallsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  status: z.enum(["ok", "error", "invalid_json"]).optional(),
});

export const HouseholdLimitPatchSchema = z.object({
  householdId: z.string().min(1).max(64),
  limitOverride: z.number().int().min(0).max(MAX_AI_DAILY_LIMIT).nullable(),
});
