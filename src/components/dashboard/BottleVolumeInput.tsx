"use client";

import { Minus, Plus } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { parseBottleInput, stepBottleMl, toDisplayAmount } from "@/lib/bottle-volume";

interface BottleVolumeInputProps {
  /** Objętość w ml (jednostka zapisu), niezależnie od jednostek wyświetlania. */
  readonly valueMl: number;
  readonly onChange: (ml: number) => void;
}

const STEP_BUTTON_CLASS =
  "min-h-12 min-w-12 rounded-xl border border-[#263348] bg-[#1E2738] text-slate-200 flex items-center justify-center active:scale-95";

/**
 * Stepper ±10 ml (±0,5 oz) z możliwością wpisania dokładnej ilości z klawiatury.
 *
 * @param {BottleVolumeInputProps} props - Wartość w ml i zmiana
 * @returns {ReactNode} Pole ilości mleka
 */
export function BottleVolumeInput({ valueMl, onChange }: BottleVolumeInputProps): ReactNode {
  const { t, units } = useI18n();
  const [text, setText] = useState(String(toDisplayAmount(valueMl, units)));

  useEffect(() => {
    setText(String(toDisplayAmount(valueMl, units)));
  }, [valueMl, units]);

  const commit = (raw: string) => {
    const parsed = parseBottleInput(raw, units);
    if (parsed === null) {
      setText(String(toDisplayAmount(valueMl, units)));
      return;
    }
    onChange(parsed);
    setText(String(toDisplayAmount(parsed, units)));
  };

  const unitLabel = units === "imperial" ? "oz" : "ml";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={t("bottle.decrease")}
        onClick={() => onChange(stepBottleMl(valueMl, units, -1))}
        className={STEP_BUTTON_CLASS}
      >
        <Minus className="w-5 h-5" />
      </button>
      <label className="flex-1 flex items-center justify-center gap-1.5 min-h-12 rounded-xl border border-[#263348] bg-[#0B0F17] px-3 focus-within:border-amber-400">
        <input
          type="text"
          inputMode="decimal"
          aria-label={t("bottle.amount")}
          value={text}
          onChange={(change) => setText(change.target.value)}
          onBlur={(blur) => commit(blur.target.value)}
          onKeyDown={(key) => {
            if (key.key === "Enter") commit(key.currentTarget.value);
          }}
          className="w-full min-w-0 bg-transparent text-center text-lg tabular-nums text-ink focus:outline-none"
        />
        <span className="text-sm text-slate-400">{unitLabel}</span>
      </label>
      <button
        type="button"
        aria-label={t("bottle.increase")}
        onClick={() => onChange(stepBottleMl(valueMl, units, 1))}
        className={STEP_BUTTON_CLASS}
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
}
