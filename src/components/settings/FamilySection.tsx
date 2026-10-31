"use client";

import type { ReactNode } from "react";
import { InviteCard } from "@/components/onboarding/InviteCard";
import { useI18n } from "@/i18n/I18nProvider";
import type { UserRecord } from "@/lib/types/database";
import { SettingsCard } from "./SettingsCard";

/**
 * Karta „Rodzina”: kod zaproszenia drugiego rodzica.
 *
 * @param {object} props - Zalogowany użytkownik
 * @returns {ReactNode} Karta lub nic, gdy użytkownik nie ma rodziny
 */
export function FamilySection({ user }: { readonly user: UserRecord }): ReactNode {
  const { t } = useI18n();
  if (!user.household_id) return null;
  return (
    <SettingsCard title={t("onb.family.card")} hint={t("onb.family.cardHint")}>
      <InviteCard householdId={user.household_id} />
    </SettingsCard>
  );
}
