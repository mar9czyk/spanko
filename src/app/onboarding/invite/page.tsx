"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { InviteCard } from "@/components/onboarding/InviteCard";
import { OnboardingShell, onboardingStyles } from "@/components/onboarding/OnboardingShell";
import { useOnboardingGuard } from "@/components/onboarding/useOnboardingGuard";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * Po założeniu rodziny: kod do zaproszenia drugiego rodzica (można pominąć).
 *
 * @returns {ReactNode} Ekran zaproszenia
 */
export default function InvitePage(): ReactNode {
  const { t } = useI18n();
  const guard = useOnboardingGuard({ allowedSteps: ["ready"] });

  if (guard.status !== "ready" || !guard.user?.household_id) {
    return <OnboardingShell title={t("common.loading")}>{null}</OnboardingShell>;
  }

  return (
    <OnboardingShell
      title={t("onb.invite.title")}
      subtitle={t("onb.invite.subtitle")}
      footer={
        <Link
          href="/dashboard"
          className={`${onboardingStyles.primaryButton} flex items-center justify-center`}
        >
          {t("onb.invite.done")}
        </Link>
      }
    >
      <InviteCard householdId={guard.user.household_id} />
    </OnboardingShell>
  );
}
