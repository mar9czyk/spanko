"use client";

import { BellRing } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import {
  detectPushSupport,
  disableWakeAlerts,
  type EnablePushResult,
  enableWakeAlerts,
  getOwnPushSubscription,
  type PushSupport,
} from "@/lib/push-client";
import { SettingsCard } from "./SettingsCard";

type Problem = Exclude<EnablePushResult, "enabled">;

/**
 * Włącznik powiadomień o pobudce na tym urządzeniu (telefon rodzica, który nie jest przy dziecku).
 *
 * @returns {ReactNode} Karta ustawień powiadomień push
 */
export function WakeAlertsSection(): ReactNode {
  const { t, locale } = useI18n();
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  useEffect(() => {
    const detected = detectPushSupport();
    setSupport(detected);
    if (detected !== "supported") return;
    void getOwnPushSubscription()
      .then((subscription) => setIsEnabled(Boolean(subscription)))
      .catch(() => setIsEnabled(false));
  }, []);

  const toggle = async () => {
    setIsBusy(true);
    setProblem(null);
    try {
      if (isEnabled) {
        await disableWakeAlerts();
        setIsEnabled(false);
        return;
      }
      const result = await enableWakeAlerts(locale);
      if (result === "enabled") setIsEnabled(true);
      else setProblem(result);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <SettingsCard title={t("wakeAlerts.title")} hint={t("wakeAlerts.hint")}>
      {support === "supported" ? (
        <>
          <button
            type="button"
            onClick={() => void toggle()}
            disabled={isBusy}
            aria-pressed={isEnabled}
            className={`w-full min-h-[48px] rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-60 ${
              isEnabled
                ? "bg-[#1E2738] border-[#263348] text-slate-300"
                : "bg-amber-500 border-amber-500 text-slate-950"
            }`}
          >
            <BellRing className="w-4 h-4" />
            {isEnabled ? t("wakeAlerts.disable") : t("wakeAlerts.enable")}
          </button>
          {isEnabled && <p className="text-xs text-emerald-300">{t("wakeAlerts.enabled")}</p>}
          {problem && (
            <p role="alert" className="text-xs text-red-300">
              {t(`wakeAlerts.${problem}`)}
            </p>
          )}
        </>
      ) : (
        support && (
          <p className="text-xs text-slate-400">
            {t(support === "needsInstall" ? "wakeAlerts.needsInstall" : "wakeAlerts.unsupported")}
          </p>
        )
      )}
    </SettingsCard>
  );
}
