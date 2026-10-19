import { Clock, ShieldCheck } from "lucide-react";
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
    textClass: "text-rose-400",
    segmentClass: "bg-rose-400",
  },
};

const SEGMENT_COUNT = 5;
const PERCENT_PER_SEGMENT = 100 / SEGMENT_COUNT;

interface SleepBatteryIndicatorProps {
  readonly batteryPercent: number;
  readonly sleepRestedness: SleepRestednessLevel;
  readonly sleepNeedsProfile: "low_sleep_needs" | "average" | "high_sleep_needs";
  readonly latestLastNapEndAt: string;
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
  const filled = Math.max(1, Math.min(SEGMENT_COUNT, Math.ceil(percent / PERCENT_PER_SEGMENT)));
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
 * Stan wyspania dziecka (7 dni) słowem i kolorem, odznaka profilu potrzeb
 * oraz limit ostatniej drzemki (Backwards Nap Capping).
 *
 * @param {SleepBatteryIndicatorProps} props - Dane wyspania i ograniczeń
 * @returns {ReactNode} Wyrenderowany widżet
 */
export function SleepBatteryIndicator({
  batteryPercent,
  sleepRestedness,
  sleepNeedsProfile,
  latestLastNapEndAt,
}: SleepBatteryIndicatorProps): ReactNode {
  const { t } = useI18n();
  const style = RESTEDNESS_STYLES[sleepRestedness];

  return (
    <div className="w-full bg-[#151B28] border border-[#263348] rounded-2xl p-3 flex flex-col gap-2 shadow-md">
      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-base font-semibold ${style.textClass}`}>{t(style.labelKey)}</span>
        <span className="text-[11px] text-slate-500">{t("battery.period")}</span>
      </div>
      <RestednessSegments percent={batteryPercent} segmentClass={style.segmentClass} />
      <p className="text-xs text-slate-400">{t(style.effectKey)}</p>
      <div className="flex items-center justify-between gap-1 text-[11px] pt-1">
        <span className="px-2 py-0.5 rounded-md bg-[#1E2738] text-violet-300 border border-violet-500/20 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-violet-400" />
          {t(PROFILE_KEYS[sleepNeedsProfile])}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-[#1E2738] text-amber-300 border border-amber-500/20 flex items-center gap-1 font-mono">
          <Clock className="w-3 h-3 text-amber-400" />
          {t("battery.lastNap", { time: latestLastNapEndAt })}
        </span>
      </div>
    </div>
  );
}
