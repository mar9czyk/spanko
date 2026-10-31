"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, type ReactNode, Suspense, useState } from "react";
import { OnboardingShell, onboardingStyles } from "@/components/onboarding/OnboardingShell";
import { useI18n } from "@/i18n/I18nProvider";
import { MIN_PASSWORD_LENGTH, pb } from "@/lib/pocketbase";

function Reset(): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    try {
      await pb.collection("users").confirmPasswordReset(token, password, password);
      router.replace("/login/email");
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <OnboardingShell
        title={t("reset.title")}
        footer={
          <>
            {failed && (
              <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {t("reset.failed")}{" "}
                <Link href="/forgot-password" className="underline">
                  {t("reset.again")}
                </Link>
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !token || password.length < MIN_PASSWORD_LENGTH}
              className={onboardingStyles.primaryButton}
            >
              {t("reset.submit")}
            </button>
          </>
        }
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">
            {t("signup.password", { min: MIN_PASSWORD_LENGTH })}
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={onboardingStyles.field}
          />
        </label>
      </OnboardingShell>
    </form>
  );
}

/**
 * Cel linku „Zmień hasło” z e-maila: ustawia nowe hasło tokenem.
 *
 * @returns {ReactNode} Formularz nowego hasła
 */
export default function ResetPage(): ReactNode {
  return (
    <Suspense fallback={null}>
      <Reset />
    </Suspense>
  );
}
