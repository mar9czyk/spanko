import { History, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { ActiveDayMode, ChildRecord } from "@/lib/types/database";
import { AntiOrthosomniaToggle } from "./AntiOrthosomniaToggle";
import { ChildPhotoSheet } from "./ChildPhotoSheet";
import { ChildSwitcher } from "./ChildSwitcher";
import { DayModeSwitcher } from "./DayModeSwitcher";
import { useIsAdmin } from "./useIsAdmin";

interface DashboardHeaderProps {
  readonly child: ChildRecord;
  readonly householdChildren: readonly ChildRecord[];
  readonly ageDisplay: string;
  readonly onSelectChild: (childId: string) => void;
  readonly onSelectDayMode: (mode: ActiveDayMode) => void;
  readonly onToggleAntiOrthosomnia: () => void;
  /** Zapis zdjęcia aktywnego dziecka; brak = zdjęć nie da się zmieniać (dane demo) */
  readonly onChangeChildPhoto?: (file: File | null) => Promise<boolean>;
}

/**
 * Górny pasek nawigacyjny z tożsamością i przełącznikiem dziecka, trybem dnia i kompasem Anti-Orthosomnia.
 *
 * @param {DashboardHeaderProps} props - Parametry nagłówka
 * @returns {ReactNode} Nagłówek pulpitu
 */
export function DashboardHeader({
  child,
  householdChildren,
  ageDisplay,
  onSelectChild,
  onSelectDayMode,
  onToggleAntiOrthosomnia,
  onChangeChildPhoto,
}: DashboardHeaderProps): ReactNode {
  const { t } = useI18n();
  const isAdmin = useIsAdmin();
  const [isPhotoSheetOpen, setIsPhotoSheetOpen] = useState(false);
  return (
    <header className="flex flex-col gap-2.5 w-full pt-1 pb-2">
      <div className="flex items-start justify-between gap-2">
        <ChildSwitcher
          childrenList={householdChildren}
          activeChild={child}
          ageDisplay={ageDisplay}
          onSelectChild={onSelectChild}
          onOpenPhoto={onChangeChildPhoto ? () => setIsPhotoSheetOpen(true) : undefined}
        />
        <div className="flex shrink-0 items-center gap-1.5">
          {isAdmin && (
            <Link
              href="/admin"
              className="p-1.5 rounded-xl bg-[#1E2738] text-violet-300 hover:text-violet-200 hover:bg-violet-500/10 border border-[#263348] transition-colors"
              title={t("header.adminTitle")}
              aria-label={t("header.adminTitle")}
            >
              <ShieldCheck className="w-4 h-4" />
            </Link>
          )}
          <Link
            href="/history"
            className="p-1.5 rounded-xl bg-[#1E2738] text-slate-300 hover:text-amber-300 hover:bg-amber-500/10 border border-[#263348] transition-colors"
            title={t("header.historyTitle")}
            aria-label={t("header.historyTitle")}
          >
            <History className="w-4 h-4" />
          </Link>
          <Link
            href="/insights"
            className="p-1.5 rounded-xl bg-[#1E2738] text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-[#263348] transition-colors"
            title={t("header.insightsTitle")}
          >
            <Sparkles className="w-4 h-4" />
          </Link>
          <Link
            href="/settings"
            className="p-1.5 rounded-xl bg-[#1E2738] text-slate-300 hover:text-amber-300 hover:bg-amber-500/10 border border-[#263348] transition-colors"
            title={t("header.preferences")}
            aria-label={t("header.preferences")}
          >
            <UserRound className="w-4 h-4" />
          </Link>
          <AntiOrthosomniaToggle
            isActive={child.anti_orthosomnia_mode}
            onToggle={onToggleAntiOrthosomnia}
          />
        </div>
      </div>
      <DayModeSwitcher currentMode={child.active_day_mode} onSelectMode={onSelectDayMode} />
      {onChangeChildPhoto && (
        <ChildPhotoSheet
          child={child}
          isOpen={isPhotoSheetOpen}
          onClose={() => setIsPhotoSheetOpen(false)}
          onChangePhoto={onChangeChildPhoto}
        />
      )}
    </header>
  );
}
