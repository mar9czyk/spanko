"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { OnboardingShell, onboardingStyles } from "@/components/onboarding/OnboardingShell";
import { useOnboardingGuard } from "@/components/onboarding/useOnboardingGuard";
import { useI18n } from "@/i18n/I18nProvider";
import { normalizeInviteCode } from "@/lib/invite-code";
import { clearPendingInvite, joinFamily, previewInvite, readPendingInvite } from "@/lib/onboarding";

const CODE_LENGTH = 6;

/**
 * Dołączanie do rodziny kodem: sprawdza kod, pokazuje nazwę rodziny i prosi o potwierdzenie.
 *
 * @returns {ReactNode} Ekran dołączania
 */
export default function JoinPage(): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  const guard = useOnboardingGuard({ allowedSteps: ["choose"] });
  const [code, setCode] = useState("");
  const [householdName, setHouseholdName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      setHouseholdName(await previewInvite(value));
    } catch (e) {
      clearPendingInvite();
      setError(e instanceof Error ? e.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: jednorazowo po przejściu bramki
  useEffect(() => {
    if (guard.status !== "ready") return;
    const pending = readPendingInvite();
    if (pending) {
      setCode(pending);
      void check(pending);
    }
  }, [guard.status]);

  if (guard.status !== "ready") {
    return <OnboardingShell title={t("common.loading")}>{null}</OnboardingShell>;
  }

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await joinFamily(code);
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknownError"));
      setBusy(false);
    }
  };

  return (
    <OnboardingShell
      title={t("onb.join.title")}
      subtitle={t("onb.join.subtitle")}
      footer={
        <>
          {error && (
            <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
          {householdName === null ? (
            <button
              type="button"
              disabled={code.length !== CODE_LENGTH || busy}
              onClick={() => check(code)}
              className={onboardingStyles.primaryButton}
            >
              {t("onb.join.check")}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={confirm}
              className={onboardingStyles.primaryButton}
            >
              {t("onb.join.confirm", { name: householdName })}
            </button>
          )}
          <button
            type="button"
            onClick={() => router.replace("/onboarding")}
            className="text-xs text-slate-500 underline"
          >
            {t("common.back")}
          </button>
        </>
      }
    >
      <input
        value={code}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        maxLength={12}
        aria-label={t("onb.join.title")}
        placeholder="ABC234"
        onChange={(event) => {
          setCode(normalizeInviteCode(event.target.value).slice(0, CODE_LENGTH));
          setHouseholdName(null);
          setError(null);
        }}
        className={`${onboardingStyles.field} text-center font-mono text-3xl tracking-[0.4em]`}
      />
      {householdName !== null && (
        <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-200">
          {t("onb.join.found", { name: householdName })}
        </p>
      )}
    </OnboardingShell>
  );
}
