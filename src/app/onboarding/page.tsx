"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { useOnboardingGuard } from "@/components/onboarding/useOnboardingGuard";
import { useI18n } from "@/i18n/I18nProvider";
import { readPendingInvite } from "@/lib/onboarding";
import { signOutUser } from "@/lib/pocketbase";

/**
 * Wybór: założyć rodzinę czy dołączyć kodem. Po linku zaproszenia od razu przechodzi do dołączania.
 *
 * @returns {ReactNode} Ekran wyboru
 */
export default function OnboardingChoicePage(): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  const guard = useOnboardingGuard({ allowedSteps: ["choose"] });

  useEffect(() => {
    if (guard.status === "ready" && readPendingInvite()) router.replace("/onboarding/join");
  }, [guard.status, router]);

  if (guard.status !== "ready") {
    return <OnboardingShell title={t("common.loading")}>{null}</OnboardingShell>;
  }

  const card =
    "flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-5 active:scale-[0.98] transition";

  return (
    <OnboardingShell
      title={t("onb.choose.title")}
      subtitle={t("onb.choose.subtitle")}
      footer={
        <button
          type="button"
          onClick={() => {
            signOutUser();
            router.replace("/login");
          }}
          className="text-xs text-slate-500 underline"
        >
          {t("settings.signOut")}
        </button>
      }
    >
      <Link href="/onboarding/family" className={card}>
        <span className="text-base font-medium text-amber-200">{t("onb.choose.create")}</span>
        <span className="text-xs text-slate-400">{t("onb.choose.createHint")}</span>
      </Link>
      <Link href="/onboarding/join" className={card}>
        <span className="text-base font-medium text-amber-200">{t("onb.choose.join")}</span>
        <span className="text-xs text-slate-400">{t("onb.choose.joinHint")}</span>
      </Link>
    </OnboardingShell>
  );
}
