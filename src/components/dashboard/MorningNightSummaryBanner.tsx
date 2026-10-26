import { Moon, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { InterventionType } from "@/lib/sleep-engine/types";
import { QUICK_WAKE_DURATION_OPTIONS } from "./constants";
import type { MorningWakingAnswer } from "./useDashboardState";

interface MorningNightSummaryBannerProps {
  readonly wakingTimes: readonly string[];
  readonly onSave: (answer: MorningWakingAnswer) => void;
  readonly onDismiss: () => void;
}

const DEFAULT_DURATION_MIN = 15;

/** Sposoby uspokojenia do wyboru rano; „sam” wyklucza pozostałe. */
const SOOTHING_OPTIONS: readonly InterventionType[] = [
  "breast",
  "bottle",
  "bouncing",
  "carrying",
  "patting",
  "pacifier_reinsert",
  "shushing_voice",
  "room_presence",
  "independent",
];

const CHIP_BASE = "min-h-12 px-3 rounded-lg border text-sm font-medium transition-all";
const CHIP_OFF = "bg-[#1E2738] text-slate-300 border-[#263348]";
const CHIP_ON = "bg-amber-500/20 text-amber-200 border-amber-500/50";

/**
 * Karta Porannego Podsumowania Nocy: ile trwały pobudki i czym uspokojono dziecko.
 *
 * @description
 * Pojawia się po porannej pobudce, gdy w nocy zapisano pobudki. Odpowiedź (czas i sposoby
 * uspokojenia, w tym nie tylko karmienie) dotyczy wszystkich pobudek tej nocy i wymaga samych dotknięć.
 *
 * @param {MorningNightSummaryBannerProps} props - Czasy pobudek i akcje
 * @returns {ReactNode} Baner podsumowania
 */
export function MorningNightSummaryBanner({
  wakingTimes,
  onSave,
  onDismiss,
}: MorningNightSummaryBannerProps): ReactNode {
  const { t, tDynamic } = useI18n();
  const [durationMin, setDurationMin] = useState(DEFAULT_DURATION_MIN);
  const [soothing, setSoothing] = useState<readonly InterventionType[]>([]);
  if (wakingTimes.length === 0) return null;

  const timesText = wakingTimes.join(` ${t("morning.and")} `);
  const toggle = (item: InterventionType) =>
    setSoothing((current) => {
      if (current.includes(item)) return current.filter((value) => value !== item);
      return item === "independent"
        ? [item]
        : [...current.filter((value) => value !== "independent"), item];
    });

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
          aria-label={t("common.cancel")}
          className="text-slate-400 hover:text-slate-200 p-0.5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-sm text-slate-300 leading-snug">
        {t("morning.before")} <strong className="text-amber-200">{timesText}</strong>{" "}
        {t("morning.after")}
      </p>
      <div className="flex items-center gap-1.5">
        {QUICK_WAKE_DURATION_OPTIONS.map((item) => (
          <button
            key={item.minutes}
            type="button"
            aria-pressed={durationMin === item.minutes}
            onClick={() => setDurationMin(item.minutes)}
            className={`flex-1 ${CHIP_BASE} ${durationMin === item.minutes ? CHIP_ON : CHIP_OFF}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-slate-300">{t("morning.soothedHow")}</p>
      <div className="flex flex-wrap gap-1.5">
        {SOOTHING_OPTIONS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={soothing.includes(item)}
            onClick={() => toggle(item)}
            className={`${CHIP_BASE} ${soothing.includes(item) ? CHIP_ON : CHIP_OFF}`}
          >
            {tDynamic(`intervention.${item}`, item)}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onSave({ durationMin, interventions: soothing })}
        className="min-h-12 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 text-sm font-bold"
      >
        {t("morning.save")}
      </button>
    </div>
  );
}
