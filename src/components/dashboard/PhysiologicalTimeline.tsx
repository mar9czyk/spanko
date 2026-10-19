import { Calendar, ChevronDown, Sun } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDuration } from "@/i18n/translate";
import type { SleepLogRecord } from "@/lib/types/database";
import { DayHourStrip } from "./DayHourStrip";
import { collectDayStripEvents, type DayStripSleep } from "./dayHourStrip";
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
}

/**
 * Nagłówek osi czasu doby fizjologicznej.
 *
 * @param {object} props - Data doby i godzina porannej pobudki
 * @returns {ReactNode} Nagłówek sekcji
 */
function TimelineHeader({ dateText, wakeTime }: { dateText: string; wakeTime: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between pb-1">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5 text-amber-400" />
        {dateText}
      </h2>
      <span className="text-[11px] text-amber-400/90 font-mono flex items-center gap-1 bg-[#151B28] px-2 py-0.5 rounded-md border border-amber-500/20">
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
  return startIso ? { startIso, type: log.type } : null;
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
}: PhysiologicalTimelineProps): ReactNode {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const activeSleep = toActiveSleep(currentSleepLog);

  if (events.length === 0 && !activeSleep) {
    return (
      <section className="w-full flex flex-col gap-2 mt-2">
        <TimelineHeader dateText={physiologicalDateDisplay} wakeTime={morningWakeTimeDisplay} />
        <div className="p-4 rounded-xl bg-[#151B28] border border-[#263348] text-center text-xs text-slate-400">
          {t("timeline.empty")}
        </div>
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
      <TimelineHeader dateText={physiologicalDateDisplay} wakeTime={morningWakeTimeDisplay} />
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
      </div>
      {isExpanded && (
        <div className="flex flex-col gap-2">
          {events.map((event) => (
            <TimelineEventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </section>
  );
}
