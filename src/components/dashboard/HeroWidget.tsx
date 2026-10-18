import type { ReactNode } from "react";
import type { SleepLogRecord } from "@/lib/types/database";
import { ActiveSleepRemTimer } from "./ActiveSleepRemTimer";
import { ActiveSleepTimer } from "./ActiveSleepTimer";
import { NEWBORN_THRESHOLD_DAYS } from "./constants";
import { SleepBatteryIndicator } from "./SleepBatteryIndicator";
import { SleepCountdownRing } from "./SleepCountdownRing";

interface HeroWidgetProps {
  readonly currentSleepLog: SleepLogRecord | null;
  readonly isAntiOrthosomnia: boolean;
  readonly countdownDisplay: string;
  readonly sweetSpotTimeDisplay: string;
  readonly compassRangeDisplay: string;
  readonly reasonDescription: string;
  readonly effectiveAgeDays: number;
  readonly batteryPercent: number;
  readonly sleepNeedsProfile: "low_sleep_needs" | "average" | "high_sleep_needs";
  readonly latestLastNapEndAt: string;
}

/**
 * Komponent wyboru aktywnego zegara w zależności od stanu snu dziecka.
 *
 * @param {object} props - Właściwości zegara
 * @returns {ReactNode} Zegar SweetSpot lub stoper snu
 */
function ClockOrStopwatch(props: HeroWidgetProps): ReactNode {
  const { currentSleepLog, isAntiOrthosomnia, countdownDisplay, sweetSpotTimeDisplay } = props;
  const isSleepingOrFalling =
    currentSleepLog &&
    (currentSleepLog.status === "sleeping" || currentSleepLog.status === "falling_asleep");

  if (isSleepingOrFalling) {
    return (
      <ActiveSleepTimer
        status={currentSleepLog.status}
        sleepType={currentSleepLog.type}
        startTimeIso={currentSleepLog.fell_asleep_at || currentSleepLog.put_down_at}
      />
    );
  }

  return (
    <SleepCountdownRing
      isAntiOrthosomnia={isAntiOrthosomnia}
      countdownDisplay={countdownDisplay}
      sweetSpotTimeDisplay={sweetSpotTimeDisplay}
      compassRangeDisplay={props.compassRangeDisplay}
      reasonDescription={props.reasonDescription}
    />
  );
}

/**
 * Centralny Hero Widget ("SweetSpot & Bateria Snu").
 *
 * @param {HeroWidgetProps} props - Dane wejściowe do widżetu
 * @returns {ReactNode} Wyrenderowany główny widżet
 */
export function HeroWidget(props: HeroWidgetProps): ReactNode {
  const isNewborn = props.effectiveAgeDays < NEWBORN_THRESHOLD_DAYS;
  const isNightSleep = props.currentSleepLog?.type === "night";

  return (
    <section className="flex flex-col items-center gap-3 w-full my-2">
      <ClockOrStopwatch {...props} />
      {isNewborn && isNightSleep && <ActiveSleepRemTimer />}
      <SleepBatteryIndicator
        batteryPercent={props.batteryPercent}
        sleepNeedsProfile={props.sleepNeedsProfile}
        latestLastNapEndAt={props.latestLastNapEndAt}
      />
    </section>
  );
}
