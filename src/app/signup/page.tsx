"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { OnboardingShell, onboardingStyles } from "@/components/onboarding/OnboardingShell";
import { useI18n } from "@/i18n/I18nProvider";
import { MIN_PASSWORD_LENGTH, signUpWithEmail } from "@/lib/pocketbase";
import { useAuthMethods } from "@/lib/useAuthMethods";

/**
 * Rejestracja e-mailem: adres, hasło (min. 10 znaków, podgląd) i opcjonalne imię.
 *
 * @returns {ReactNode} Formularz rejestracji
 */
export default function SignupPage(): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const methods = useAuthMethods();

  if (methods?.signup.email === false) {
    return (
      <OnboardingShell
        title={t("signup.title")}
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

  const canSubmit = email.includes("@") && password.length >= MIN_PASSWORD_LENGTH && !busy;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await signUpWithEmail(email, password, name);
      router.replace(`/signup/check-email?email=${encodeURIComponent(email.trim())}`);
    } catch (e) {
      const data = (e as { response?: { data?: Record<string, { code?: string }> } }).response
        ?.data;
      setError(data?.email ? t("signup.emailTaken") : t("signup.failed"));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <OnboardingShell
        title={t("signup.title")}
        subtitle={t("signup.subtitle")}
        footer={
          <>
            {error && (
              <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}
            <button type="submit" disabled={!canSubmit} className={onboardingStyles.primaryButton}>
              {busy ? t("common.loading") : t("signup.submit")}
            </button>
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
          <span className="text-xs text-slate-400">
            {t("signup.password", { min: MIN_PASSWORD_LENGTH })}
          </span>
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={onboardingStyles.field}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
            className="h-4 w-4 accent-violet-500"
          />
          {t("signup.showPassword")}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">{t("signup.name")}</span>
          <input
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={onboardingStyles.field}
          />
        </label>
      </OnboardingShell>
    </form>
  );
}
