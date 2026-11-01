import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Sun } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDuration } from "@/i18n/translate";
import type { SleepLogRecord } from "@/lib/types/database";
import { AddEntryControl, type AddEntryControlProps } from "./AddEntrySheet";
import { DayHourStrip } from "./DayHourStrip";
import { collectDayStripEvents, type DayStripSleep } from "./dayStripModel";
import { EditEntrySheet, type EditedEntry } from "./EditEntrySheet";
import { TimelineEventCard } from "./TimelineEventCard";
import type { TimelineEvent } from "./types";

interface PhysiologicalTimelineProps {
  readonly physiologicalDateDisplay: string;
  readonly morningWakeTimeDisplay: string;
  readonly events: readonly TimelineEvent[];
  /** Poranna pobudka otwierająca dobę; bez niej pasek godzin się nie pokazuje. */
  readonly morningWakeIso?: string;
  readonly nowIso: string;
  readonly currentSleepLog: SleepLogRecord | null;
  /** Przewijanie dób; brak = nagłówek bez strzałek. */
  readonly navigation?: TimelineNavigation;
  /** Tekst pustej doby; domyślnie zachęta do dodania wpisu. */
  readonly emptyText?: string;
  /** Wywoływane po zapisaniu edycji wpisu; brak = karty tylko do odczytu. */
  readonly onEntryEdited?: (entry: EditedEntry) => void;
  /** Dopisywanie wpisów do oglądanej minionej doby; brak = bez przycisku „Dodaj wpis”. */
  readonly addEntry?: AddEntryControlProps;
}

export interface TimelineNavigation {
  readonly onPrevious: () => void;
  /** Brak = oglądana doba jest bieżąca, dalej nie ma czego pokazać. */
  readonly onNext?: () => void;
  /** Powrót do bieżącej doby; pokazywany tylko przy oglądaniu wcześniejszej. */
  readonly onToday?: () => void;
}

const NAV_BUTTON_CLASS =
  "flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-400 hover:text-amber-300 disabled:opacity-30 disabled:hover:text-slate-400";

/**
 * Nagłówek osi czasu doby fizjologicznej, opcjonalnie ze strzałkami do sąsiednich dób.
 *
 * @param {object} props - Data doby, godzina porannej pobudki i nawigacja
 * @returns {ReactNode} Nagłówek sekcji
 */
function TimelineHeader({
  dateText,
  wakeTime,
  navigation,
}: {
  dateText: string;
  wakeTime: string;
  navigation?: TimelineNavigation;
}) {
  const { t } = useI18n();
  const title = (
    <h2 className="whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
      <Calendar className="w-3.5 h-3.5 text-amber-400" />
      {dateText}
    </h2>
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 pb-1">
      {navigation ? (
        <div className="flex min-w-0 items-center">
          <button
            type="button"
            onClick={navigation.onPrevious}
            aria-label={t("timeline.previousDay")}
            className={`${NAV_BUTTON_CLASS} -ml-2`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {title}
          <button
            type="button"
            onClick={navigation.onNext}
            disabled={!navigation.onNext}
            aria-label={t("timeline.nextDay")}
            className={NAV_BUTTON_CLASS}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {navigation.onToday && (
            <button
              type="button"
              onClick={navigation.onToday}
              className="min-h-9 rounded-lg px-2 text-xs font-semibold text-amber-300 hover:text-amber-200"
            >
              {t("timeline.today")}
            </button>
          )}
        </div>
      ) : (
        title
      )}
      <span className="shrink-0 text-xs text-amber-400/90 tabular-nums flex items-center gap-1 bg-[#151B28] px-2 py-0.5 rounded-md border border-amber-500/20">
        <Sun className="w-3 h-3 text-amber-400" />
        {t("timeline.wake", { time: wakeTime })}
      </span>
    </div>
  );
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
 * Oś czasu bieżącej doby fizjologicznej: domyślnie zwinięta do podsumowania i paska
 * 24 godzin, po rozwinięciu pokazuje drzemki, karmienia i tagi dnia.
 *
 * @param {PhysiologicalTimelineProps} props - Dane zdarzeń doby fizjologicznej
 * @returns {ReactNode} Sekcja osi czasu
 */
export function PhysiologicalTimeline({
  physiologicalDateDisplay,
  morningWakeTimeDisplay,
  events,
  morningWakeIso,
  nowIso,
  currentSleepLog,
  navigation,
  emptyText,
  onEntryEdited,
  addEntry,
}: PhysiologicalTimelineProps): ReactNode {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const [editedEvent, setEditedEvent] = useState<TimelineEvent | null>(null);
  const activeSleep = toActiveSleep(currentSleepLog);

  if (events.length === 0 && !activeSleep) {
    return (
      <section className="w-full flex flex-col gap-2 mt-2">
        <TimelineHeader
          dateText={physiologicalDateDisplay}
          wakeTime={morningWakeTimeDisplay}
          navigation={navigation}
        />
        <div className="p-4 rounded-xl bg-[#151B28] border border-[#263348] text-center text-xs text-slate-400">
          {emptyText ?? t("timeline.empty")}
        </div>
        {addEntry && <AddEntryControl {...addEntry} />}
      </section>
    );
  }

  const naps = events.filter((event) => event.kind === "nap" && event.type === "nap");
  const summary = t("timeline.summary", {
    naps: naps.length,
    duration: formatDuration(
      naps.reduce((sum, nap) => sum + (nap.kind === "nap" ? (nap.durationMinutes ?? 0) : 0), 0),
    ),
    feedings: events.filter((event) => event.kind === "feeding").length,
    diapers: events.filter((event) => event.kind === "diaper").length,
  });
  const showStrip =
    morningWakeIso !== undefined &&
    new Date(nowIso).getTime() >= new Date(morningWakeIso).getTime();

  return (
    <section className="w-full flex flex-col gap-2 mt-2">
      <TimelineHeader
        dateText={physiologicalDateDisplay}
        wakeTime={morningWakeTimeDisplay}
        navigation={navigation}
      />
      <div className="flex flex-col gap-2 p-3 rounded-xl bg-[#151B28] border border-[#263348]">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? t("timeline.hideDetails") : t("timeline.showDetails")}
          onClick={() => setIsExpanded((value) => !value)}
          className="flex min-h-9 w-full items-center justify-between gap-2 text-left"
        >
          <span className="text-xs text-slate-300">{summary}</span>
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
        {showStrip && morningWakeIso && (
          <DayHourStrip
            ariaLabel={summary}
            input={{
              dayStartIso: morningWakeIso,
              nowIso,
              ...collectDayStripEvents(events, activeSleep),
            }}
          />
        )}
        {isExpanded && (
          <div className="mt-1 flex flex-col gap-2 border-t border-[#263348] pt-3">
            {[...events].reverse().map((event) => (
              <TimelineEventCard
                key={event.id}
                event={event}
                onEdit={onEntryEdited ? setEditedEvent : undefined}
              />
            ))}
          </div>
        )}
      </div>
      {addEntry && <AddEntryControl {...addEntry} />}
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
