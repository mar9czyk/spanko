"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Droplets, Milk, Smile, Tag, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { bottlePresets } from "@/i18n/translate";
import type {
  BreastSide,
  DiaperKind,
  FeedingType,
  InterventionLevel,
  SleepMood,
} from "@/lib/types/database";
import {
  BREAST_DURATION_PRESETS_MIN,
  DAY_TAG_PRESETS,
  DIAPER_OPTIONS,
  INTERVENTION_OPTIONS,
  MOOD_OPTIONS,
} from "./constants";

interface QuickEntryBottomSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSaveFeeding: (
    type: FeedingType,
    details: { side?: BreastSide; ml?: number; minutes?: number; notes?: string },
  ) => void;
  readonly onSaveDiaper: (kind: DiaperKind) => void;
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
    details: { side?: BreastSide; ml?: number; minutes?: number; notes?: string },
  ) => void;
}) {
  const { t, units } = useI18n();
  const [minutes, setMinutes] = useState<number | undefined>(undefined);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <Milk className="w-3.5 h-3.5 text-emerald-400" /> {t("sheet.feeding")}
      </span>
      <div className="flex items-center gap-1.5">
        {BREAST_DURATION_PRESETS_MIN.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMinutes(minutes === m ? undefined : m)}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-mono border ${minutes === m ? "bg-emerald-900/50 border-emerald-500/60 text-emerald-200" : "bg-[#151B28] border-[#263348] text-slate-400"}`}
          >
            {m} {t("common.minutesShort")}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSelect("breast", { side: "left", minutes })}
          className="flex-1 py-2 px-2 rounded-xl bg-[#1E2738] hover:bg-emerald-950/40 text-xs font-medium text-slate-200 border border-[#263348] hover:border-emerald-500/40"
        >
          {t("sheet.breastLeft")}
        </button>
        <button
          type="button"
          onClick={() => onSelect("breast", { side: "right", minutes })}
          className="flex-1 py-2 px-2 rounded-xl bg-[#1E2738] hover:bg-emerald-950/40 text-xs font-medium text-slate-200 border border-[#263348] hover:border-emerald-500/40"
        >
          {t("sheet.breastRight")}
        </button>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
        {bottlePresets(units).map((preset) => (
          <button
            key={preset.ml}
            type="button"
            onClick={() => onSelect("bottle", { ml: preset.ml })}
            className="flex-1 py-2 px-2 rounded-xl bg-[#1E2738] hover:bg-emerald-950/40 text-xs font-mono font-medium text-emerald-300 border border-[#263348] whitespace-nowrap"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Sekcja rejestracji zmiany pieluchy.
 *
 * @param {object} props - Callback zapisu pieluchy
 * @returns {ReactNode} Kafelki pieluchy
 */
function DiaperSection({ onSelect }: { onSelect: (kind: DiaperKind) => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <Droplets className="w-3.5 h-3.5 text-sky-400" /> {t("sheet.diaper")}
      </span>
      <div className="flex items-center gap-1.5">
        {DIAPER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className="flex-1 py-2 px-2 rounded-xl bg-[#1E2738] hover:bg-sky-950/40 text-xs font-medium text-slate-200 border border-[#263348]"
          >
            {t(option.labelKey)}
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
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <Smile className="w-3.5 h-3.5 text-amber-400" /> {t("sheet.mood")}
      </span>
      <div className="flex items-center gap-1.5">
        {MOOD_OPTIONS.map((mood) => (
          <button
            key={mood.value}
            type="button"
            onClick={() => onSave(mood.value, ["pacifier_reinsert"])}
            className={`flex-1 py-2 px-2 rounded-xl bg-[#1E2738] hover:bg-[#253248] text-xs font-medium border ${mood.colorClass}`}
          >
            {t(mood.labelKey)}
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
            {t(intervention.labelKey)}
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
  const { t, tDynamic } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <Tag className="w-3.5 h-3.5 text-violet-400" /> {t("sheet.tags")}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {DAY_TAG_PRESETS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onSelectTag(tag)}
            className="py-1 px-2.5 rounded-lg bg-[#1E2738] hover:bg-violet-950/40 text-xs text-violet-300 border border-[#263348]"
          >
            #{tDynamic(`tag.${tag}`, tag)}
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
  onSaveDiaper,
  onSaveMoodAndIntervention,
  onSaveDayTag,
}: QuickEntryBottomSheetProps): ReactNode {
  const { t } = useI18n();
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
              <h2 className="text-sm font-semibold text-slate-100">{t("sheet.title")}</h2>
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
            <DiaperSection
              onSelect={(kind) => {
                onSaveDiaper(kind);
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
