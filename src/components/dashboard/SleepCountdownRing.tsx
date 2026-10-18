import { Compass, Moon, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

interface SleepCountdownRingProps {
  readonly isAntiOrthosomnia: boolean;
  readonly countdownDisplay: string;
  readonly sweetSpotTimeDisplay: string;
  readonly compassRangeDisplay: string;
  readonly reasonDescription: string;
}

/**
 * Prezentuje pierścień z dokładnym czasem SweetSpot.
 *
 * @param {object} props - Tekst odliczania i godzina SweetSpot
 * @returns {ReactNode} Zawartość precyzyjnego zegara
 */
function ExactClockContent({ countdown, targetTime }: { countdown: string; targetTime: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[11px] font-medium text-amber-400/80 uppercase tracking-widest flex items-center gap-1">
        <Sparkles className="w-3 h-3 text-amber-400" /> SweetSpot
      </span>
      <span className="text-3xl font-extrabold text-slate-50 tracking-tight font-mono my-0.5">
        {countdown}
      </span>
      <span className="text-xs text-slate-400">ok. {targetTime}</span>
    </div>
  );
}

/**
 * Prezentuje miękki kompas snu dla trybu Anti-Orthosomnia.
 *
 * @param {object} props - Przedział czasowy kompasu
 * @returns {ReactNode} Zawartość miękkiego kompasu
 */
function SoftCompassContent({ compassRange }: { compassRange: string }) {
  return (
    <div className="flex flex-col items-center text-center px-4">
      <Compass className="w-6 h-6 text-violet-400 animate-spin-slow mb-1" />
      <span className="text-[10px] font-semibold text-violet-300 uppercase tracking-wider">
        Okno gotowości do snu
      </span>
      <span className="text-sm font-bold text-slate-100 my-1">{compassRange}</span>
      <span className="text-[10px] text-slate-400 leading-tight">
        Wypatruj ziewania i tarcia oczu
      </span>
    </div>
  );
}

/**
 * Pierścień odliczający czas do kolejnego SweetSpot z obsługą trybu Anti-Orthosomnia.
 *
 * @param {SleepCountdownRingProps} props - Dane odliczania i uzasadnienie algorytmu
 * @returns {ReactNode} Widżet pierścienia snu
 */
export function SleepCountdownRing({
  isAntiOrthosomnia,
  countdownDisplay,
  sweetSpotTimeDisplay,
  compassRangeDisplay,
  reasonDescription,
}: SleepCountdownRingProps): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center my-2">
      <div className="relative w-52 h-52 rounded-full border-2 border-amber-500/20 bg-gradient-to-b from-[#151B28] to-[#0E1420] flex items-center justify-center shadow-2xl shadow-amber-500/5 p-4">
        <div className="absolute inset-1 rounded-full border border-dashed border-amber-400/20 animate-pulse pointer-events-none" />
        {isAntiOrthosomnia ? (
          <SoftCompassContent compassRange={compassRangeDisplay} />
        ) : (
          <ExactClockContent countdown={countdownDisplay} targetTime={sweetSpotTimeDisplay} />
        )}
      </div>
      <div className="mt-2.5 px-3 py-1 rounded-full bg-[#151B28] border border-[#263348] text-[11px] text-amber-300/90 flex items-center gap-1.5 shadow-sm">
        <Moon className="w-3 h-3 text-amber-400" />
        <span className="truncate max-w-[260px]">{reasonDescription}</span>
      </div>
    </div>
  );
}
