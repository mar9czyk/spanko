"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { OnboardingShell, onboardingStyles } from "@/components/onboarding/OnboardingShell";
import { useOnboardingGuard } from "@/components/onboarding/useOnboardingGuard";
import { useI18n } from "@/i18n/I18nProvider";
import { createFamily } from "@/lib/onboarding";

/**
 * Zakładanie rodziny: imię i data urodzenia dziecka (opcjonalnie termin porodu przy wcześniaku).
 *
 * @returns {ReactNode} Formularz pierwszego dziecka
 */
export default function FamilyPage(): ReactNode {
  const { t, locale } = useI18n();
  const router = useRouter();
  const guard = useOnboardingGuard({ allowedSteps: ["choose"] });
  const [childName, setChildName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [premature, setPremature] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (guard.status !== "ready") {
    return <OnboardingShell title={t("common.loading")}>{null}</OnboardingShell>;
  }

  const today = new Date().toISOString().slice(0, 10);
  const canSubmit =
    childName.trim() !== "" && birthDate !== "" && (!premature || dueDate !== "") && !busy;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await createFamily({
        childName: childName.trim(),
        birthDate,
        dueDate: premature ? dueDate : undefined,
        householdName: householdName.trim() || undefined,
        locale,
      });
      router.replace("/onboarding/invite");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknownError"));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <OnboardingShell
        title={t("onb.family.title")}
        subtitle={t("onb.family.subtitle")}
        footer={
          <>
            {error && (
              <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}
            <button type="submit" disabled={!canSubmit} className={onboardingStyles.primaryButton}>
              {busy ? t("common.loading") : t("onb.family.submit")}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="text-xs text-slate-500 underline"
            >
              {t("common.back")}
            </button>
          </>
        }
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">{t("onb.family.childName")}</span>
          <input
            value={childName}
            maxLength={100}
            onChange={(event) => setChildName(event.target.value)}
            className={onboardingStyles.field}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">{t("onb.family.birthDate")}</span>
          <input
            type="date"
            value={birthDate}
            max={today}
            onChange={(event) => setBirthDate(event.target.value)}
            className={onboardingStyles.field}
          />
        </label>
        <label className="flex items-center gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={premature}
            onChange={(event) => setPremature(event.target.checked)}
            className="h-5 w-5 accent-violet-500"
          />
          {t("onb.family.premature")}
        </label>
        {premature && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">{t("onb.family.dueDate")}</span>
            <input
              type="date"
              value={dueDate}
              min={birthDate || undefined}
              onChange={(event) => setDueDate(event.target.value)}
              className={onboardingStyles.field}
            />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">{t("onb.family.householdName")}</span>
          <input
            value={householdName}
            maxLength={100}
            placeholder={t("onb.family.householdPlaceholder")}
            onChange={(event) => setHouseholdName(event.target.value)}
            className={onboardingStyles.field}
          />
        </label>
      </OnboardingShell>
    </form>
  );
}
