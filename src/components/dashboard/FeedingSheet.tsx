"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Milk, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { bottlePresets } from "@/i18n/translate";
import type { BreastSide } from "@/lib/types/database";
import { BottleVolumeInput } from "./BottleVolumeInput";
import { DEFAULT_BOTTLE_ML } from "./constants";

interface FeedingSheetProps {
  readonly isOpen: boolean;
  /** Strona, od której warto zacząć (przeciwna do ostatniej piersi). */
  readonly suggestedSide?: BreastSide;
  readonly onClose: () => void;
  readonly onSaveBreast: (side: BreastSide) => void;
  /** Butelka; bez ilości, gdy nie podano. */
  readonly onSaveBottle: (ml?: number) => void;
  /** Posiłek stały (bez szczegółów). */
  readonly onSaveSolid: () => void;
}

const TILE_CLASS =
  "relative flex min-h-24 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border border-[#263348] bg-[#1E2738] text-ink active:scale-98";

/**
 * Mały arkusz karmienia: duże kafelki L / P z podpowiedzią „teraz ta” i rząd butelki.
 * Dotknięcie zapisuje i zamyka arkusz; resztę (minuty, cofnięcie) załatwia toast.
 *
 * @param {FeedingSheetProps} props - Stan arkusza i zapis
 * @returns {ReactNode} Bottom sheet karmienia
 */
export function FeedingSheet({
  isOpen,
  suggestedSide,
  onClose,
  onSaveBreast,
  onSaveBottle,
  onSaveSolid,
}: FeedingSheetProps): ReactNode {
  const { t, units } = useI18n();
  const [isCustomBottle, setIsCustomBottle] = useState(false);
  const [customMl, setCustomMl] = useState(DEFAULT_BOTTLE_ML);

  useEffect(() => {
    if (isOpen) setIsCustomBottle(false);
  }, [isOpen]);

  const save = (action: () => void) => {
    action();
    onClose();
  };
  const sides: readonly { side: BreastSide; label: string; letter: string }[] = [
    { side: "left", label: t("feedSheet.left"), letter: t("entryToast.sideLeft") },
    { side: "right", label: t("feedSheet.right"), letter: t("entryToast.sideRight") },
  ];
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
            aria-label={t("feedSheet.title")}
            className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl border-t border-[#263348] bg-[#151B28] p-4 shadow-2xl"
          >
            <div className="mx-auto h-1 w-12 rounded-full bg-[#263348]" />
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Milk className="h-4 w-4 text-emerald-400" /> {t("feedSheet.title")}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.cancel")}
                className="rounded-full p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex gap-2">
              {sides.map(({ side, label, letter }) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => save(() => onSaveBreast(side))}
                  className={`${TILE_CLASS} ${suggestedSide === side ? "border-emerald-500/60" : ""}`}
                >
                  <span className="text-3xl font-bold">{letter}</span>
                  <span className="text-sm text-slate-300">{label}</span>
                  {suggestedSide === side && (
                    <span className="text-xs font-semibold text-emerald-300">
                      {t("feedSheet.next")}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              <button
                type="button"
                onClick={() => save(() => onSaveBottle())}
                className="min-h-12 flex-1 whitespace-nowrap rounded-xl border border-[#263348] bg-[#1E2738] px-2 text-sm font-medium text-emerald-300"
              >
                {t("feedSheet.bottle")}
              </button>
              {bottlePresets(units).map((preset) => (
                <button
                  key={preset.ml}
                  type="button"
                  onClick={() => save(() => onSaveBottle(preset.ml))}
                  className="min-h-12 flex-1 whitespace-nowrap rounded-xl border border-[#263348] bg-[#1E2738] px-2 text-sm font-medium tabular-nums text-emerald-300"
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                aria-expanded={isCustomBottle}
                onClick={() => setIsCustomBottle((open) => !open)}
                className={`min-h-12 flex-1 whitespace-nowrap rounded-xl border px-2 text-sm font-medium ${isCustomBottle ? "border-emerald-500/60 bg-emerald-900/50 text-emerald-200" : "border-[#263348] bg-[#151B28] text-slate-300"}`}
              >
                {t("bottle.other")}
              </button>
            </div>
            <button
              type="button"
              onClick={() => save(onSaveSolid)}
              className="min-h-12 rounded-xl border border-[#263348] bg-[#1E2738] px-2 text-sm font-medium text-emerald-300"
            >
              {t("feedSheet.solid")}
            </button>
            {isCustomBottle && (
              <div className="flex flex-col gap-2">
                <BottleVolumeInput valueMl={customMl} onChange={setCustomMl} />
                <button
                  type="button"
                  onClick={() => save(() => onSaveBottle(customMl))}
                  className="min-h-12 rounded-xl bg-emerald-600 text-sm font-semibold text-white"
                >
                  {t("bottle.save")}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
