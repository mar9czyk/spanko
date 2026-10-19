import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "./adminSchemas";

const KEY_PATTERN = /^[\p{L}\p{N}_.-]+$/u;
const MAX_KEY_LENGTH = 80;
const MAX_ANNOUNCEMENT_LENGTH = 500;
const MAX_CONTENT_LENGTH = 2000;

const keySchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_KEY_LENGTH)
  .regex(KEY_PATTERN, "Klucz może zawierać litery, cyfry oraz znaki _ . -");

export const ChildrenQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(120).optional(),
});

export const InviteActionSchema = z.object({ action: z.enum(["revoke", "regenerate"]) });

export const SleepFixSchema = z.object({
  wokeUpAt: z.iso.datetime({ offset: true }),
  confirm: z.literal(true),
});

export const MatrixPreviewSchema = z.object({ matrix: z.unknown() });

export const AppContentUpsertSchema = z.object({
  key: keySchema,
  value_pl: z.string().max(MAX_CONTENT_LENGTH),
});

// Pola bez wartości domyślnych: schematy PATCH budujemy z nich przez `.partial()`. Domyślne wartości
// w schemacie PATCH byłyby wstawiane do każdego żądania i po cichu nadpisywały istniejące dane
// (np. PATCH samego opisu wyłączyłby flagę i wyczyścił jej rollout).
const announcementFields = {
  message: z.string().trim().min(1).max(MAX_ANNOUNCEMENT_LENGTH),
  level: z.enum(["info", "warning"]),
  starts_at: z.iso.datetime({ offset: true }).nullable(),
  ends_at: z.iso.datetime({ offset: true }).nullable(),
  active: z.boolean(),
};

export const AnnouncementCreateSchema = z.object({
  message: announcementFields.message,
  level: announcementFields.level.default("info"),
  starts_at: announcementFields.starts_at.optional(),
  ends_at: announcementFields.ends_at.optional(),
  active: announcementFields.active.default(true),
});

export const AnnouncementPatchSchema = z
  .object(announcementFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Brak pól do zmiany." });

const featureFlagFields = {
  enabled: z.boolean(),
  rollout_household_ids: z.array(z.string().trim().min(1).max(64)).max(500),
  description: z.string().trim().max(300),
};

export const FeatureFlagCreateSchema = z.object({
  key: keySchema,
  enabled: featureFlagFields.enabled.default(false),
  rollout_household_ids: featureFlagFields.rollout_household_ids.default([]),
  description: featureFlagFields.description.optional(),
});

export const FeatureFlagPatchSchema = z
  .object(featureFlagFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Brak pól do zmiany." });
