"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { OnboardingShell, onboardingStyles } from "@/components/onboarding/OnboardingShell";
import { useOnboardingGuard } from "@/components/onboarding/useOnboardingGuard";
import { useI18n } from "@/i18n/I18nProvider";
import { saveConsents } from "@/lib/onboarding";
import { pb } from "@/lib/pocketbase";

/**
 * Ekran zgód: regulamin + polityka prywatności, dane o zdrowiu dziecka (wymagane) i AI (opcjonalne).
 *
 * @returns {ReactNode} Ekran zgód
 */
export default function ConsentPage(): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  const guard = useOnboardingGuard({ allowedSteps: ["consent"] });
  const [terms, setTerms] = useState(false);
  const [health, setHealth] = useState(false);
  const [ai, setAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (guard.status !== "ready" || !guard.user) {
    return <OnboardingShell title={t("common.loading")}>{null}</OnboardingShell>;
  }
  const userId = guard.user.id;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveConsents(userId, ai);
      await pb.collection("users").authRefresh();
      router.replace("/onboarding");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknownError"));
      setBusy(false);
    }
  };

  const checkbox = (checked: boolean, onChange: (value: boolean) => void, content: ReactNode) => (
    <label className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4 text-sm text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-violet-500"
      />
      <span>{content}</span>
    </label>
  );

  return (
    <OnboardingShell
      title={t("onb.consent.title")}
      subtitle={t("onb.consent.subtitle")}
      footer={
        <>
          {error && (
            <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={!terms || !health || busy}
            onClick={submit}
            className={onboardingStyles.primaryButton}
          >
            {t("onb.continue")}
          </button>
        </>
      }
    >
      {checkbox(
        terms,
        setTerms,
        <>
          {t("onb.consent.terms")}{" "}
          <Link href="/terms" target="_blank" className="text-amber-300 underline">
            {t("legal.termsLink")}
          </Link>{" "}
          {t("onb.consent.and")}{" "}
          <Link href="/privacy" target="_blank" className="text-amber-300 underline">
            {t("legal.privacyLink")}
          </Link>
          .
        </>,
      )}
      {checkbox(health, setHealth, t("onb.consent.health"))}
      {checkbox(ai, setAi, t("onb.consent.ai"))}
      <p className="text-xs text-slate-500">{t("onb.consent.aiHint")}</p>
    </OnboardingShell>
  );
}
