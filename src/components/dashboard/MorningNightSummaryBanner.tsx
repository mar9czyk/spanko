import { Moon, X } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { QUICK_WAKE_DURATION_OPTIONS } from "./constants";

interface MorningNightSummaryBannerProps {
  readonly wakingTimes: readonly string[];
  readonly onSelectDuration: (durationMinutes: number) => void;
  readonly onDismiss: () => void;
}

/**
 * Pigułka szybkiego wyboru czasu trwania pobudki nocnej.
 *
 * @param {object} props - Właściwości pigułki
 * @returns {ReactNode} Przycisk pigułki
 */
function DurationPill({
  label,
  minutes,
  onSelect,
}: {
  label: string;
  minutes: number;
  onSelect: (min: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(minutes)}
      className="flex-1 py-1.5 px-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-sm font-medium transition-all"
    >
      {label}
    </button>
  );
}

/**
 * Karta Porannego Podsumowania Nocy z szybkimi pigułkami szacowania czasu pobudek.
 *
 * @description
 * Pojawia się po porannej pobudce, gdy w nocy zarejestrowano szybkie wybudzenia,
 * pozwalając uzupełnić czas trwania jednym dotknięciem bez wpisywania z klawiatury.
 *
 * @param {MorningNightSummaryBannerProps} props - Czasy pobudek i akcje wyboru
 * @returns {ReactNode} Baner podsumowania
 */
export function MorningNightSummaryBanner({
  wakingTimes,
  onSelectDuration,
  onDismiss,
}: MorningNightSummaryBannerProps): ReactNode {
  const { t } = useI18n();
  if (wakingTimes.length === 0) return null;

  const timesText = wakingTimes.join(` ${t("morning.and")} `);

  return (
    <div className="w-full bg-[#151B28] border border-amber-500/40 rounded-2xl p-3 flex flex-col gap-2 shadow-xl shadow-amber-500/5 my-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-amber-300 flex items-center gap-1.5">
          <Moon className="w-3.5 h-3.5" />
          {t("morning.title")}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-200 p-0.5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-sm text-slate-300 leading-snug">
        {t("morning.before")} <strong className="text-amber-200">{timesText}</strong>{" "}
        {t("morning.after")}
      </p>
      <div className="flex items-center gap-1.5 pt-0.5">
        {QUICK_WAKE_DURATION_OPTIONS.map((item) => (
          <DurationPill
            key={item.minutes}
            label={item.label}
            minutes={item.minutes}
            onSelect={onSelectDuration}
          />
        ))}
      </div>
    </div>
  );
}
