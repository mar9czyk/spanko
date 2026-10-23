import { Droplets, Milk, Moon, Plus, Sparkles, Sun, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { SleepLogRecord } from "@/lib/types/database";

interface FloatingActionBarProps {
  readonly currentSleepLog: SleepLogRecord | null;
  readonly onCycleSleepStatus: () => void;
  readonly onQuickNightWake: () => void;
  readonly onOpenFeeding: () => void;
  readonly onOpenTags: () => void;
  readonly onQuickDiaper: () => void;
}

const TILE_CLASS =
  "w-16 h-[56px] rounded-2xl bg-[#1E2738] hover:bg-[#253248] border border-[#263348] flex flex-col items-center justify-center gap-0.5 shadow-md active:scale-98 transition-all shrink-0 text-xs font-medium text-slate-200";

/**
 * Wielki przycisk pobudki nocnej: jedno dotknięcie zapisuje pobudkę, a toast pyta, czym uspokojono.
 *
 * @param {object} props - Callback dotknięcia
 * @returns {ReactNode} Przycisk pobudki
 */
function NightWakeButton({ onWake }: { onWake: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onWake}
      className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-98 transition-all min-h-[56px]"
    >
      <Zap className="w-5 h-5 fill-current" />
      <span>{t("fab.nightWake")}</span>
    </button>
  );
}

/**
 * Konfiguracja etykiety, ikony i stylów głównego przycisku snu: Usypiam → Zasnął → Wstał.
 *
 * @param {SleepLogRecord | null} log - Aktywny rekord snu
 * @param {boolean} isOutlined - Wstał jako przycisk drugiego planu (nocą nad nim jest „Pobudka”)
 * @returns {object} Konfiguracja przycisku
 */
function resolveCycleButtonConfig(log: SleepLogRecord | null, isOutlined: boolean) {
  if (!log || log.status === "completed") {
    return {
      labelKey: "fab.start" as const,
      icon: <Moon className="w-5 h-5" />,
      style: "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20",
    };
  }
  if (log.status === "falling_asleep") {
    return {
      labelKey: "fab.asleep" as const,
      icon: <Sparkles className="w-5 h-5" />,
      style: "bg-violet-600 hover:bg-violet-500 text-white shadow-violet-500/25",
    };
  }
  return {
    labelKey: log.type === "night" ? ("fab.wakeNight" as const) : ("fab.wake" as const),
    icon: <Sun className="w-5 h-5" />,
    style: isOutlined
      ? "bg-transparent border-2 border-emerald-500/70 text-emerald-300 hover:bg-emerald-950/40"
      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20",
  };
}

/**
 * Główny przycisk przejścia w cyklu snu: jedno słowo i ikona.
 *
 * @param {object} props - Aktywny log, handler przejścia i wariant obrysowany
 * @returns {ReactNode} Przycisk cyklu
 */
function SleepCycleButton({
  log,
  onCycle,
  isOutlined,
}: {
  log: SleepLogRecord | null;
  onCycle: () => void;
  isOutlined: boolean;
}) {
  const { t } = useI18n();
  const config = resolveCycleButtonConfig(log, isOutlined);

  return (
    <button
      type="button"
      onClick={onCycle}
      className={`flex-1 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all h-[56px] ${config.style}`}
    >
      {config.icon}
      <span>{t(config.labelKey)}</span>
    </button>
  );
}

/**
 * Dolny pasek akcji zoptymalizowany pod jeden kciuk: Karmienie / Pielucha / sen / „+” (tagi dnia).
 * W nocy nad paskiem dochodzi duży przycisk „Pobudka”, a „Wstał” jest obrysowany.
 *
 * @param {FloatingActionBarProps} props - Stan snu i handlery interakcji
 * @returns {ReactNode} Pasek akcji na dole ekranu
 */
export function FloatingActionBar({
  currentSleepLog,
  onCycleSleepStatus,
  onQuickNightWake,
  onOpenFeeding,
  onOpenTags,
  onQuickDiaper,
}: FloatingActionBarProps): ReactNode {
  const { t } = useI18n();
  const isNightSleeping =
    currentSleepLog?.type === "night" && currentSleepLog.status === "sleeping";

  return (
    <aside className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none pb-2">
      <div className="w-full max-w-md px-3 pt-2 pb-1 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/95 to-transparent pointer-events-auto flex flex-col gap-2">
        {isNightSleeping && <NightWakeButton onWake={onQuickNightWake} />}
        <div className="flex items-center gap-2">
          <button type="button" onClick={onOpenFeeding} className={TILE_CLASS}>
            <Milk className="w-5 h-5 text-emerald-400" />
            <span>{t("fab.feeding")}</span>
          </button>
          <button type="button" onClick={onQuickDiaper} className={TILE_CLASS}>
            <Droplets className="w-5 h-5 text-diaper" />
            <span>{t("fab.diaper")}</span>
          </button>
          <SleepCycleButton
            log={currentSleepLog}
            onCycle={onCycleSleepStatus}
            isOutlined={isNightSleeping}
          />
          <button
            type="button"
            onClick={onOpenTags}
            aria-label={t("fab.add")}
            title={t("fab.add")}
            className="w-12 h-[56px] rounded-2xl bg-[#1E2738] hover:bg-[#253248] border border-[#263348] flex items-center justify-center shadow-md active:scale-98 transition-all shrink-0"
          >
            <Plus className="w-5 h-5 text-amber-400" />
          </button>
        </div>
      </div>
    </aside>
  );
}
