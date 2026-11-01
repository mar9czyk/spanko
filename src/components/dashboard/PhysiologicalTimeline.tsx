import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDuration, pluralSuffix } from "@/i18n/translate";
import type { SleepLogRecord } from "@/lib/types/database";
import { AddEntryControl, type AddEntryControlProps } from "./AddEntrySheet";
import { DayHourStrip } from "./DayHourStrip";
import { DayMarker, SummaryIcon, type SummaryIconKind } from "./DayMarker";
import { collectDayStripEvents, type DayStripSleep } from "./dayStripModel";
import { findNightSleep, summarizeDay } from "./daySummary";
import { EditEntrySheet, type EditedEntry } from "./EditEntrySheet";
import { TimelineEventCard } from "./TimelineEventCard";
import type { TimelineEvent } from "./types";

/** Czas animacji rozwijania; po nim karta przewija się do góry ekranu. */
const EXPAND_MS = 200;

interface PhysiologicalTimelineProps {
  /** Nagłówek karty: „Dziś”, „Wczoraj” albo data. */
  readonly label: string;
  /** Krótka data obok nagłówka (np. „nd 1.11”). */
  readonly dateText?: string;
  /** Bieżąca doba: po prawej „trwa” zamiast czasu nocy. */
  readonly isCurrentDay?: boolean;
  readonly morningWakeTimeDisplay: string;
  readonly events: readonly TimelineEvent[];
  /** Poranna pobudka otwierająca dobę; bez niej pasek godzin się nie pokazuje. */
  readonly morningWakeIso?: string;
  /** Wspólna oś zegarowa porównywanych dób; brak = oś od porannej pobudki tej doby. */
  readonly axisStartIso?: string;
  /** Opis nocy przed poranną pobudką (ostatni wiersz listy); brak = bez opisu. */
  readonly wakeNote?: string;
  readonly nowIso: string;
  readonly currentSleepLog: SleepLogRecord | null;
  /** Sterowanie z zewnątrz (akordeon); brak = karta rozwija się sama. */
  readonly isExpanded?: boolean;
  readonly onToggle?: () => void;
  /** Tekst pustej doby; domyślnie zachęta do dodania wpisu. */
  readonly emptyText?: string;
  /** Wywoływane po zapisaniu edycji wpisu; brak = karty tylko do odczytu. */
  readonly onEntryEdited?: (entry: EditedEntry) => void;
  /** Dopisywanie wpisów do oglądanej minionej doby; brak = bez przycisku „Dodaj wpis”. */
  readonly addEntry?: AddEntryControlProps;
}

/**
 * Zamienia trwający log snu na sen paska godzin (bez końca, liczony do teraz).
 *
 * @param {SleepLogRecord | null} log - Bieżący log snu
 * @returns {DayStripSleep | null} Trwający sen albo null
 */
function toActiveSleep(log: SleepLogRecord | null): DayStripSleep | null {
  if (!log || log.status === "completed") return null;
  const startIso = log.fell_asleep_at || log.put_down_at;
  const wakingIsos = log.night_wakings?.map((wake) => wake.wokeAt);
  return startIso ? { startIso, type: log.type, wakingIsos } : null;
}

/**
 * Karta jednej doby fizjologicznej: nagłówek ze stanem, pasek 24 godzin, drobne znaczniki
 * (jednocześnie legenda) i stopka „Pokaż N wpisów”, która rozwija listę w tej samej ramce.
 *
 * @param {PhysiologicalTimelineProps} props - Dane zdarzeń doby fizjologicznej
 * @returns {ReactNode} Karta doby
 */
