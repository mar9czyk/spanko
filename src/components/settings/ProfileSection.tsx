"use client";

import { Check, Loader2 } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { pb } from "@/lib/pocketbase";
import type { UserRecord } from "@/lib/types/database";
import { SettingsCard } from "./SettingsCard";

const MAX_NAME_LENGTH = 80;

type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Edycja imienia rodzica; e-mail pochodzi z konta Google i jest tylko do odczytu.
 *
 * @param {object} props - Zalogowany użytkownik
 * @returns {ReactNode} Karta profilu
 */
export function ProfileSection({ user }: { readonly user: UserRecord }): ReactNode {
  const { t } = useI18n();
  const [name, setName] = useState(user.name ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const trimmed = name.trim();
  const isDirty = trimmed !== (user.name ?? "").trim();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isDirty) return;
    setStatus("saving");
    try {
      // SDK podmienia rekord w authStore po aktualizacji własnego konta
      await pb.collection("users").update(user.id, { name: trimmed });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  const initial = (trimmed || user.email).charAt(0).toUpperCase();

  return (
    <SettingsCard title={t("settings.profile")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-amber-500/20 to-violet-500/20 border border-amber-500/30 flex items-center justify-center font-bold text-amber-300 text-lg">
            {initial}
          </div>
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs text-slate-400">{t("settings.name")}</span>
            <input
              type="text"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="name"
              placeholder={t("settings.namePlaceholder")}
              onChange={(event) => {
                setName(event.target.value);
                setStatus("idle");
              }}
              className="w-full rounded-xl border border-[#263348] bg-[#0B0F17] px-3 py-2 text-sm text-ink placeholder:text-slate-500 focus:border-amber-500/60 focus:outline-none"
            />
          </label>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">{t("settings.email")}</span>
          <p className="truncate text-sm text-slate-300">{user.email}</p>
        </div>
        <div className="flex items-center justify-end gap-3">
          {status === "saved" && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Check className="w-3.5 h-3.5" />
              {t("settings.saved")}
            </span>
          )}
          {status === "error" && (
            <span role="alert" className="text-xs text-red-300">
              {t("settings.saveFailed")}
            </span>
          )}
          <button
            type="submit"
            disabled={!isDirty || status === "saving"}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-opacity disabled:opacity-40"
          >
            {status === "saving" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {status === "saving" ? t("settings.saving") : t("settings.save")}
          </button>
        </div>
      </form>
    </SettingsCard>
  );
}
