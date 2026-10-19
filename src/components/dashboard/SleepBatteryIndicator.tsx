import { BatteryCharging, Clock, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/messages";

const PROFILE_KEYS: Record<"low_sleep_needs" | "average" | "high_sleep_needs", MessageKey> = {
  low_sleep_needs: "battery.low",
  average: "battery.average",
  high_sleep_needs: "battery.high",
};

interface SleepBatteryIndicatorProps {
  readonly batteryPercent: number;
  readonly sleepNeedsProfile: "low_sleep_needs" | "average" | "high_sleep_needs";
  readonly latestLastNapEndAt: string;
}

/**
 * Pasek postępu naładowania 7-dniowej baterii snu.
 *
 * @param {object} props - Procent naładowania baterii
 * @returns {ReactNode} Pasek postępu
 */
function BatteryProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(15, Math.min(100, percent));
  return (
    <div className="w-full bg-[#0E1420] h-2 rounded-full overflow-hidden border border-[#263348]/60">
      <div
        className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 transition-all duration-500 rounded-full"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/**
 * Wskaźnik Baterii Snu (7 dni), odznaka profilu potrzeb oraz limit ostatniej drzemki (Backwards Nap Capping).
 *
 * @param {SleepBatteryIndicatorProps} props - Dane naładowania i ograniczeń
 * @returns {ReactNode} Wyrenderowany widżet
 */
export function SleepBatteryIndicator({
  batteryPercent,
  sleepNeedsProfile,
  latestLastNapEndAt,
}: SleepBatteryIndicatorProps): ReactNode {
  const { t } = useI18n();
  const profileLabel = t(PROFILE_KEYS[sleepNeedsProfile]);

  return (
    <div className="w-full bg-[#151B28] border border-[#263348] rounded-2xl p-3 flex flex-col gap-2 shadow-md">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="flex items-center gap-1.5 text-slate-200">
          <BatteryCharging className="w-4 h-4 text-emerald-400" />
          {t("battery.title")}
        </span>
        <span className="font-mono text-emerald-400">{batteryPercent}%</span>
      </div>
      <BatteryProgressBar percent={batteryPercent} />
      <div className="flex items-center justify-between gap-1 text-[11px] pt-1">
        <span className="px-2 py-0.5 rounded-md bg-[#1E2738] text-violet-300 border border-violet-500/20 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-violet-400" />
          {profileLabel}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-[#1E2738] text-amber-300 border border-amber-500/20 flex items-center gap-1 font-mono">
          <Clock className="w-3 h-3 text-amber-400" />
          {t("battery.lastNap", { time: latestLastNapEndAt })}
        </span>
      </div>
    </div>
  );
}
