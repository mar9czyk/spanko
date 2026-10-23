import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { InterventionLevel, SleepMood } from "@/lib/types/database";
import { INTERVENTION_OPTIONS, MOOD_OPTIONS } from "./constants";

interface SleepHowPickerProps {
  readonly mood: SleepMood | undefined;
  readonly interventions: readonly InterventionLevel[];
  readonly onChange: (
    mood: SleepMood | undefined,
    interventions: readonly InterventionLevel[],
  ) => void;
  /** Pozwala odznaczyć nastrój (edycja wpisu); karta po zaśnięciu tylko zmienia wybór. */
  readonly allowClearMood?: boolean;
}

/**
 * Wybór „jak zasnął”: nastrój (jeden) i co pomogło (wiele), wspólny dla karty po zaśnięciu i edycji.
 *
 * @param {SleepHowPickerProps} props - Aktualny wybór i zmiana
 * @returns {ReactNode} Pigułki nastroju i interwencji
 */
export function SleepHowPicker({
  mood,
  interventions,
  onChange,
  allowClearMood = false,
}: SleepHowPickerProps): ReactNode {
  const { t } = useI18n();
  const toggleIntervention = (value: InterventionLevel) =>
    onChange(
      mood,
      interventions.includes(value)
        ? interventions.filter((item) => item !== value)
        : [...interventions, value],
    );
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-1.5">
        {MOOD_OPTIONS.map((option) => {
          const selected = mood === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                onChange(allowClearMood && selected ? undefined : option.value, interventions)
              }
              className={`min-h-12 rounded-xl border text-sm font-medium ${option.colorClass} ${selected ? "bg-[#253248] ring-1 ring-current" : "bg-[#1E2738]"}`}
            >
              {t(option.labelKey)}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {t("fellAsleep.helped")}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {INTERVENTION_OPTIONS.map((option) => {
            const selected = interventions.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleIntervention(option.value)}
                className={`min-h-10 rounded-lg border px-3 text-sm ${selected ? "border-amber-400/60 bg-amber-950/40 text-amber-200" : "border-[#263348] bg-[#1E2738] text-slate-300"}`}
              >
                {t(option.labelKey)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
