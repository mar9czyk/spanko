"use client";

import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { Check, Droplets, Milk, Smile, Tag, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { bottlePresets } from "@/i18n/translate";
import type {
  BreastSide,
  DiaperKind,
  FeedingType,
  InterventionLevel,
  SleepMood,
} from "@/lib/types/database";
import { BottleVolumeInput } from "./BottleVolumeInput";
import {
  BREAST_DURATION_PRESETS_MIN,
  DAY_TAG_PRESETS,
  DEFAULT_BOTTLE_ML,
  DIAPER_OPTIONS,
  INTERVENTION_OPTIONS,
  MOOD_OPTIONS,
} from "./constants";

/** Cofa zapisany wpis; zwracane przez handlery zapisu, gdy zapis się udał. */
export type UndoSave = () => Promise<void>;
type SaveResult = Promise<UndoSave | undefined> | undefined;

/** Zapisuje wpis pod kluczem opcji; udany zapis pokazuje ✓ i umożliwia cofnięcie. */
type RecordSave = (key: string, save: () => SaveResult) => void;

interface SavedSectionProps {
  readonly savedKeys: ReadonlySet<string>;
  readonly onRecord: RecordSave;
}

interface QuickEntryBottomSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSaveFeeding: (
    type: FeedingType,
    details: { side?: BreastSide; ml?: number; minutes?: number; notes?: string },
  ) => SaveResult;
  readonly onSaveDiaper: (kind: DiaperKind) => SaveResult;
  readonly onSaveMoodAndIntervention: (
    mood: SleepMood,
    interventions: readonly InterventionLevel[],
  ) => SaveResult;
  readonly onSaveDayTag: (tag: string) => SaveResult;
}

/** Znacznik ✓ przy opcji zapisanej w tym otwarciu arkusza. */
function SavedMark({ show }: { show: boolean }): ReactNode {
  return show ? <Check aria-hidden="true" className="inline w-3.5 h-3.5 ml-1 -mt-0.5" /> : null;
}

/**
 * Sekcja rejestracji karmienia piersią lub butelką.
 *
 * @param {object} props - Callback zapisu karmienia
 * @returns {ReactNode} Kafelki karmienia
 */
