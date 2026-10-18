"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Milk, Smile, Tag, X } from "lucide-react";
import type { ReactNode } from "react";
import type { BreastSide, FeedingType, InterventionLevel, SleepMood } from "@/lib/types/database";
import {
  BOTTLE_VOLUME_PRESETS,
  DAY_TAG_PRESETS,
  INTERVENTION_OPTIONS,
  MOOD_OPTIONS,
} from "./constants";

interface QuickEntryBottomSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSaveFeeding: (
    type: FeedingType,
    details: { side?: BreastSide; ml?: number; notes?: string },
  ) => void;
  readonly onSaveMoodAndIntervention: (
    mood: SleepMood,
    interventions: readonly InterventionLevel[],
  ) => void;
  readonly onSaveDayTag: (tag: string) => void;
}

/**
 * Sekcja rejestracji karmienia piersią lub butelką.
 *
 * @param {object} props - Callback zapisu karmienia
 * @returns {ReactNode} Kafelki karmienia
 */
function FeedingSection({
  onSelect,
}: {
  onSelect: (
    type: FeedingType,
    details: { side?: BreastSide; ml?: number; notes?: string },
  ) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <Milk className="w-3.5 h-3.5 text-emerald-400" /> Karmienie
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSelect("breast", { side: "left" })}
          className="flex-1 py-2 px-2 rounded-xl bg-[#1E2738] hover:bg-emerald-950/40 text-xs font-medium text-slate-200 border border-[#263348] hover:border-emerald-500/40"
        >
          Pierś Lewa
        </button>
        <button
          type="button"
          onClick={() => onSelect("breast", { side: "right" })}
          className="flex-1 py-2 px-2 rounded-xl bg-[#1E2738] hover:bg-emerald-950/40 text-xs font-medium text-slate-200 border border-[#263348] hover:border-emerald-500/40"
        >
          Pierś Prawa
        </button>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
        {BOTTLE_VOLUME_PRESETS.map((volume) => (
          <button
            key={volume}
            type="button"
            onClick={() => onSelect("bottle", { ml: volume })}
            className="flex-1 py-2 px-2 rounded-xl bg-[#1E2738] hover:bg-emerald-950/40 text-xs font-mono font-medium text-emerald-300 border border-[#263348] whitespace-nowrap"
          >
            {volume} ml
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Sekcja rejestracji nastroju dziecka i interwencji usypiania.
 *
 * @param {object} props - Wybór nastroju i interwencji
 * @returns {ReactNode} Pigułki nastroju
 */
function MoodAndInterventionsSection({
  onSave,
}: {
  onSave: (mood: SleepMood, interventions: readonly InterventionLevel[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <Smile className="w-3.5 h-3.5 text-amber-400" /> Nastrój i interwencja
      </span>
      <div className="flex items-center gap-1.5">
        {MOOD_OPTIONS.map((mood) => (
          <button
            key={mood.value}
            type="button"
            onClick={() => onSave(mood.value, ["pacifier_reinsert"])}
            className={`flex-1 py-2 px-2 rounded-xl bg-[#1E2738] hover:bg-[#253248] text-xs font-medium border ${mood.colorClass}`}
          >
            {mood.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {INTERVENTION_OPTIONS.map((intervention) => (
          <button
            key={intervention.value}
            type="button"
            onClick={() => onSave("easy", [intervention.value])}
            className="py-1 px-2.5 rounded-lg bg-[#151B28] hover:bg-[#1E2738] text-[11px] text-slate-300 border border-[#263348]"
          >
            {intervention.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Sekcja dodawania tagu dnia (spacer, ząbkowanie, itp.).
 *
 * @param {object} props - Callback wyboru tagu
 * @returns {ReactNode} Kafelki tagów
 */
function DayTagsSection({ onSelectTag }: { onSelectTag: (tag: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <Tag className="w-3.5 h-3.5 text-violet-400" /> Tagi dnia
      </span>
      <div className="flex flex-wrap gap-1.5">
        {DAY_TAG_PRESETS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onSelectTag(tag)}
            className="py-1 px-2.5 rounded-lg bg-[#1E2738] hover:bg-violet-950/40 text-xs text-violet-300 border border-[#263348]"
          >
            #{tag}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Płynny Bottom Sheet (Framer Motion) do 1-tap rejestracji karmienia, nastroju i tagów.
 *
 * @param {QuickEntryBottomSheetProps} props - Stan widoczności i handlery akcji
 * @returns {ReactNode} Komponent Bottom Sheet
 */
export function QuickEntryBottomSheet({
  isOpen,
  onClose,
  onSaveFeeding,
  onSaveMoodAndIntervention,
  onSaveDayTag,
}: QuickEntryBottomSheetProps): ReactNode {
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
            className="relative w-full max-w-md bg-[#151B28] border-t border-[#263348] rounded-t-3xl p-4 flex flex-col gap-4 shadow-2xl z-10 max-h-[85vh] overflow-y-auto"
          >
            <div className="w-12 h-1 bg-[#263348] rounded-full mx-auto" />
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-sm font-semibold text-slate-100">Szybki wpis zdarzenia</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-full text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <FeedingSection
              onSelect={(type, details) => {
                onSaveFeeding(type, details);
                onClose();
              }}
            />
            <MoodAndInterventionsSection
              onSave={(mood, interventions) => {
                onSaveMoodAndIntervention(mood, interventions);
                onClose();
              }}
            />
            <DayTagsSection
              onSelectTag={(tag) => {
                onSaveDayTag(tag);
                onClose();
              }}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
