"use client";

import { type ReactNode, useEffect } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { formatClock } from "./timelineMapping";

const TOAST_VISIBLE_MS = 10_000;

interface NightWakeToastProps {
  /** Moment zapisanej pobudki; brak = toast ukryty. */
  readonly wokeAtIso: string | null;
  readonly onUndo: () => void;
  readonly onDismiss: () => void;
}

/**
 * Potwierdzenie pobudki nocnej z cofnięciem jednym dotknięciem (bez pytań o karmienie).
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
      className="pointer-events-auto flex flex-col gap-2 rounded-2xl border border-violet-500/40 bg-[#151B28] px-4 py-2 shadow-xl"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-violet-100">
          {t("nightWake.saved", { time: formatClock(wokeAtIso) })}
        </span>
        <button
          type="button"
          onClick={onUndo}
          className="min-h-12 px-3 text-sm font-semibold text-amber-300"
        >
          {t("nightWake.undo")}
        </button>
      </div>
    </div>
  );
}
