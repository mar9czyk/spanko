import type { ReactNode } from "react";
import type { SleepLogRecord } from "@/lib/types/database";
import { ActiveSleepRemTimer } from "./ActiveSleepRemTimer";
import { ActiveSleepTimer } from "./ActiveSleepTimer";
import { NEWBORN_THRESHOLD_DAYS } from "./constants";
import { SleepCountdownRing } from "./SleepCountdownRing";

interface HeroWidgetProps {
  readonly currentSleepLog: SleepLogRecord | null;
  readonly isAntiOrthosomnia: boolean;
  readonly countdownDisplay: string;
  readonly sweetSpotTimeDisplay: string;
  readonly compassRangeDisplay: string;
  readonly onToggleAntiOrthosomnia: () => void;
  readonly effectiveAgeDays: number;
  /** Sugerowana pora wybudzenia z drzemki (HH:mm), gdy drzewo zaleca ograniczenie snu w dzień. */
  readonly napWakeSuggestion?: string | null;
  /** Bąbelki skrótów dnia wokół pierścienia; nie pokazujemy ich podczas trwającego snu. */
  readonly bubbles?: ReactNode;
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
        wakeSuggestion={props.napWakeSuggestion}
      />
    );
  }

  return (
    <SleepCountdownRing
      isAntiOrthosomnia={isAntiOrthosomnia}
      countdownDisplay={countdownDisplay}
      sweetSpotTimeDisplay={sweetSpotTimeDisplay}
      compassRangeDisplay={props.compassRangeDisplay}
      onToggleAntiOrthosomnia={props.onToggleAntiOrthosomnia}
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
  const isAsleepOrFalling =
    props.currentSleepLog !== null && props.currentSleepLog.status !== "completed";

  return (
    <section className="flex flex-col items-center gap-3 w-full my-2">
      {isAsleepOrFalling ? (
        <>
          <ClockOrStopwatch {...props} />
          {isNewborn && isNightSleep && <ActiveSleepRemTimer />}
        </>
      ) : (
        <div className="relative w-full max-w-sm h-[17rem] flex items-center justify-center">
          <ClockOrStopwatch {...props} />
          {props.bubbles}
        </div>
      )}
    </section>
  );
}
