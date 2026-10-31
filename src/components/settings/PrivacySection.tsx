"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { pb } from "@/lib/pocketbase";
import type { UserRecord } from "@/lib/types/database";
import { SettingsCard } from "./SettingsCard";

/**
 * Prywatność: przełącznik zgody na wnioski AI oraz linki do regulaminu i polityki prywatności.
 *
 * @param {object} props - Zalogowany użytkownik
 * @returns {ReactNode} Karta prywatności
 */
export function PrivacySection({ user }: { readonly user: UserRecord }): ReactNode {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(user.ai_consent === true);
  const [error, setError] = useState(false);

  const toggle = async (value: boolean) => {
    setEnabled(value);
    setError(false);
    try {
      await pb.collection("users").update(user.id, { ai_consent: value });
    } catch {
      setEnabled(!value);
      setError(true);
    }
  };

  return (
    <SettingsCard title={t("privacy.title")} hint={t("privacy.aiHint")}>
      <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
        {t("privacy.aiToggle")}
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => toggle(event.target.checked)}
          className="h-6 w-6 accent-violet-500"
        />
      </label>
      {error && <p className="text-xs text-red-300">{t("privacy.saveError")}</p>}
      <div className="flex gap-4 text-xs text-amber-300">
        <Link href="/terms">{t("legal.termsLink")}</Link>
        <Link href="/privacy">{t("legal.privacyLink")}</Link>
      </div>
    </SettingsCard>
  );
}
