"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminSettingsRecord, AgeBracketConfig } from "@/lib/types/database";
import { adminRequest, jsonBody } from "./adminApi";

export interface AdminSettingsDefaults {
  readonly fastModel: string;
  readonly reasoningModel: string;
  readonly systemPrompt: string;
  readonly matrix: readonly AgeBracketConfig[];
}

interface SettingsResponse {
  readonly settings: AdminSettingsRecord | null;
  readonly defaults: AdminSettingsDefaults;
}

export type AdminSettingsPatch = Partial<
  Pick<
    AdminSettingsRecord,
    | "openrouter_fast_model"
    | "openrouter_reasoning_model"
    | "system_prompt_insights"
    | "ai_daily_limit_per_household"
    | "ai_disabled"
    | "openrouter_fallback_model"
    | "ai_temperature"
    | "ai_max_tokens"
    | "ai_timeout_ms"
  >
> & { sleep_matrix_override_json?: unknown; sleep_matrix_note?: string };

/**
 * Hook ładujący i zapisujący ustawienia admina (modele, prompt, matryca, limit).
 *
 * @returns {object} Dane, stan zapisu i operacje
 */
export function useAdminSettings() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      setData(await adminRequest<SettingsResponse>("/api/admin/settings"));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać ustawień.");
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const save = async (patch: AdminSettingsPatch): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      await adminRequest("/api/admin/settings", {
        method: "PUT",
        ...jsonBody(patch),
      });
      await reload();
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nie udało się zapisać.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return { data, error, isSaving, save, reload };
}
