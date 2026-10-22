import { Compass, Moon, Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

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
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs font-medium text-amber-400/80 uppercase tracking-widest flex items-center gap-1">
        <Sparkles className="w-3 h-3 text-amber-400" /> SweetSpot
      </span>
      <span className="text-3xl font-extrabold text-ink tracking-tight tabular-nums my-0.5">
        {countdown}
      </span>
      <span className="text-sm text-slate-400">{t("ring.approx", { time: targetTime })}</span>
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
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center text-center px-4">
      <Compass className="w-6 h-6 text-violet-400 animate-spin-slow mb-1" />
      <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">
        {t("ring.window")}
      </span>
      <span className="text-sm font-bold text-ink my-1">{compassRange}</span>
      <span className="text-sm text-slate-400 leading-tight">{t("ring.watch")}</span>
    </div>
  );
}

const TOOLTIP_VISIBLE_MS = 4000;

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
  const { t } = useI18n();
  const [isReasonVisible, setIsReasonVisible] = useState(false);
  useEffect(() => {
    if (!isReasonVisible) return;
    const timer = setTimeout(() => setIsReasonVisible(false), TOOLTIP_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [isReasonVisible]);

  return (
    <div className="relative flex flex-col items-center justify-center my-2">
      <button
        type="button"
        onClick={() => setIsReasonVisible((visible) => !visible)}
        aria-label={t("ring.reasonHint")}
        aria-expanded={isReasonVisible}
        className="relative w-52 h-52 rounded-full border-2 border-amber-500/20 bg-gradient-to-b from-[#151B28] to-[#0E1420] flex items-center justify-center shadow-2xl shadow-amber-500/5 p-4"
      >
        <div className="absolute inset-1 rounded-full border border-dashed border-amber-400/20 animate-pulse pointer-events-none" />
        {isAntiOrthosomnia ? (
          <SoftCompassContent compassRange={compassRangeDisplay} />
        ) : (
          <ExactClockContent countdown={countdownDisplay} targetTime={sweetSpotTimeDisplay} />
        )}
      </button>
      {isReasonVisible && (
        <div
          role="status"
          className="absolute -bottom-3 z-10 px-3 py-1.5 rounded-xl bg-[#1E2738] border border-[#263348] text-sm text-amber-200 flex items-center gap-1.5 shadow-lg max-w-[280px]"
        >
          <Moon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{reasonDescription}</span>
        </div>
      )}
    </div>
  );
}
