import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { ActiveDayMode } from "@/lib/types/database";
import { DAY_MODE_OPTIONS, type DayModeConfigItem } from "./constants";

interface DayModeSwitcherProps {
  readonly currentMode: ActiveDayMode;
  readonly onSelectMode: (mode: ActiveDayMode) => void;
}

/**
 * Zwraca klasy stylów Tailwind dla pigułki trybu dnia w zależności od stanu aktywności.
 *
 * @param {boolean} isActive - Czy dany tryb jest obecnie wybrany
 * @returns {string} Ciąg klas stylów
 */
function resolveModeItemStyle(isActive: boolean): string {
  if (isActive) {
    return "bg-[#1E2738] text-amber-400 border-amber-500/40 shadow-sm shadow-amber-500/10";
  }
  return "bg-transparent text-slate-400 border-transparent hover:text-slate-200";
}

/**
 * Pojedynczy przycisk pigułki wyboru trybu dnia.
 *
 * @param {object} props - Właściwości pigułki
 * @returns {ReactNode} Element przycisku
 */
function ModePill({
  item,
  isActive,
  onSelect,
}: {
  item: DayModeConfigItem;
  isActive: boolean;
  onSelect: (mode: ActiveDayMode) => void;
}): ReactNode {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => onSelect(item.mode)}
      className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg border transition-all flex items-center justify-center gap-1 min-h-[36px] ${resolveModeItemStyle(
        isActive,
      )}`}
      title={t(item.descKey)}
    >
      <span>{item.icon}</span>
      <span className="truncate">{t(item.labelKey)}</span>
    </button>
  );
}

/**
 * Przełącznik Trybu Dnia dla dziecka (W domu, W drodze, Choroba/Regresja).
 *
 * @description
 * Umożliwia natychmiastowe dostosowanie okien czuwania jednym dotknięciem kciuka.
 *
 * @param {DayModeSwitcherProps} props - Właściwości komponentu
 * @returns {ReactNode} Wyrenderowany przełącznik
 */
export function DayModeSwitcher({ currentMode, onSelectMode }: DayModeSwitcherProps): ReactNode {
  return (
    <div className="flex items-center gap-1 bg-[#151B28] p-1 rounded-xl border border-[#263348]/60 w-full">
      {DAY_MODE_OPTIONS.map((item) => (
        <ModePill
          key={item.mode}
          item={item}
          isActive={currentMode === item.mode}
          onSelect={onSelectMode}
        />
      ))}
    </div>
  );
}
