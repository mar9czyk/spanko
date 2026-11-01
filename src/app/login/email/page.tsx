"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { OnboardingShell, onboardingStyles } from "@/components/onboarding/OnboardingShell";
import { useI18n } from "@/i18n/I18nProvider";
import { signInWithEmail } from "@/lib/pocketbase";
import { useAuthMethods } from "@/lib/useAuthMethods";

/**
 * Logowanie e-mailem i hasłem; błąd jest zawsze ogólny, żeby nie zdradzać, czy konto istnieje.
 *
 * @returns {ReactNode} Formularz logowania
 */
export default function EmailLoginPage(): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const methods = useAuthMethods();

  if (methods?.login.email === false) {
    return (
      <OnboardingShell
        title={t("loginEmail.title")}
        subtitle={t("auth.methodDisabled")}
        footer={
          <Link href="/login" className="text-center text-xs text-slate-500 underline">
            {t("common.back")}
          </Link>
        }
      >
        {null}
      </OnboardingShell>
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    try {
      await signInWithEmail(email, password);
      router.replace("/dashboard");
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <OnboardingShell
        title={t("loginEmail.title")}
        footer={
          <>
            {failed && (
              <div role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
                <p>{t("loginEmail.failed")}</p>
                <Link
                  href={`/signup/check-email?email=${encodeURIComponent(email.trim())}`}
                  className="underline"
                >
                  {t("loginEmail.resendVerification")}
                </Link>
              </div>
            )}
            <button
              type="submit"
              disabled={busy || !email || !password}
              className={onboardingStyles.primaryButton}
            >
              {busy ? t("common.loading") : t("loginEmail.submit")}
            </button>
            <Link href="/forgot-password" className="text-center text-xs text-amber-300 underline">
              {t("loginEmail.forgot")}
            </Link>
            <Link href="/login" className="text-center text-xs text-slate-500 underline">
              {t("common.back")}
            </Link>
          </>
        }
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">{t("settings.email")}</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={onboardingStyles.field}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">{t("loginEmail.password")}</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={onboardingStyles.field}
          />
        </label>
      </OnboardingShell>
    </form>
  );
}
