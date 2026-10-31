"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState } from "react";
import { OnboardingShell, onboardingStyles } from "@/components/onboarding/OnboardingShell";
import { useI18n } from "@/i18n/I18nProvider";
import { requestPasswordReset } from "@/lib/pocketbase";

/**
 * Prośba o link do zmiany hasła; odpowiedź zawsze neutralna (nie zdradza, czy konto istnieje).
 *
 * @returns {ReactNode} Formularz
 */
export default function ForgotPasswordPage(): ReactNode {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      await requestPasswordReset(email);
    } catch {
      // Celowo ignorujemy błąd, żeby odpowiedź była zawsze taka sama.
    }
    setDone(true);
    setBusy(false);
  };

  return (
    <form onSubmit={submit}>
      <OnboardingShell
        title={t("forgot.title")}
        subtitle={done ? t("forgot.done") : t("forgot.subtitle")}
        footer={
          <>
            {!done && (
              <button
                type="submit"
                disabled={busy || !email.includes("@")}
                className={onboardingStyles.primaryButton}
              >
                {t("forgot.submit")}
              </button>
            )}
            <Link href="/login/email" className="text-center text-xs text-slate-500 underline">
              {t("common.back")}
            </Link>
          </>
        }
      >
        {!done && (
          <input
            type="email"
            autoComplete="email"
            aria-label={t("settings.email")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={onboardingStyles.field}
          />
        )}
      </OnboardingShell>
    </form>
  );
}
