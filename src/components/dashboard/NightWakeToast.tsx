"use client";

import { type ReactNode, useEffect } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { formatClock } from "./timelineMapping";

const TOAST_VISIBLE_MS = 6000;

interface NightWakeToastProps {
  /** Moment zapisanej pobudki; brak = toast ukryty. */
  readonly wokeAtIso: string | null;
  readonly onUndo: () => void;
  readonly onDismiss: () => void;
}

/**
 * Potwierdzenie szybkiej pobudki nocnej nad paskiem akcji, z cofnięciem jednym dotknięciem.
 *
 * @param {NightWakeToastProps} props - Czas pobudki i akcje
 * @returns {ReactNode} Toast albo null
 */
export function NightWakeToast({ wokeAtIso, onUndo, onDismiss }: NightWakeToastProps): ReactNode {
  const { t } = useI18n();

  useEffect(() => {
    if (!wokeAtIso) return;
    const timeoutId = setTimeout(onDismiss, TOAST_VISIBLE_MS);
    return () => clearTimeout(timeoutId);
  }, [wokeAtIso, onDismiss]);

  if (!wokeAtIso) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-28 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-md items-center justify-between gap-3 rounded-2xl border border-violet-500/40 bg-[#151B28] px-4 py-2 shadow-xl"
    >
      <span className="text-sm text-violet-100">
        {t("nightWake.saved", { time: formatClock(wokeAtIso) })}
      </span>
      <button
        type="button"
        onClick={onUndo}
        className="min-h-[48px] px-3 text-sm font-semibold text-amber-300"
      >
        {t("nightWake.undo")}
      </button>
    </div>
  );
}
