"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import {
  BACKDATED_PRESET_MINUTES,
  resolveBackdatedStart,
  startFromMinutesAgo,
} from "./backdatedSleep";

interface BackdatedSleepSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  /** Zakłada trwający sen, który zaczął się o podanej porze (ISO). */
  readonly onStart: (startIso: string) => void;
}

/**
 * Arkusz „Sen zaczął się wcześniej”: szybki wybór „X temu” albo dokładna godzina. Zakłada
 * trwający sen z przeszłym początkiem, więc licznik liczy od tej pory, a koniec zapisze „Wstał”.
 *
 * @param {BackdatedSleepSheetProps} props - Widoczność, zamknięcie i start snu
 * @returns {ReactNode} Bottom sheet
 */
export function BackdatedSleepSheet({
  isOpen,
  onClose,
  onStart,
}: BackdatedSleepSheetProps): ReactNode {
  const { t } = useI18n();
  const [clock, setClock] = useState("");
  const [error, setError] = useState(false);

  const start = (startMs: number) => {
    setError(false);
    setClock("");
    onStart(new Date(startMs).toISOString());
    onClose();
  };

  const startFromClock = () => {
    const startMs = resolveBackdatedStart(clock, Date.now());
    if (typeof startMs === "string") {
      setError(true);
      return;
    }
    start(startMs);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            role="dialog"
            aria-modal="true"
            aria-label={t("backdated.title")}
            className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl border-t border-[#263348] bg-[#151B28] p-4 shadow-2xl"
          >
            <div className="mx-auto h-1 w-12 rounded-full bg-[#263348]" />
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">{t("backdated.title")}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.cancel")}
                className="rounded-full p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400">{t("backdated.hint")}</p>
            <div className="grid grid-cols-3 gap-2">
              {BACKDATED_PRESET_MINUTES.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => start(startFromMinutesAgo(minutes, Date.now()))}
                  className="min-h-12 rounded-xl border border-[#263348] bg-[#1E2738] px-3 text-sm font-medium text-slate-200"
                >
                  {t("backdated.ago", { minutes })}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t("backdated.exact")}
              </span>
              <input
                type="time"
                value={clock}
                onChange={(change) => {
                  setClock(change.target.value);
                  setError(false);
                }}
                className="min-h-12 rounded-xl border border-[#263348] bg-[#0B0F17] px-3 text-base text-slate-100"
              />
            </label>
            {error && (
              <p role="alert" className="text-xs text-red-300">
                {t("backdated.error")}
              </p>
            )}
            <button
              type="button"
              onClick={startFromClock}
              disabled={!clock}
              className="min-h-12 rounded-xl bg-amber-500 text-sm font-semibold text-[#0B0F17] disabled:opacity-40"
            >
              {t("backdated.start")}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
