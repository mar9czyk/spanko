"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useState } from "react";
import { OnboardingShell, onboardingStyles } from "@/components/onboarding/OnboardingShell";
import { useI18n } from "@/i18n/I18nProvider";
import { resendVerification } from "@/lib/pocketbase";

const RESEND_COOLDOWN_SECONDS = 60;

function CheckEmail(): ReactNode {
  const { t } = useI18n();
  const email = useSearchParams().get("email") ?? "";
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setSent(false);
    try {
      await resendVerification(email);
    } finally {
      setSent(true);
    }
  };

  return (
    <OnboardingShell
      title={t("signup.check.title")}
      subtitle={t("signup.check.subtitle", { email })}
      footer={
        <>
          <button
            type="button"
            disabled={cooldown > 0 || !email}
            onClick={resend}
            className={onboardingStyles.primaryButton}
          >
            {cooldown > 0
              ? t("signup.check.wait", { seconds: cooldown })
              : t("signup.check.resend")}
          </button>
          {sent && <p className="text-center text-xs text-emerald-300">{t("signup.check.sent")}</p>}
          <Link href="/login/email" className="text-center text-xs text-slate-500 underline">
            {t("signup.check.login")}
          </Link>
        </>
      }
    >
      <p className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">
        {t("signup.check.spam")}
      </p>
    </OnboardingShell>
  );
}

/**
 * Ekran „Sprawdź skrzynkę” po rejestracji: ponowne wysłanie linku (co 60 s) i wskazówka o spamie.
 *
 * @returns {ReactNode} Ekran potwierdzenia
 */
export default function CheckEmailPage(): ReactNode {
  return (
    <Suspense fallback={null}>
      <CheckEmail />
    </Suspense>
  );
}
