"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AccountSection } from "@/components/settings/AccountSection";
import { PreferencesMenu } from "@/components/settings/PreferencesMenu";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { useCurrentUser } from "@/components/settings/useCurrentUser";
import { WakeAlertsSection } from "@/components/settings/WakeAlertsSection";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * Panel użytkownika (/settings): profil, język i jednostki, wylogowanie i usunięcie konta.
 *
 * @returns {ReactNode} Strona ustawień konta
 */
export default function SettingsPage(): ReactNode {
  const { t } = useI18n();
  const session = useCurrentUser();

  return (
    <main className="w-full flex flex-col gap-4 pb-8">
      <header className="flex flex-col gap-3 w-full pt-1">
        <Link
          href="/dashboard"
          className="flex w-fit items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-amber-400 transition-colors p-1 -ml-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t("settings.back")}</span>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-100">{t("settings.title")}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{t("settings.subtitle")}</p>
        </div>
      </header>

      {session.status === "signedIn" && (
        <ProfileSection key={session.user.id} user={session.user} />
      )}

      <SettingsCard title={t("settings.preferences")} hint={t("settings.preferencesHint")}>
        <PreferencesMenu />
      </SettingsCard>

      {session.status === "signedIn" && <WakeAlertsSection />}

      {session.status === "signedIn" && <AccountSection user={session.user} />}

      {session.status === "signedOut" && (
        <div className="flex flex-col gap-2 rounded-2xl border border-[#263348] bg-[#151B28] p-4 text-sm text-slate-300">
          <p>{t("settings.notSignedIn")}</p>
          <Link href="/login" className="w-fit font-semibold text-amber-400 hover:text-amber-300">
            {t("settings.goToLogin")}
          </Link>
        </div>
      )}
    </main>
  );
}
