import { z } from "zod";
import { SANDBOX_SAMPLES } from "@/lib/sandboxSamples";

export const MAX_MODEL_NAME_LENGTH = 120;
export const MAX_PROMPT_LENGTH = 8000;
export const MAX_AI_DAILY_LIMIT = 1000;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
export const MAX_AI_MAX_TOKENS = 8000;
export const MAX_AI_TIMEOUT_MS = 120_000;
export const MIN_PROMPT_LENGTH = 20;

export const AdminSettingsUpdateSchema = z
  .object({
    openrouter_fast_model: z.string().trim().max(MAX_MODEL_NAME_LENGTH).optional(),
    openrouter_reasoning_model: z.string().trim().max(MAX_MODEL_NAME_LENGTH).optional(),
    system_prompt_insights: z.string().max(MAX_PROMPT_LENGTH).optional(),
    system_prompt_goal_coach: z.string().max(MAX_PROMPT_LENGTH).optional(),
    sleep_matrix_override_json: z.unknown().nullable().optional(),
    /** Notatka do wersji matrycy (nie jest zapisywana w admin_settings) */
    sleep_matrix_note: z.string().trim().max(300).optional(),
    ai_daily_limit_per_household: z.number().int().min(0).max(MAX_AI_DAILY_LIMIT).optional(),
    ai_disabled: z.boolean().optional(),
    openrouter_fallback_model: z.string().trim().max(MAX_MODEL_NAME_LENGTH).optional(),
    ai_temperature: z.number().min(0).max(2).optional(),
    ai_max_tokens: z.number().int().min(0).max(MAX_AI_MAX_TOKENS).optional(),
    ai_timeout_ms: z.number().int().min(0).max(MAX_AI_TIMEOUT_MS).optional(),
  })
  .strict();

export const PromptCreateSchema = z.object({
  system_prompt: z.string().trim().min(MIN_PROMPT_LENGTH).max(MAX_PROMPT_LENGTH),
  note: z.string().trim().max(300).optional(),
});

export const OpenRouterTestSchema = z.object({
  model: z.string().trim().max(MAX_MODEL_NAME_LENGTH).optional(),
});

export const MIN_OPENROUTER_KEY_LENGTH = 20;
export const MAX_OPENROUTER_KEY_LENGTH = 300;

export const OpenRouterKeySchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(MIN_OPENROUTER_KEY_LENGTH)
    .max(MAX_OPENROUTER_KEY_LENGTH)
    .regex(/^sk-or-\S+$/, 'Klucz OpenRouter zaczyna się od "sk-or-".'),
});

export const ReplayRequestSchema = z.object({
  prompt: z.string().max(MAX_PROMPT_LENGTH).optional(),
  model: z.string().trim().max(MAX_MODEL_NAME_LENGTH).optional(),
});

export const AiQualityQuerySchema = z.object({
  limit: z.coerce.number().int().min(10).max(1000).default(500),
});

export const SandboxRequestSchema = z.object({
  prompt: z.string().max(MAX_PROMPT_LENGTH).optional(),
  model: z.string().trim().max(MAX_MODEL_NAME_LENGTH).optional(),
  sample: z.enum(SANDBOX_SAMPLES).default("balanced"),
});

export const AiCallsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  status: z.enum(["ok", "error", "invalid_json"]).optional(),
  household_id: z.string().trim().max(64).optional(),
  child_id: z.string().trim().max(64).optional(),
  user_id: z.string().trim().max(64).optional(),
  category: z.string().trim().max(80).optional(),
  model: z.string().trim().max(MAX_MODEL_NAME_LENGTH).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});

export const UsageQuerySchema = z.object({
  days: z.coerce
    .number()
    .refine((value) => [7, 30, 90].includes(value))
    .default(7),
});

export const HouseholdLimitPatchSchema = z
  .object({
    householdId: z.string().min(1).max(64),
    limitOverride: z.number().int().min(0).max(MAX_AI_DAILY_LIMIT).nullable().optional(),
    aiDisabled: z.boolean().optional(),
  })
  .refine((value) => value.limitOverride !== undefined || value.aiDisabled !== undefined, {
    message: "Brak pól do zmiany.",
  });

export const UsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(120).optional(),
  filter: z.enum(["all", "admin", "blocked"]).default("all"),
});

export const UserPatchSchema = z
  .object({
    is_admin: z.boolean().optional(),
    is_blocked: z.boolean().optional(),
    household_id: z.string().max(64).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Brak pól do zmiany." });

export const UserDeleteSchema = z.object({ confirmEmail: z.string().trim().min(3).max(255) });

export const AuditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  action: z.string().trim().max(80).optional(),
  actor: z.string().trim().max(120).optional(),
});