function FeedingSection({
  onSave,
  savedKeys,
  onRecord,
}: SavedSectionProps & {
  onSave: QuickEntryBottomSheetProps["onSaveFeeding"];
}) {
  const { t, units } = useI18n();
  const [minutes, setMinutes] = useState<number | undefined>(undefined);
  const [isCustomBottle, setIsCustomBottle] = useState(false);
  const [customMl, setCustomMl] = useState(DEFAULT_BOTTLE_ML);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <Milk className="w-3.5 h-3.5 text-emerald-400" /> {t("sheet.feeding")}
      </span>
      <div className="flex items-center gap-1.5">
        {BREAST_DURATION_PRESETS_MIN.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMinutes(minutes === m ? undefined : m)}
            className={`flex-1 py-1.5 rounded-lg text-xs tabular-nums border ${minutes === m ? "bg-emerald-900/50 border-emerald-500/60 text-emerald-200" : "bg-[#151B28] border-[#263348] text-slate-400"}`}
          >
            {m} {t("common.minutesShort")}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onRecord("breast-left", () => onSave("breast", { side: "left", minutes }))}
          className="flex-1 py-2 px-2 rounded-xl bg-[#1E2738] hover:bg-emerald-950/40 text-xs font-medium text-slate-200 border border-[#263348] hover:border-emerald-500/40"
        >
          {t("sheet.breastLeft")}
          <SavedMark show={savedKeys.has("breast-left")} />
        </button>
        <button
          type="button"
          onClick={() =>
            onRecord("breast-right", () => onSave("breast", { side: "right", minutes }))
          }
          className="flex-1 py-2 px-2 rounded-xl bg-[#1E2738] hover:bg-emerald-950/40 text-xs font-medium text-slate-200 border border-[#263348] hover:border-emerald-500/40"
        >
          {t("sheet.breastRight")}
          <SavedMark show={savedKeys.has("breast-right")} />
        </button>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
        {bottlePresets(units).map((preset) => (
          <button
            key={preset.ml}
            type="button"
            onClick={() =>
              onRecord(`bottle-${preset.ml}`, () => onSave("bottle", { ml: preset.ml }))
            }
            className="flex-1 py-2 px-2 rounded-xl bg-[#1E2738] hover:bg-emerald-950/40 text-xs tabular-nums font-medium text-emerald-300 border border-[#263348] whitespace-nowrap"
          >
            {preset.label}
            <SavedMark show={savedKeys.has(`bottle-${preset.ml}`)} />
          </button>
        ))}
        <button
          type="button"
          aria-expanded={isCustomBottle}
          onClick={() => setIsCustomBottle((open) => !open)}
          className={`flex-1 py-2 px-2 rounded-xl text-xs font-medium border whitespace-nowrap ${isCustomBottle ? "bg-emerald-900/50 border-emerald-500/60 text-emerald-200" : "bg-[#151B28] border-[#263348] text-slate-300"}`}
        >
          {t("bottle.other")}
        </button>
      </div>
      {isCustomBottle && (
        <div className="flex flex-col gap-2">
          <BottleVolumeInput valueMl={customMl} onChange={setCustomMl} />
          <button
            type="button"
            onClick={() => onRecord("bottle-custom", () => onSave("bottle", { ml: customMl }))}
            className="min-h-12 rounded-xl bg-emerald-600 text-sm font-semibold text-white"
          >
            {t("bottle.save")}
            <SavedMark show={savedKeys.has("bottle-custom")} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Sekcja rejestracji zmiany pieluchy.
 *
 * @param {object} props - Callback zapisu pieluchy
 * @returns {ReactNode} Kafelki pieluchy
 */
function DiaperSection({
  onSave,
  savedKeys,
  onRecord,
}: SavedSectionProps & { onSave: (kind: DiaperKind) => SaveResult }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <Droplets className="w-3.5 h-3.5 text-diaper" /> {t("sheet.diaper")}
      </span>
      <div className="flex items-center gap-1.5">
        {DIAPER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onRecord(`diaper-${option.value}`, () => onSave(option.value))}
            className="flex-1 py-2 px-2 rounded-xl bg-[#1E2738] hover:bg-diaper/10 text-xs font-medium text-slate-200 border border-[#263348]"
          >
            {t(option.labelKey)}
            <SavedMark show={savedKeys.has(`diaper-${option.value}`)} />
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
  savedKeys,
  onRecord,
}: SavedSectionProps & {
  onSave: (mood: SleepMood, interventions: readonly InterventionLevel[]) => SaveResult;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <Smile className="w-3.5 h-3.5 text-amber-400" /> {t("sheet.mood")}
      </span>
      <div className="flex items-center gap-1.5">
        {MOOD_OPTIONS.map((mood) => (
          <button
            key={mood.value}
            type="button"
            onClick={() =>
              onRecord(`mood-${mood.value}`, () => onSave(mood.value, ["pacifier_reinsert"]))
            }
            className={`flex-1 py-2 px-2 rounded-xl bg-[#1E2738] hover:bg-[#253248] text-xs font-medium border ${mood.colorClass}`}
          >
            {t(mood.labelKey)}
            <SavedMark show={savedKeys.has(`mood-${mood.value}`)} />
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {INTERVENTION_OPTIONS.map((intervention) => (
          <button
            key={intervention.value}
            type="button"
            onClick={() =>
              onRecord(`int-${intervention.value}`, () => onSave("easy", [intervention.value]))
            }
            className="py-1 px-2.5 rounded-lg bg-[#151B28] hover:bg-[#1E2738] text-xs text-slate-300 border border-[#263348]"
          >
            {t(intervention.labelKey)}
            <SavedMark show={savedKeys.has(`int-${intervention.value}`)} />
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
function DayTagsSection({
  onSave,
  savedKeys,
  onRecord,
}: SavedSectionProps & { onSave: (tag: string) => SaveResult }) {
  const { t, tDynamic } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <Tag className="w-3.5 h-3.5 text-violet-400" /> {t("sheet.tags")}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {DAY_TAG_PRESETS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onRecord(`tag-${tag}`, () => onSave(tag))}
            className="py-1 px-2.5 rounded-lg bg-[#1E2738] hover:bg-violet-950/40 text-xs text-violet-300 border border-[#263348]"
          >
            #{tDynamic(`tag.${tag}`, tag)}
            <SavedMark show={savedKeys.has(`tag-${tag}`)} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Ile pikseli przeciągnięcia w dół zamyka arkusz. */
const SWIPE_CLOSE_PX = 80;

/**
 * Płynny Bottom Sheet (Framer Motion) do rejestracji karmienia, pieluchy, nastroju i tagów.
 *
 * @description
 * Arkusz zostaje otwarty po zapisie, żeby dało się dodać kilka wpisów naraz. Zapisana opcja
 * dostaje ✓, a linia „Zapisano · Cofnij” cofa ostatni zapis. Zamykanie: przycisk, tło albo
 * przeciągnięcie uchwytu w dół.
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
  const dragControls = useDragControls();
  const [saved, setSaved] = useState<readonly { key: string; undo: UndoSave }[]>([]);

  useEffect(() => {
    if (!isOpen) setSaved([]);
  }, [isOpen]);

  const handleRecord: RecordSave = async (key, save) => {
    const undo = await save();
    if (undo) setSaved((prev) => [...prev, { key, undo }]);
  };

  const handleUndo = async () => {
    const last = saved[saved.length - 1];
    if (!last) return;
    setSaved((prev) => prev.slice(0, -1));
    await last.undo();
  };

  const savedKeys = new Set(saved.map((item) => item.key));
  const sectionProps = { savedKeys, onRecord: handleRecord };
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
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > SWIPE_CLOSE_PX) onClose();
            }}
            className="relative w-full max-w-md bg-[#151B28] border-t border-[#263348] rounded-t-3xl p-4 flex flex-col gap-4 shadow-2xl z-10 max-h-[85vh] overflow-y-auto"
          >
            <div
              onPointerDown={(down) => dragControls.start(down)}
              className="-mt-2 -mb-2 py-2 cursor-grab touch-none"
            >
              <div className="w-12 h-1 bg-[#263348] rounded-full mx-auto" />
            </div>
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-sm font-semibold text-ink">{t("sheet.title")}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.cancel")}
                className="p-1 rounded-full text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <FeedingSection onSave={onSaveFeeding} {...sectionProps} />
            <DiaperSection onSave={onSaveDiaper} {...sectionProps} />
            <MoodAndInterventionsSection onSave={onSaveMoodAndIntervention} {...sectionProps} />
            <DayTagsSection onSave={onSaveDayTag} {...sectionProps} />
            <div className="sticky bottom-0 -mx-4 -mb-4 flex items-center gap-2 border-t border-[#263348] bg-[#151B28] px-4 py-3">
              <div role="status" className="flex-1 text-sm text-emerald-300">
                {saved.length > 0 && (
                  <>
                    {t("sheet.saved")} ·{" "}
                    <button
                      type="button"
                      onClick={() => void handleUndo()}
                      className="min-h-12 px-1 font-semibold text-amber-300"
                    >
                      {t("sheet.undo")}
                    </button>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="min-h-12 rounded-xl bg-amber-500 px-5 text-sm font-semibold text-[#0B0F17]"
              >
                {t("sheet.done")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
