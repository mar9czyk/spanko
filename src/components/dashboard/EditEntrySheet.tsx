"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { pb } from "@/lib/pocketbase";
import type {
  DayContextRecord,
  InterventionLevel,
  SleepLogRecord,
  SleepMood,
} from "@/lib/types/database";
import { BottleVolumeInput } from "./BottleVolumeInput";
import { BreastMinutesInput } from "./BreastMinutesInput";
import { DEFAULT_BOTTLE_ML } from "./constants";
import {
  buildEntryTimePatch,
  type EntryEditError,
  type EntryEditPatch,
  toClockInputValue,
} from "./entryEdit";
import { SleepHowPicker } from "./SleepHowPicker";
import type { TimelineEvent } from "./types";

/** Zapisany wpis po edycji: kolekcja i rekord zwrócony przez PocketBase. */
export type EditedEntry =
  | { readonly collection: "sleep_logs"; readonly record: SleepLogRecord }
  | { readonly collection: "day_context"; readonly record: DayContextRecord };

interface EditEntrySheetProps {
  /** Edytowany wpis; null = arkusz zamknięty. */
  readonly event: TimelineEvent | null;
  readonly onClose: () => void;
  readonly onSaved: (entry: EditedEntry) => void;
}

const TIME_INPUT_CLASS =
  "min-h-12 w-full rounded-xl border border-[#263348] bg-[#0B0F17] px-3 text-lg tabular-nums text-ink [color-scheme:dark] focus:border-amber-400 focus:outline-none";

/**
 * Zapisuje zmianę godzin wpisu w PocketBase.
 *
 * @param {EntryEditPatch} change - Kolekcja, id i zmienione pola
 * @returns {Promise<EditedEntry>} Zapisany rekord
 */
async function persistEntryPatch(change: EntryEditPatch): Promise<EditedEntry> {
  if (change.collection === "sleep_logs") {
    const record = await pb
      .collection("sleep_logs")
      .update<SleepLogRecord>(change.id, change.patch);
    return { collection: "sleep_logs", record };
  }
  const record = await pb
    .collection("day_context")
    .update<DayContextRecord>(change.id, change.patch);
  return { collection: "day_context", record };
}

/**
 * Pole godziny z etykietą.
 *
 * @param {object} props - Etykieta, wartość i zmiana
 * @returns {ReactNode} Pole formularza
 */
function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <input
        type="time"
        required
        value={value}
        onChange={(change) => onChange(change.target.value)}
        className={TIME_INPUT_CLASS}
      />
    </label>
  );
}

/**
 * Arkusz edycji wpisu z osi czasu (sen, karmienie, pielucha, tagi).
 *
 * @description
 * Zmienia godziny (a w butelce ilość mleka); wpis zostaje w swojej dobie fizjologicznej. Godzina trafia na moment
 * najbliższy pierwotnemu, więc korekta 00:30 → 23:50 oznacza poprzedni wieczór.
 *
 * @param {EditEntrySheetProps} props - Wpis i callbacki
 * @returns {ReactNode} Bottom sheet edycji
 */
export function EditEntrySheet({ event, onClose, onSaved }: EditEntrySheetProps): ReactNode {
  const { t } = useI18n();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [mood, setMood] = useState<SleepMood | undefined>(undefined);
  const [interventions, setInterventions] = useState<readonly InterventionLevel[]>([]);
  const [bottleMl, setBottleMl] = useState<number | undefined>(undefined);
  const [breastMinutes, setBreastMinutes] = useState<number | undefined>(undefined);
  const [error, setError] = useState<EntryEditError | "save_failed" | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!event) return;
    setStart(toClockInputValue(event.kind === "nap" ? event.startIso : event.timeIso));
    setEnd(event.kind === "nap" ? toClockInputValue(event.endIso) : "");
    setMood(event.kind === "nap" ? event.mood : undefined);
    setInterventions(event.kind === "nap" ? (event.interventions ?? []) : []);
    setBottleMl(
      event.kind === "feeding" ? (event.bottleMl ?? DEFAULT_BOTTLE_ML) : DEFAULT_BOTTLE_ML,
    );
    setBreastMinutes(event.kind === "feeding" ? event.breastMinutes : undefined);
    setError(null);
    setIsSaving(false);
  }, [event]);

  const handleSave = async () => {
    if (!event) return;
    const change = buildEntryTimePatch(
      event,
      {
        start,
        end,
        bottleMl,
        breastMinutes,
        ...(event.kind === "nap" ? { mood: mood ?? null, interventions } : {}),
      },
      new Date().toISOString(),
    );
    if (typeof change === "string") {
      setError(change);
      return;
    }
    setIsSaving(true);
    try {
      onSaved(await persistEntryPatch(change));
      onClose();
    } catch {
      setError("save_failed");
      setIsSaving(false);
    }
  };

  const isSleep = event?.kind === "nap";
  const isBreast =
    event?.kind === "feeding" && event.feedingType === "breast" && event.breastSide !== undefined;
  const isBottle = event?.kind === "feeding" && event.feedingType === "bottle";
  return (
    <AnimatePresence>
      {event && (
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
            aria-label={t("entryEdit.title")}
            className="relative w-full max-w-md bg-[#151B28] border-t border-[#263348] rounded-t-3xl p-4 flex flex-col gap-4 shadow-2xl z-10"
          >
            <div className="w-12 h-1 bg-[#263348] rounded-full mx-auto" />
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">{t("entryEdit.title")}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.cancel")}
                className="p-1 rounded-full text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className={`grid gap-3 ${isSleep && event.endIso ? "grid-cols-2" : ""}`}>
              <TimeField
                label={isSleep ? t("entryEdit.sleepStart") : t("entryEdit.time")}
                value={start}
                onChange={setStart}
              />
              {isSleep && event.endIso && (
                <TimeField label={t("entryEdit.sleepEnd")} value={end} onChange={setEnd} />
              )}
            </div>
            {isSleep && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t("entryEdit.howFellAsleep")}
                </span>
                <SleepHowPicker
                  mood={mood}
                  interventions={interventions}
                  allowClearMood
                  onChange={(nextMood, nextInterventions) => {
                    setMood(nextMood);
                    setInterventions(nextInterventions);
                  }}
                />
              </div>
            )}
            {isBottle && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t("entryEdit.bottleAmount")}
                </span>
                <BottleVolumeInput valueMl={bottleMl ?? DEFAULT_BOTTLE_ML} onChange={setBottleMl} />
              </div>
            )}
            {isBreast && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t("entryEdit.breastDuration")}
                </span>
                <BreastMinutesInput minutes={breastMinutes ?? 0} onChange={setBreastMinutes} />
              </div>
            )}
            <p className="text-xs text-slate-400">{t("entryEdit.hint")}</p>
            {error && (
              <p role="alert" className="text-xs text-red-300">
                {t(`entryEdit.error.${error}` as const)}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 pb-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-12 rounded-xl border border-[#263348] text-sm font-medium text-slate-300"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="min-h-12 rounded-xl bg-amber-500 text-sm font-semibold text-[#0B0F17] disabled:opacity-60"
              >
                {isSaving ? t("entryEdit.saving") : t("entryEdit.save")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
