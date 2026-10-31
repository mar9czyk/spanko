"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useState } from "react";
import { OnboardingShell, onboardingStyles } from "@/components/onboarding/OnboardingShell";
import { useI18n } from "@/i18n/I18nProvider";
import { pb } from "@/lib/pocketbase";

function Verify(): ReactNode {
  const { t } = useI18n();
  const token = useSearchParams().get("token");
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    pb.collection("users")
      .confirmVerification(token)
      .then(() => setStatus("ok"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <OnboardingShell
      title={t("verify.title")}
      subtitle={t(
        status === "ok" ? "verify.ok" : status === "error" ? "verify.error" : "common.loading",
      )}
      footer={
        status === "working" ? undefined : (
          <Link
            href={status === "ok" ? "/login/email" : "/signup/check-email"}
            className={`${onboardingStyles.primaryButton} flex items-center justify-center`}
          >
            {status === "ok" ? t("verify.login") : t("verify.again")}
          </Link>
        )
      }
    >
      {null}
    </OnboardingShell>
  );
}

/**
 * Cel linku z e-maila: potwierdza adres i prowadzi do logowania.
 *
 * @returns {ReactNode} Ekran potwierdzenia
 */
export default function VerifyPage(): ReactNode {
  return (
    <Suspense fallback={null}>
      <Verify />
    </Suspense>
  );
}
