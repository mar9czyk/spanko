"use client";

import { AnimatePresence, motion, type PanInfo, useDragControls } from "framer-motion";
import { Battery, ChevronsDown, ChevronsUp, Lightbulb, Moon, Target, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/messages";
import type { DayDetailTab } from "./DayBubbles";

const CLOSE_DRAG_PX = 100;
const CLOSE_VELOCITY = 500;
const EXPAND_DRAG_PX = 50;
const SWIPE_PX = 60;
const SWIPE_AXIS_RATIO = 1.5;
const SLIDE_OFFSET_PX = 24;

const TAB_META: Record<DayDetailTab, { labelKey: MessageKey; icon: ReactNode }> = {
  battery: { labelKey: "bubble.battery", icon: <Battery className="w-5 h-5" /> },
  goal: { labelKey: "bubble.goal", icon: <Target className="w-5 h-5" /> },
  insight: { labelKey: "bubble.insight", icon: <Lightbulb className="w-5 h-5" /> },
  nap: { labelKey: "bubble.nap", icon: <Moon className="w-5 h-5" /> },
};

interface DayDetailSheetProps {
  /** Aktywna zakładka; null = arkusz zamknięty. */
  readonly activeTab: DayDetailTab | null;
  /** Zakładki dostępne w tej chwili, w kolejności wyświetlania. */
  readonly tabs: readonly DayDetailTab[];
  readonly panels: Readonly<Record<DayDetailTab, ReactNode>>;
  readonly onChangeTab: (tab: DayDetailTab) => void;
  readonly onClose: () => void;
}

/**
 * Jeden wspólny arkusz od dołu dla wszystkich bąbelków: otwiera się na połowie ekranu na
 * zakładce klikniętego bąbelka. Przesunięcie w bok zmienia zakładkę, w dół (lub stuknięcie
 * obok) zamyka, w górę rozciąga do pełnej wysokości. Nigdy nie otwiera kolejnego arkusza.
 *
 * @param {DayDetailSheetProps} props - Zakładki, zawartość paneli i handlery
 * @returns {ReactNode} Arkusz szczegółów dnia
 */
export function DayDetailSheet({
  activeTab,
  tabs,
  panels,
  onChangeTab,
  onClose,
}: DayDetailSheetProps): ReactNode {
  const { t } = useI18n();
  const dragControls = useDragControls();
  const [isExpanded, setIsExpanded] = useState(false);
  const direction = useRef(0);
  const isOpen = activeTab !== null;

  useEffect(() => {
    if (!isOpen) setIsExpanded(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const selectTab = (tab: DayDetailTab) => {
    if (!activeTab || tab === activeTab) return;
    direction.current = tabs.indexOf(tab) > tabs.indexOf(activeTab) ? 1 : -1;
    onChangeTab(tab);
  };

  const shiftTab = (step: 1 | -1) => {
    if (!activeTab) return;
    const next = tabs[tabs.indexOf(activeTab) + step];
    if (next) selectTab(next);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y < -EXPAND_DRAG_PX) {
      setIsExpanded(true);
    } else if (info.offset.y > CLOSE_DRAG_PX || info.velocity.y > CLOSE_VELOCITY) {
      if (isExpanded) setIsExpanded(false);
      else onClose();
    }
  };

  const handleBodyPanEnd = (_: unknown, info: PanInfo) => {
    const { x, y } = info.offset;
    if (Math.abs(x) < SWIPE_PX || Math.abs(x) < Math.abs(y) * SWIPE_AXIS_RATIO) return;
    shiftTab(x < 0 ? 1 : -1);
  };

  return (
    <AnimatePresence>
      {activeTab && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("bubble.group")}
            initial={{ y: "100%" }}
            animate={{ y: 0, height: isExpanded ? "92dvh" : "50dvh" }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.1, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            className="relative w-full max-w-md bg-[#151B28] border-t border-[#263348] rounded-t-3xl flex flex-col shadow-2xl z-10"
          >
            <div
              onPointerDown={(event) => dragControls.start(event)}
              style={{ touchAction: "none" }}
              className="px-4 pt-3 flex flex-col gap-2 shrink-0"
            >
              <div className="w-12 h-1 bg-[#263348] rounded-full mx-auto" />
              <div className="flex items-center gap-2">
                <div
                  role="tablist"
                  className="flex-1 grid gap-1"
                  style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
                >
                  {tabs.map((tab) => {
                    const meta = TAB_META[tab];
                    const isActive = tab === activeTab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => selectTab(tab)}
                        className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs ${isActive ? "bg-[#1E2738] text-amber-300" : "text-slate-400"}`}
                      >
                        {meta.icon}
                        <span className="truncate max-w-full px-1">{t(meta.labelKey)}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setIsExpanded((expanded) => !expanded)}
                  aria-label={isExpanded ? t("bubble.collapse") : t("bubble.expand")}
                  className="w-12 h-12 shrink-0 rounded-full text-slate-400 flex items-center justify-center"
                >
                  {isExpanded ? (
                    <ChevronsDown className="w-5 h-5" />
                  ) : (
                    <ChevronsUp className="w-5 h-5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t("bubble.close")}
                  className="w-12 h-12 shrink-0 rounded-full text-slate-400 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <motion.div
              onPanEnd={handleBodyPanEnd}
              style={{ touchAction: "pan-y" }}
              className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-8"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: direction.current * SLIDE_OFFSET_PX }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {panels[activeTab]}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
