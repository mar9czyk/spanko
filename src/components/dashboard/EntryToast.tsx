"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { formatVolume } from "@/i18n/translate";
import type { DiaperKind } from "@/lib/types/database";
import { BreastMinutesInput } from "./BreastMinutesInput";
import { BREAST_TOAST_MINUTES, DEFAULT_BREAST_CUSTOM_MIN, DIAPER_OPTIONS } from "./constants";
import type { EntryToast as EntryToastData } from "./useDashboardState";

const TOAST_VISIBLE_MS = 8000;

interface EntryToastProps {
  readonly toast: EntryToastData | null;
  readonly onBreastMinutes: (minutes: number) => void;
  readonly onDiaperKind: (kind: DiaperKind) => void;
  readonly onUndo: () => void;
  readonly onDismiss: () => void;
}

const CHIP_CLASS =
  "min-h-12 rounded-xl border border-[#263348] bg-[#1E2738] px-3 text-sm font-medium text-slate-200";

/**
 * Potwierdzenie zapisu karmienia lub pieluchy z cofnięciem i opcjonalnym dopiskiem
 * (minuty piersi albo inny rodzaj pieluchy).
 *
 * @param {EntryToastProps} props - Zapisany wpis i akcje
 * @returns {ReactNode} Toast albo null
 */
export function EntryToast({
  toast,
  onBreastMinutes,
  onDiaperKind,
  onUndo,
  onDismiss,
}: EntryToastProps): ReactNode {
  const { t, units } = useI18n();
  const [customMinutes, setCustomMinutes] = useState<number | null>(null);
  const toastId = toast?.id;
  const isCustomOpen = customMinutes !== null;

  // Nowy wpis zamyka wpisywanie własnego czasu poprzedniego
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset ma się wykonać przy zmianie toastu
  useEffect(() => {
    setCustomMinutes(null);
  }, [toastId]);

  // Podczas ustawiania własnego czasu toast nie znika sam
  useEffect(() => {
    if (!toast || isCustomOpen) return;
    const timeoutId = setTimeout(onDismiss, TOAST_VISIBLE_MS);
    return () => clearTimeout(timeoutId);
  }, [toast, isCustomOpen, onDismiss]);

  if (!toast) return null;
  let message: string;
  if (toast.kind === "breast") {
    message = t("entryToast.breast", {
      side: toast.side === "left" ? t("entryToast.sideLeft") : t("entryToast.sideRight"),
    });
  } else if (toast.kind === "bottle") {
    message = toast.bottleMl
      ? t("entryToast.bottleMl", { volume: formatVolume(toast.bottleMl, units) })
      : t("entryToast.bottle");
  } else {
    const option = DIAPER_OPTIONS.find((item) => item.value === toast.diaperKind);
    const kind = option
      ? t(option.labelKey)
          .replace(/^\S+\s/, "")
          .toLowerCase()
      : "";
    message = t("entryToast.diaper", { kind });
  }

  return (
    <div
      role="status"
      className="pointer-events-auto flex flex-col gap-2 rounded-2xl border border-emerald-500/40 bg-[#151B28] px-4 py-2 shadow-xl"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-emerald-100">{message}</span>
        <button
          type="button"
          onClick={onUndo}
          className="min-h-12 px-3 text-sm font-semibold text-amber-300"
        >
          {t("entryToast.undo")}
        </button>
      </div>
      {toast.kind === "breast" && customMinutes !== null && (
        <div className="flex flex-col gap-2">
          <BreastMinutesInput minutes={customMinutes} onChange={setCustomMinutes} />
          <button
            type="button"
            onClick={() => onBreastMinutes(customMinutes)}
            className="min-h-12 rounded-xl bg-amber-500 text-sm font-semibold text-[#0B0F17]"
          >
            {t("breast.save")}
          </button>
        </div>
      )}
      {toast.kind === "breast" && customMinutes === null && (
        <div className="flex gap-2">
          {BREAST_TOAST_MINUTES.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => onBreastMinutes(minutes)}
              className={`${CHIP_CLASS} tabular-nums`}
            >
              {minutes} {t("common.minutesShort")}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomMinutes(DEFAULT_BREAST_CUSTOM_MIN)}
            className={CHIP_CLASS}
          >
            {t("breast.other")}
          </button>
        </div>
      )}
      {toast.kind === "diaper" && (
        <div className="flex gap-2">
          {DIAPER_OPTIONS.filter((option) => option.value !== toast.diaperKind).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onDiaperKind(option.value)}
              className={CHIP_CLASS}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
