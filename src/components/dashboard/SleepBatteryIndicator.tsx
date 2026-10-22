import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/messages";
import type { SleepRestednessLevel } from "@/lib/sleep-engine";

const PROFILE_KEYS: Record<"low_sleep_needs" | "average" | "high_sleep_needs", MessageKey> = {
  low_sleep_needs: "battery.low",
  average: "battery.average",
  high_sleep_needs: "battery.high",
};

const RESTEDNESS_STYLES: Record<
  SleepRestednessLevel,
  { labelKey: MessageKey; effectKey: MessageKey; textClass: string; segmentClass: string }
> = {
  rested: {
    labelKey: "battery.level.rested",
    effectKey: "battery.effect.rested",
    textClass: "text-emerald-400",
    segmentClass: "bg-emerald-400",
  },
  slightly_tired: {
    labelKey: "battery.level.slightlyTired",
    effectKey: "battery.effect.slightlyTired",
    textClass: "text-amber-400",
    segmentClass: "bg-amber-400",
  },
  very_tired: {
    labelKey: "battery.level.veryTired",
    effectKey: "battery.effect.veryTired",
    textClass: "text-coral-400",
    segmentClass: "bg-coral-400",
  },
};

const SEGMENT_COUNT = 5;
const PERCENT_PER_SEGMENT = 100 / SEGMENT_COUNT;

interface SleepBatteryIndicatorProps {
  readonly batteryPercent: number;
  readonly sleepRestedness: SleepRestednessLevel;
  readonly sleepNeedsProfile: "low_sleep_needs" | "average" | "high_sleep_needs";
}

/**
 * Pięciosegmentowy pasek wyspania w kolorze stanu.
 *
 * @param {object} props - Procent naładowania i klasa koloru segmentów
 * @returns {ReactNode} Pasek segmentów
 */
function RestednessSegments({
  percent,
  segmentClass,
}: {
  percent: number;
  segmentClass: string;
}): ReactNode {
  const filled = restednessSegmentCount(percent);
  return (
    <div className="flex gap-1" aria-hidden="true">
      {Array.from({ length: SEGMENT_COUNT }, (_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: stała liczba segmentów
          key={index}
          className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
            index < filled ? segmentClass : "bg-[#263348]"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * Zawartość zakładki „Wyspanie”: stan słowem i kolorem, pięć segmentów, zdanie o skutku
 * dla prognoz oraz odznaka profilu potrzeb snu.
 *
 * @param {SleepBatteryIndicatorProps} props - Dane wyspania
 * @returns {ReactNode} Wyrenderowana zawartość
 */
export function SleepBatteryIndicator({
  batteryPercent,
  sleepRestedness,
  sleepNeedsProfile,
}: SleepBatteryIndicatorProps): ReactNode {
  const { t } = useI18n();
  const style = RESTEDNESS_STYLES[sleepRestedness];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-lg font-semibold ${style.textClass}`}>{t(style.labelKey)}</span>
        <span className="text-sm text-slate-400">{t("battery.period")}</span>
      </div>
      <RestednessSegments percent={batteryPercent} segmentClass={style.segmentClass} />
      <p className="text-base text-slate-300">{t(style.effectKey)}</p>
      <span className="self-start px-2.5 py-1 rounded-md bg-[#1E2738] text-violet-300 border border-violet-500/20 flex items-center gap-1 text-sm">
        <ShieldCheck className="w-4 h-4 text-violet-400" />
        {t(PROFILE_KEYS[sleepNeedsProfile])}
      </span>
    </div>
  );
}

/**
 * Liczba zapalonych segmentów baterii wyspania (1–5), do bąbelka na pulpicie.
 *
 * @param {number} percent - Procent baterii snu
 * @returns {number} Liczba segmentów
 */
export function restednessSegmentCount(percent: number): number {
  return Math.max(1, Math.min(SEGMENT_COUNT, Math.ceil(percent / PERCENT_PER_SEGMENT)));
}

/** Klasy koloru tekstu stanu wyspania (wspólne dla bąbelka i zakładki). */
export const RESTEDNESS_TEXT_CLASS: Record<SleepRestednessLevel, string> = {
  rested: RESTEDNESS_STYLES.rested.textClass,
  slightly_tired: RESTEDNESS_STYLES.slightly_tired.textClass,
  very_tired: RESTEDNESS_STYLES.very_tired.textClass,
};
