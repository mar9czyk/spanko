import { AnimatePresence, motion } from "framer-motion";
import { Compass, Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

interface SleepCountdownRingProps {
  readonly isAntiOrthosomnia: boolean;
  readonly countdownDisplay: string;
  readonly sweetSpotTimeDisplay: string;
  readonly compassRangeDisplay: string;
  readonly onToggleAntiOrthosomnia: () => void;
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

const HINT_KEY = "spanko.ringToggleHintSeen";
const HINT_VISIBLE_MS = 6000;

/**
 * Pierścień odliczający czas do kolejnego SweetSpot; stuknięcie przełącza zegar i miękki kompas Anti-Orthosomnia.
 *
 * @param {SleepCountdownRingProps} props - Dane odliczania i funkcja przełączająca widok
 * @returns {ReactNode} Widżet pierścienia snu
 */
export function SleepCountdownRing({
  isAntiOrthosomnia,
  countdownDisplay,
  sweetSpotTimeDisplay,
  compassRangeDisplay,
  onToggleAntiOrthosomnia,
}: SleepCountdownRingProps): ReactNode {
  const { t } = useI18n();
  const [isHintVisible, setIsHintVisible] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(HINT_KEY)) return;
      window.localStorage.setItem(HINT_KEY, "1");
    } catch {
      // brak localStorage: podpowiedź pokaże się przy każdej wizycie, co nie szkodzi
    }
    setIsHintVisible(true);
    const timer = setTimeout(() => setIsHintVisible(false), HINT_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleToggle = () => {
    setIsHintVisible(false);
    onToggleAntiOrthosomnia();
  };

  return (
    <div className="relative flex flex-col items-center justify-center my-2 gap-2">
      <motion.button
        type="button"
        onClick={handleToggle}
        aria-label={isAntiOrthosomnia ? t("ring.toClock") : t("ring.toCompass")}
        animate={isHintVisible ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={isHintVisible ? { duration: 1.2, repeat: 2 } : undefined}
        className="relative w-52 h-52 rounded-full border-2 border-amber-500/20 bg-gradient-to-b from-[#151B28] to-[#0E1420] flex items-center justify-center shadow-2xl shadow-amber-500/5 p-4"
      >
        <div className="absolute inset-1 rounded-full border border-dashed border-amber-400/20 animate-pulse pointer-events-none" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={isAntiOrthosomnia ? "compass" : "clock"}
            initial={{ opacity: 0, rotateY: 90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: -90 }}
            transition={{ duration: 0.18 }}
          >
            {isAntiOrthosomnia ? (
              <SoftCompassContent compassRange={compassRangeDisplay} />
            ) : (
              <ExactClockContent countdown={countdownDisplay} targetTime={sweetSpotTimeDisplay} />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.button>
      <div className="flex items-center gap-1.5" aria-hidden="true">
        <span
          className={`h-1.5 w-1.5 rounded-full ${isAntiOrthosomnia ? "bg-slate-600" : "bg-amber-400"}`}
        />
        <span
          className={`h-1.5 w-1.5 rounded-full ${isAntiOrthosomnia ? "bg-violet-400" : "bg-slate-600"}`}
        />
      </div>
      {isHintVisible && (
        <div
          role="status"
          className="absolute -bottom-9 z-10 px-3 py-1.5 rounded-xl bg-[#1E2738] border border-[#263348] text-sm text-amber-200 shadow-lg max-w-[280px] text-center"
        >
          {t("ring.hint")}
        </div>
      )}
    </div>
  );
}