export function PhysiologicalTimeline({
  label,
  dateText,
  isCurrentDay,
  morningWakeTimeDisplay,
  events,
  morningWakeIso,
  axisStartIso,
  wakeNote,
  nowIso,
  currentSleepLog,
  isExpanded: controlledExpanded,
  onToggle,
  emptyText,
  onEntryEdited,
  addEntry,
}: PhysiologicalTimelineProps): ReactNode {
  const { t, locale } = useI18n();
  const [ownExpanded, setOwnExpanded] = useState(false);
  const [editedEvent, setEditedEvent] = useState<TimelineEvent | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const isExpanded = controlledExpanded ?? ownExpanded;
  const toggle = onToggle ?? (() => setOwnExpanded((value) => !value));
  const activeSleep = toActiveSleep(currentSleepLog);

  // Po rozwinięciu karta przewija się tak, by jej góra była u góry ekranu (po animacji wysokości)
  useEffect(() => {
    if (!isExpanded) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      () =>
        cardRef.current?.scrollIntoView({
          block: "start",
          behavior: reduceMotion ? "auto" : "smooth",
        }),
      reduceMotion ? 0 : EXPAND_MS,
    );
    return () => window.clearTimeout(timer);
  }, [isExpanded]);

  const headingContent = (
    <>
      {label}
      {dateText && (
        <span className="text-xs font-normal tabular-nums text-slate-400">{dateText}</span>
      )}
    </>
  );

  if (events.length === 0 && !activeSleep) {
    return (
      <section className="w-full flex flex-col gap-2 mt-2">
        <h2 className="flex items-baseline gap-1.5 text-sm font-semibold text-ink">
          {headingContent}
        </h2>
        <div className="p-4 rounded-xl bg-[#151B28] border border-[#263348] text-center text-xs text-slate-400">
          {emptyText ?? t("timeline.empty")}
        </div>
        {addEntry && <AddEntryControl {...addEntry} />}
      </section>
    );
  }

  const summary = summarizeDay(events);
  const night = findNightSleep(events);
  const stateText = isCurrentDay
    ? t("timeline.stateOngoing")
    : night?.durationMinutes
      ? t("timeline.stateNight", { duration: formatDuration(night.durationMinutes) })
      : null;
  // Znaczniki to sama ikona i liczba; pełne zdanie trafia do aria-label
  const chips: { key: SummaryIconKind; value: string; label: string; zero?: boolean }[] = [];
  if (morningWakeIso) {
    chips.push({
      key: "wake",
      value: morningWakeTimeDisplay,
      label: t("timeline.chipWake", { time: morningWakeTimeDisplay }),
    });
  }
  chips.push({
    key: "nap",
    value: formatDuration(summary.napMinutes),
    label: t(`timeline.chipNaps.${pluralSuffix(locale, summary.naps)}`, {
      n: summary.naps,
      duration: formatDuration(summary.napMinutes),
    }),
    zero: summary.naps === 0,
  });
  if (!isCurrentDay && summary.nightWakings > 0) {
    chips.push({
      key: "night",
      value: String(summary.nightWakings),
      label: t(`timeline.chipNightWakings.${pluralSuffix(locale, summary.nightWakings)}`, {
        n: summary.nightWakings,
      }),
    });
  }
  chips.push(
    {
      key: "feeding",
      value: String(summary.feedings),
      label: t("timeline.chipFeedings", { n: summary.feedings }),
      zero: summary.feedings === 0,
    },
    {
      key: "wet",
      value: String(summary.wet),
      label: t("timeline.chipWet", { n: summary.wet }),
      zero: summary.wet === 0,
    },
    {
      key: "dirty",
      value: String(summary.dirty),
      label: t("timeline.chipDirty", { n: summary.dirty }),
      zero: summary.dirty === 0,
    },
  );
  const fullSummary = t("timeline.summaryLabel", {
    day: label,
    chips: chips.map((chip) => chip.label).join(" · "),
  });
  const entryCount = events.length;
  const showStrip =
    morningWakeIso !== undefined &&
    new Date(nowIso).getTime() >= new Date(morningWakeIso).getTime();

  return (
    <section className="w-full mt-2">
      <div
        ref={cardRef}
        className={`scroll-mt-3 overflow-hidden rounded-xl border bg-[#151B28] transition-colors ${isExpanded ? "border-amber-500/45" : "border-[#263348]"}`}
      >
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-label={fullSummary}
          onClick={toggle}
          className="flex w-full flex-col gap-2 p-3 pb-2 text-left"
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="flex items-baseline gap-1.5 text-sm font-semibold text-ink">
              {headingContent}
            </span>
            {stateText && <span className="text-xs tabular-nums text-slate-400">{stateText}</span>}
          </span>
          {showStrip && morningWakeIso && (
            <DayHourStrip
              ariaLabel={fullSummary}
              input={{
                dayStartIso: morningWakeIso,
                axisStartIso,
                nowIso,
                ...collectDayStripEvents(events, activeSleep),
              }}
            />
          )}
          <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-slate-300">
            {chips.map((chip) => (
              <span
                key={chip.key}
                className={`inline-flex min-h-[20px] items-center gap-1 ${chip.zero ? "opacity-50" : ""}`}
              >
                <SummaryIcon kind={chip.key} />
                {chip.value}
              </span>
            ))}
          </span>
        </button>
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="entries"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: EXPAND_MS / 1000 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-2 border-t border-[#263348] p-3">
                {[...events].reverse().map((event) => (
                  <TimelineEventCard
                    key={event.id}
                    event={event}
                    onEdit={onEntryEdited ? setEditedEvent : undefined}
                  />
                ))}
                {morningWakeIso && (
                  <div className="flex min-h-12 items-center gap-3 px-1">
                    <DayMarker kind="wake" />
                    <div>
                      <span className="block text-sm font-semibold text-ink">
                        {t("timeline.morningWake")}{" "}
                        <span className="font-normal tabular-nums text-slate-400">
                          {morningWakeTimeDisplay}
                        </span>
                      </span>
                      {wakeNote && (
                        <span className="block text-xs tabular-nums text-slate-400">
                          {wakeNote}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isExpanded}
          className="flex min-h-11 w-full items-center justify-center gap-1.5 border-t border-[#263348] bg-amber-500/10 text-sm font-semibold text-amber-300 active:bg-amber-500/20"
        >
          {isExpanded
            ? t("timeline.collapse")
            : t(`timeline.showEntries.${pluralSuffix(locale, entryCount)}`, { n: entryCount })}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {addEntry && (
        <div className="mt-2">
          <AddEntryControl {...addEntry} />
        </div>
      )}
      {onEntryEdited && (
        <EditEntrySheet
          event={editedEvent}
          onClose={() => setEditedEvent(null)}
          onSaved={onEntryEdited}
        />
      )}
    </section>
  );
}
