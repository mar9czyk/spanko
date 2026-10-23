"use client";

import { Ear, EarOff, Info, MicOff } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { notifyWakeDetected } from "@/lib/push-client";
import type { SleepType } from "@/lib/types/database";
import type { WakeSensitivity } from "@/lib/wake-detector";
import { useWakeListener } from "./useWakeListener";

interface WakeListenerCardProps {
  readonly childId: string;
  /** Nasłuch dostępny tylko, gdy dziecko śpi. */
  readonly isSleeping: boolean;
  readonly sleepType: SleepType;
  /** Zapis wykrytej pobudki: nocna pobudka w trakcie nocy albo koniec drzemki. */
  readonly onConfirmWake: () => Promise<void> | void;
}

const SCREEN_HINT_KEY = "spanko.wakeListener.screenHintSeen";

const SENSITIVITIES: readonly WakeSensitivity[] = ["low", "medium", "high"];

/**
 * Nasłuch pobudki mikrofonem: przełącznik na pulpicie, przyciemniony ekran podczas nasłuchu
 * i alert z zapisem pobudki jednym dotknięciem.
 *
 * @param {WakeListenerCardProps} props - Stan snu i zapis pobudki
 * @returns {ReactNode} Karta nasłuchu z nakładką
 */
export function WakeListenerCard({
  childId,
  isSleeping,
  sleepType,
  onConfirmWake,
}: WakeListenerCardProps): ReactNode {
  const { t } = useI18n();
  const listener = useWakeListener({
    enabled: isSleeping,
    onDetected: () => notifyWakeDetected(childId),
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showScreenHint, setShowScreenHint] = useState(false);

  const isListening = listener.status === "listening";
  useEffect(() => {
    if (!isListening) return;
    try {
      if (localStorage.getItem(SCREEN_HINT_KEY)) return;
      localStorage.setItem(SCREEN_HINT_KEY, "1");
    } catch {
      // brak localStorage: podpowiedź pokaże się tylko w tej sesji
    }
    setShowScreenHint(true);
  }, [isListening]);

  if (!isSleeping) return null;

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      await onConfirmWake();
    } finally {
      setIsSaving(false);
      listener.resume();
    }
  };

  const isOverlayOpen = listener.status === "listening" || listener.status === "detected";

  return (
    <>
      <section className="rounded-2xl border border-[#263348] bg-[#151B28] p-3 flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void listener.start()}
            disabled={listener.status === "starting"}
            className="flex-1 min-h-[48px] rounded-xl bg-[#1E2738] hover:bg-[#253248] border border-violet-500/30 text-violet-200 text-sm font-semibold flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-60"
          >
            <Ear className="w-5 h-5 text-violet-400" />
            {listener.status === "starting" ? t("wakeListener.starting") : t("wakeListener.start")}
          </button>
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            aria-expanded={showInfo}
            aria-label={t("wakeListener.info")}
            className="min-w-[48px] min-h-[48px] rounded-xl bg-[#1E2738] border border-[#263348] text-slate-400 flex items-center justify-center"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
        {showInfo && (
          <>
            <p className="text-xs text-slate-400 text-center">{t("wakeListener.privacy")}</p>
            <p className="text-xs text-slate-400 text-center">{t("wakeListener.otherPhone")}</p>
          </>
        )}
        {listener.error && (
          <p role="alert" className="text-xs text-red-300 flex items-center gap-1.5">
            <MicOff className="w-4 h-4 shrink-0" />
            {t(`wakeListener.error.${listener.error}`)}
          </p>
        )}
      </section>

      {isOverlayOpen && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col justify-end items-center px-4 pb-6"
          role="dialog"
          aria-modal="true"
          aria-label={t("wakeListener.title")}
        >
          {listener.status === "detected" ? (
            <div className="w-full max-w-md flex flex-col gap-3">
              <p className="text-center text-2xl font-bold text-amber-300 mb-6" role="alert">
                {t("wakeListener.detected")}
              </p>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={isSaving}
                className="w-full min-h-[56px] rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 font-bold text-base active:scale-98 transition-all disabled:opacity-60"
              >
                {sleepType === "night"
                  ? t("wakeListener.saveNightWake")
                  : t("wakeListener.saveNapEnd")}
              </button>
              <button
                type="button"
                onClick={listener.resume}
                className="w-full min-h-[52px] rounded-2xl bg-[#1E2738] border border-[#263348] text-slate-200 font-semibold text-sm active:scale-98 transition-all"
              >
                {t("wakeListener.falseAlarm")}
              </button>
              <button
                type="button"
                onClick={listener.stop}
                className="w-full min-h-[48px] text-slate-400 text-sm"
              >
                {t("wakeListener.stop")}
              </button>
            </div>
          ) : (
            <div className="w-full max-w-md flex flex-col gap-4 opacity-60">
              <div className="flex flex-col items-center gap-2 mb-8">
                <span
                  className="block w-3 h-3 rounded-full bg-violet-500 transition-transform"
                  style={{ transform: `scale(${1 + Math.min(listener.level * 20, 3)})` }}
                  aria-hidden="true"
                />
                <p className="text-sm text-slate-400">{t("wakeListener.listening")}</p>
                {listener.lastNotifiedAt && (
                  <p className="text-xs text-amber-300/80" role="status">
                    {t("wakeListener.notified", {
                      time: listener.lastNotifiedAt.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    })}
                  </p>
                )}
                {showScreenHint && (
                  <p className="text-xs text-slate-400 text-center">
                    {t("wakeListener.keepScreenOn")}
                  </p>
                )}
              </div>
              <fieldset className="flex gap-2">
                <legend className="sr-only">{t("wakeListener.sensitivity")}</legend>
                {SENSITIVITIES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => listener.setSensitivity(value)}
                    aria-pressed={listener.sensitivity === value}
                    className={`flex-1 min-h-[48px] rounded-xl border text-xs font-medium ${
                      listener.sensitivity === value
                        ? "border-violet-500/60 text-violet-300 bg-violet-950/40"
                        : "border-[#263348] text-slate-400"
                    }`}
                  >
                    {t(`wakeListener.sensitivity.${value}`)}
                  </button>
                ))}
              </fieldset>
              <button
                type="button"
                onClick={listener.stop}
                className="w-full min-h-[52px] rounded-2xl bg-[#151B28] border border-[#263348] text-slate-300 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <EarOff className="w-5 h-5" />
                {t("wakeListener.stop")}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
