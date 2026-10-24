"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { pb } from "@/lib/pocketbase";
import { DEFAULT_TIME_ZONE } from "@/lib/sleep-engine";
import type { BreastSide, DiaperKind, SleepType } from "@/lib/types/database";
import { BottleVolumeInput } from "./BottleVolumeInput";
import { DEFAULT_BOTTLE_ML } from "./constants";
import type { PastDayView } from "./dayHistory";
import {
  buildManualEntry,
  type ManualEntryDraft,
  type ManualEntryError,
  type ManualEntryRecord,
} from "./entryCreate";

type EntryKind = "nap" | "night" | "breast" | "bottle" | "diaper";

const ENTRY_KINDS: readonly EntryKind[] = ["nap", "night", "breast", "bottle", "diaper"];
const DIAPER_KINDS: readonly DiaperKind[] = ["wet", "dirty", "both"];
const BREAST_SIDES: readonly Exclude<BreastSide, "none">[] = ["left", "right", "both"];

const TIME_INPUT_CLASS =
  "min-h-12 w-full rounded-xl border border-[#263348] bg-[#0B0F17] px-3 text-lg tabular-nums text-ink [color-scheme:dark] focus:border-amber-400 focus:outline-none";

export interface AddEntryControlProps {
  /** Doba, do której dopisujemy wpis; brak = jeszcze się ładuje. */
  readonly day: PastDayView | undefined;
  readonly childId: string;
  readonly timeZone?: string;
  /** Po zapisaniu — odświeża dobę (przeliczenie osi, paska i podsumowania). */
  readonly onSaved: () => void;
}

/**
 * Zapisuje ręcznie dopisany wpis w PocketBase.
 *
 * @param {ManualEntryRecord} record - Rekord z walidacji
 * @param {string} childId - Id dziecka
 * @param {string} timeZone - Strefa IANA dziecka
 * @returns {Promise<void>} Rozwiązuje się po zapisie
 */
async function persistManualEntry(
  record: ManualEntryRecord,
  childId: string,
  timeZone: string,
): Promise<void> {
  if (record.collection === "sleep_logs") {
    await pb.collection("sleep_logs").create({
      ...record.data,
      child_id: childId,
      timezone: timeZone,
      created_by: pb.authStore.record?.id,
    });
    return;
  }
  await pb.collection("day_context").create({ ...record.data, child_id: childId });
}

/**
 * Chip wyboru z zaznaczeniem.
 *
 * @param {object} props - Etykieta, stan i zmiana
 * @returns {ReactNode} Przycisk radio
 */
function Chip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`min-h-12 rounded-xl border px-3 text-sm font-medium ${selected ? "border-amber-400 bg-amber-500/15 text-amber-200" : "border-[#263348] text-slate-300"}`}
    >
      {label}
    </button>
  );
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
 * Przycisk „Dodaj wpis” pod osią minionej doby i arkusz z formularzem.
 *
 * @description
 * Wpis (drzemka, noc, karmienie piersią lub butelką, pielucha) trafia do doby fizjologicznej
 * oglądanego dnia, a po zapisie doba jest przeładowywana. Godziny po północy są liczone
 * jako następny dzień kalendarzowy tej doby.
 *
 * @param {AddEntryControlProps} props - Doba, dziecko i callback po zapisie
 * @returns {ReactNode} Przycisk i bottom sheet
 */
export function AddEntryControl({
  day,
  childId,
  timeZone,
  onSaved,
}: AddEntryControlProps): ReactNode {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [kind, setKind] = useState<EntryKind>("nap");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [bottleMl, setBottleMl] = useState(DEFAULT_BOTTLE_ML);
  const [side, setSide] = useState<Exclude<BreastSide, "none">>("left");
  const [diaperKind, setDiaperKind] = useState<DiaperKind>("wet");
  const [error, setError] = useState<ManualEntryError | "save_failed" | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isSleep = kind === "nap" || kind === "night";
  const open = () => {
    setStart("");
    setEnd("");
    setError(null);
    setIsSaving(false);
    setIsOpen(true);
  };
  const close = () => setIsOpen(false);

  const handleSave = async () => {
    if (!day) return;
    const draft: ManualEntryDraft =
      kind === "nap" || kind === "night"
        ? { kind: "sleep", sleepType: kind satisfies SleepType, start, end }
        : kind === "breast"
          ? { kind, time: start, side }
          : kind === "bottle"
            ? { kind, time: start, ml: bottleMl }
            : { kind, time: start, diaperKind };
    const record = buildManualEntry(day, draft, new Date().toISOString());
    if (typeof record === "string") {
      setError(record);
      return;
    }
    setIsSaving(true);
    try {
      await persistManualEntry(record, childId, timeZone || DEFAULT_TIME_ZONE);
      onSaved();
      close();
    } catch {
      setError("save_failed");
      setIsSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={!day}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#263348] text-sm font-medium text-amber-300 disabled:opacity-40"
      >
        <Plus className="w-4 h-4" />
        {t("entryAdd.button")}
      </button>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              role="dialog"
              aria-modal="true"
              aria-label={t("entryAdd.title", { date: day?.date ?? "" })}
              className="relative z-10 flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl border-t border-[#263348] bg-[#151B28] p-4 shadow-2xl"
            >
              <div className="w-12 h-1 bg-[#263348] rounded-full mx-auto shrink-0" />
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">
                  {t("entryAdd.title", { date: day?.date ?? "" })}
                </h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label={t("common.cancel")}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div
                role="radiogroup"
                aria-label={t("entryAdd.type")}
                className="grid grid-cols-3 gap-2"
              >
                {ENTRY_KINDS.map((option) => (
                  <Chip
                    key={option}
                    label={t(`entryAdd.kind.${option}` as const)}
                    selected={kind === option}
                    onSelect={() => {
                      setKind(option);
                      setError(null);
                    }}
                  />
                ))}
              </div>
              <div className={`grid gap-3 ${isSleep ? "grid-cols-2" : ""}`}>
                <TimeField
                  label={isSleep ? t("entryEdit.sleepStart") : t("entryEdit.time")}
                  value={start}
                  onChange={setStart}
                />
                {isSleep && (
                  <TimeField label={t("entryEdit.sleepEnd")} value={end} onChange={setEnd} />
                )}
              </div>
              {kind === "bottle" && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {t("entryEdit.bottleAmount")}
                  </span>
                  <BottleVolumeInput valueMl={bottleMl} onChange={setBottleMl} />
                </div>
              )}
              {kind === "breast" && (
                <div
                  role="radiogroup"
                  aria-label={t("entryAdd.side")}
                  className="grid grid-cols-3 gap-2"
                >
                  {BREAST_SIDES.map((option) => (
                    <Chip
                      key={option}
                      label={t(`entryAdd.side.${option}` as const)}
                      selected={side === option}
                      onSelect={() => setSide(option)}
                    />
                  ))}
                </div>
              )}
              {kind === "diaper" && (
                <div
                  role="radiogroup"
                  aria-label={t("entryAdd.diaper")}
                  className="grid grid-cols-3 gap-2"
                >
                  {DIAPER_KINDS.map((option) => (
                    <Chip
                      key={option}
                      label={t(`diaper.${option}` as const)}
                      selected={diaperKind === option}
                      onSelect={() => setDiaperKind(option)}
                    />
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-400">{t("entryAdd.hint")}</p>
              {error && (
                <p role="alert" className="text-xs text-red-300">
                  {t(`entryAdd.error.${error}` as const)}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 pb-2">
                <button
                  type="button"
                  onClick={close}
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
    </>
  );
}
