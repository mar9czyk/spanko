"use client";

import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { stepBreastMinutes } from "./entryEdit";

interface BreastMinutesInputProps {
  readonly minutes: number;
  readonly onChange: (minutes: number) => void;
}

const STEP_BUTTON_CLASS =
  "min-h-12 min-w-12 rounded-xl border border-[#263348] bg-[#1E2738] text-slate-200 flex items-center justify-center active:scale-95";

/**
 * Stepper ±5 min czasu karmienia piersią, bez klawiatury (obsługa jednym kciukiem w nocy).
 *
 * @param {BreastMinutesInputProps} props - Minuty i zmiana
 * @returns {ReactNode} Pole czasu karmienia
 */
export function BreastMinutesInput({ minutes, onChange }: BreastMinutesInputProps): ReactNode {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={t("breast.decrease")}
        onClick={() => onChange(stepBreastMinutes(minutes, -1))}
        className={STEP_BUTTON_CLASS}
      >
        <Minus className="w-5 h-5" />
      </button>
      <output
        aria-label={t("breast.duration")}
        className="flex-1 flex items-center justify-center gap-1.5 min-h-12 rounded-xl border border-[#263348] bg-[#0B0F17] px-3 text-lg tabular-nums text-ink"
      >
        {minutes} <span className="text-sm text-slate-400">{t("common.minutesShort")}</span>
      </output>
      <button
        type="button"
        aria-label={t("breast.increase")}
        onClick={() => onChange(stepBreastMinutes(minutes, 1))}
        className={STEP_BUTTON_CLASS}
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
}
