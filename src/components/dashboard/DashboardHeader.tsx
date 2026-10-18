import { Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { ActiveDayMode, ChildRecord } from "@/lib/types/database";
import { AntiOrthosomniaToggle } from "./AntiOrthosomniaToggle";
import { DayModeSwitcher } from "./DayModeSwitcher";

interface DashboardHeaderProps {
  readonly child: ChildRecord;
  readonly ageDisplay: string;
  readonly onSelectDayMode: (mode: ActiveDayMode) => void;
  readonly onToggleAntiOrthosomnia: () => void;
}

/**
 * Prezentuje miniaturę awatara i dane wiekowe dziecka.
 *
 * @param {object} props - Dziecko i sformatowany wiek
 * @returns {ReactNode} Awatar i etykieta profilu
 */
function ChildIdentityBadge({ child, ageDisplay }: { child: ChildRecord; ageDisplay: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500/20 to-violet-500/20 border border-amber-500/30 flex items-center justify-center font-bold text-amber-300 text-sm shadow-inner">
        {child.name.charAt(0).toUpperCase()}
      </div>
      <div>
        <h1 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5 leading-tight">
          {child.name}
          <span className="text-[11px] font-normal text-slate-400">({ageDisplay})</span>
        </h1>
        <p className="text-[10px] text-slate-500">3 AM One-Thumb Mode</p>
      </div>
    </div>
  );
}

/**
 * Górny pasek nawigacyjny z tożsamością dziecka, trybem dnia i kompasem Anti-Orthosomnia.
 *
 * @param {DashboardHeaderProps} props - Parametry nagłówka
 * @returns {ReactNode} Nagłówek pulpitu
 */
export function DashboardHeader({
  child,
  ageDisplay,
  onSelectDayMode,
  onToggleAntiOrthosomnia,
}: DashboardHeaderProps): ReactNode {
  return (
    <header className="flex flex-col gap-2.5 w-full pt-1 pb-2">
      <div className="flex items-center justify-between">
        <ChildIdentityBadge child={child} ageDisplay={ageDisplay} />
        <div className="flex items-center gap-1.5">
          <Link
            href="/insights"
            className="p-1.5 rounded-xl bg-[#1E2738] text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-[#263348] transition-colors"
            title="Karta Rozwoju Snu Dziecka"
          >
            <Sparkles className="w-4 h-4" />
          </Link>
          <AntiOrthosomniaToggle
            isActive={child.anti_orthosomnia_mode}
            onToggle={onToggleAntiOrthosomnia}
          />
        </div>
      </div>
      <DayModeSwitcher currentMode={child.active_day_mode} onSelectMode={onSelectDayMode} />
    </header>
  );
}
