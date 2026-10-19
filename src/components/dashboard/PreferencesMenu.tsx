"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { Locale, Units } from "@/i18n/translate";

const LOCALE_OPTIONS: readonly { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "pl", label: "PL" },
];

const UNIT_OPTIONS: readonly { value: Units; label: string }[] = [
  { value: "metric", label: "ml" },
  { value: "imperial", label: "oz" },
];

function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}): ReactNode {
  return (
    <fieldset
      aria-label={ariaLabel}
      className="m-0 flex min-w-0 rounded-lg border border-[#263348] p-0 overflow-hidden"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`px-1.5 py-1 text-[10px] font-semibold min-w-[28px] ${
            value === option.value ? "bg-amber-500 text-slate-950" : "bg-[#151B28] text-slate-400"
          }`}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

/**
 * Przełączniki języka (EN/PL) i jednostek objętości (ml/oz) zapisywane w przeglądarce.
 *
 * @returns {ReactNode} Kompaktowe przełączniki preferencji
 */
export function PreferencesMenu(): ReactNode {
  const { locale, units, setLocale, setUnits, t } = useI18n();
  return (
    <div className="flex items-center gap-1">
      <Segmented
        options={LOCALE_OPTIONS}
        value={locale}
        onChange={setLocale}
        ariaLabel={t("prefs.language")}
      />
      <Segmented
        options={UNIT_OPTIONS}
        value={units}
        onChange={setUnits}
        ariaLabel={t("prefs.units")}
      />
    </div>
  );
}
