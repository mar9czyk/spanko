"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { ActiveDayMode } from "@/lib/types/database";
import { DAY_MODE_OPTIONS, type DayModeConfigItem } from "./constants";

interface DayModeSheetProps {
  readonly isOpen: boolean;
  readonly currentMode: ActiveDayMode;
  readonly onClose: () => void;
  readonly onSelectMode: (mode: ActiveDayMode) => void;
}

interface DayModeBadgeProps {
  readonly currentMode: ActiveDayMode;
  readonly onTurnOff: () => void;
}

/**
 * Zwraca klasy stylów Tailwind dla opcji trybu dnia w zależności od stanu aktywności.
 *
 * @param {boolean} isActive - Czy dany tryb jest obecnie wybrany
 * @returns {string} Ciąg klas stylów
 */
function resolveModeItemStyle(isActive: boolean): string {
  if (isActive) {
    return "bg-[#1E2738] text-amber-400 border-amber-500/40 shadow-sm shadow-amber-500/10";
  }
  return "bg-transparent text-slate-300 border-[#263348] hover:text-slate-100";
}

/**
 * Pojedyncza opcja trybu dnia w panelu.
 *
 * @param {object} props - Właściwości opcji
 * @returns {ReactNode} Element przycisku
 */
function ModeOption({
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
      aria-pressed={isActive}
      className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left min-h-[52px] transition-all ${resolveModeItemStyle(
        isActive,
      )}`}
    >
      <span className="text-xl">{item.icon}</span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{t(item.labelKey)}</span>
        <span className="text-xs text-slate-400">{t(item.descKey)}</span>
      </span>
    </button>
  );
}

/**
 * Dolny panel wyboru Trybu Dnia (W domu, W drodze, Choroba/Regresja).
 *
 * @description
 * Tryby „W drodze” i „Choroba” włącza się rzadko, więc nie zajmują miejsca na pulpicie.
 * Wybór zamyka panel.
 *
 * @param {DayModeSheetProps} props - Właściwości panelu
 * @returns {ReactNode} Wyrenderowany panel
 */
export function DayModeSheet({
  isOpen,
  currentMode,
  onClose,
  onSelectMode,
}: DayModeSheetProps): ReactNode {
  const { t } = useI18n();
  const handleSelect = (mode: ActiveDayMode) => {
    onSelectMode(mode);
    onClose();
  };
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="relative w-full max-w-md bg-[#151B28] border-t border-[#263348] rounded-t-3xl p-4 flex flex-col gap-3 shadow-2xl z-10"
          >
            <div className="mx-auto w-12 h-1 bg-[#263348] rounded-full" />
            <div className="flex w-full items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">{t("dayMode.menuTitle")}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.back")}
                className="p-1 rounded-full text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {DAY_MODE_OPTIONS.map((item) => (
              <ModeOption
                key={item.mode}
                item={item}
                isActive={currentMode === item.mode}
                onSelect={handleSelect}
              />
            ))}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * Znacznik aktywnego trybu dnia (poza „W domu”) z wyłączeniem jednym stuknięciem.
 *
 * @param {DayModeBadgeProps} props - Aktywny tryb i akcja wyłączenia
 * @returns {ReactNode} Znacznik lub null, gdy tryb to „W domu”
 */
export function DayModeBadge({ currentMode, onTurnOff }: DayModeBadgeProps): ReactNode {
  const { t } = useI18n();
  const item = DAY_MODE_OPTIONS.find((option) => option.mode === currentMode);
  if (currentMode === "home" || !item) return null;
  return (
    <button
      type="button"
      onClick={onTurnOff}
      aria-label={t("dayMode.turnOff")}
      title={t("dayMode.turnOff")}
      className="self-start inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 pl-3 pr-2 py-1.5 text-xs font-medium text-amber-300 min-h-[36px]"
    >
      <span>{item.icon}</span>
      <span>{t("dayMode.badge", { mode: t(item.labelKey) })}</span>
      <X className="w-4 h-4" />
    </button>
  );
}
