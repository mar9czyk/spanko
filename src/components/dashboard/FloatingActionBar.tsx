import { Droplets, Milk, Play, Plus, Sparkles, Square, Zap } from "lucide-react";
import type { ReactNode } from "react";
import type { SleepLogRecord } from "@/lib/types/database";

interface FloatingActionBarProps {
  readonly currentSleepLog: SleepLogRecord | null;
  readonly onCycleSleepStatus: () => void;
  readonly onQuickNightWake: () => void;
  readonly onOpenQuickEntry: () => void;
  readonly onQuickBottle: () => void;
  readonly onQuickDiaper: () => void;
}

/**
 * Wielki przycisk szybkiej rejestracji pobudki nocnej lub karmienia w 1-tap.
 *
 * @param {object} props - Callback dotknięcia
 * @returns {ReactNode} Przycisk szybkiej pobudki
 */
function NightQuickWakeButton({ onQuickWake }: { onQuickWake: () => void }) {
  return (
    <button
      type="button"
      onClick={onQuickWake}
      className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-98 transition-all min-h-[52px]"
    >
      <Zap className="w-5 h-5 fill-current" />
      <span>⚡ Szybka pobudka / Mleko</span>
    </button>
  );
}

/**
 * Zwraca konfigurację etykiety, ikony i stylów dla głównego przycisku cyklu snu.
 *
 * @param {SleepLogRecord | null} log - Aktywny rekord snu
 * @returns {object} Konfiguracja przycisku
 */
function resolveCycleButtonConfig(log: SleepLogRecord | null) {
  if (!log || log.status === "completed") {
    return {
      label: "Start usypiania",
      icon: <Play className="w-4 h-4 fill-current" />,
      style: "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20",
    };
  }
  if (log.status === "falling_asleep") {
    return {
      label: "Zasnął",
      icon: <Sparkles className="w-4 h-4" />,
      style: "bg-violet-600 hover:bg-violet-500 text-white shadow-violet-500/25",
    };
  }
  const isNight = log.type === "night";
  return {
    label: isNight ? "Obudził się na dzień" : "Obudził się",
    icon: <Square className="w-4 h-4 fill-current" />,
    style: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20",
  };
}

/**
 * Główny przycisk przejścia w cyklu snu: [Start usypiania] -> [Zasnął] -> [Obudził się].
 *
 * @param {object} props - Aktywny log i handler przejścia
 * @returns {ReactNode} Przycisk cyklu
 */
function SleepCycleButton({ log, onCycle }: { log: SleepLogRecord | null; onCycle: () => void }) {
  const config = resolveCycleButtonConfig(log);

  return (
    <button
      type="button"
      onClick={onCycle}
      className={`flex-1 py-3 px-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all min-h-[50px] ${config.style}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </button>
  );
}

/**
 * Dolny Floating Action Bar (FAB) zoptymalizowany pod obsługę jednym kciukiem.
 *
 * @param {FloatingActionBarProps} props - Stan snu i handlery interakcji
 * @returns {ReactNode} Pasek akcji na dole ekranu
 */
export function FloatingActionBar({
  currentSleepLog,
  onCycleSleepStatus,
  onQuickNightWake,
  onOpenQuickEntry,
  onQuickBottle,
  onQuickDiaper,
}: FloatingActionBarProps): ReactNode {
  const isNightSleepActive =
    currentSleepLog?.type === "night" &&
    (currentSleepLog.status === "sleeping" || currentSleepLog.status === "falling_asleep");

  return (
    <aside className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none pb-2">
      <div className="w-full max-w-md px-3 pt-2 pb-1 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/95 to-transparent pointer-events-auto flex flex-col gap-2">
        {isNightSleepActive && <NightQuickWakeButton onQuickWake={onQuickNightWake} />}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onQuickBottle}
            className="w-12 h-[50px] rounded-2xl bg-[#1E2738] hover:bg-[#253248] border border-[#263348] flex items-center justify-center shadow-md active:scale-98 transition-all shrink-0"
            title="Butelka teraz (ostatnia objętość)"
          >
            <Milk className="w-5 h-5 text-emerald-400" />
          </button>
          <button
            type="button"
            onClick={onQuickDiaper}
            className="w-12 h-[50px] rounded-2xl bg-[#1E2738] hover:bg-[#253248] border border-[#263348] flex items-center justify-center shadow-md active:scale-98 transition-all shrink-0"
            title="Mokra pielucha teraz"
          >
            <Droplets className="w-5 h-5 text-sky-400" />
          </button>
          <SleepCycleButton log={currentSleepLog} onCycle={onCycleSleepStatus} />
          <button
            type="button"
            onClick={onOpenQuickEntry}
            className="w-14 h-[50px] rounded-2xl bg-[#1E2738] hover:bg-[#253248] text-slate-200 border border-[#263348] flex items-center justify-center shadow-md active:scale-98 transition-all shrink-0"
            title="Dodaj wpis karmienia, nastroju lub tagu"
          >
            <Plus className="w-5 h-5 text-amber-400" />
          </button>
        </div>
      </div>
    </aside>
  );
}
