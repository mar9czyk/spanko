"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { DAY_TAG_PRESETS } from "./constants";

interface QuickEntryBottomSheetProps {
  readonly isOpen: boolean;
  /** Tagi włączone w bieżącej dobie (klucze znormalizowane). */
  readonly activeTags: readonly string[];
  readonly onClose: () => void;
  readonly onToggleTag: (tag: string) => void;
}

/**
 * Arkusz „Co dziś wpływa na sen?”: wielokrotny wybór tagów doby. Zostaje otwarty po
 * dotknięciu, żeby zaznaczyć kilka naraz; zamyka go „Gotowe”.
 *
 * @param {QuickEntryBottomSheetProps} props - Stan widoczności, aktywne tagi i przełącznik
 * @returns {ReactNode} Komponent Bottom Sheet
 */
export function QuickEntryBottomSheet({
  isOpen,
  activeTags,
  onClose,
  onToggleTag,
}: QuickEntryBottomSheetProps): ReactNode {
  const { t, tDynamic } = useI18n();
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
            role="dialog"
            aria-modal="true"
            aria-label={t("sheet.title")}
            className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl border-t border-[#263348] bg-[#151B28] p-4 shadow-2xl"
          >
            <div className="mx-auto h-1 w-12 rounded-full bg-[#263348]" />
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-sm font-semibold text-ink">{t("sheet.title")}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.cancel")}
                className="rounded-full p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {DAY_TAG_PRESETS.map((tag) => {
                const selected = activeTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onToggleTag(tag)}
                    className={`min-h-12 rounded-xl border px-3 text-sm ${selected ? "border-violet-400/70 bg-violet-950/60 text-violet-100" : "border-[#263348] bg-[#1E2738] text-violet-300"}`}
                  >
                    {selected && (
                      <Check aria-hidden="true" className="-mt-0.5 mr-1 inline h-4 w-4" />
                    )}
                    {tDynamic(`tag.${tag}`, tag)}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 rounded-xl bg-amber-500 text-sm font-semibold text-[#0B0F17]"
            >
              {t("sheet.done")}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
