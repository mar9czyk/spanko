import { Calendar, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { TimelineEventCard } from "./TimelineEventCard";
import type { TimelineEvent } from "./types";

interface PhysiologicalTimelineProps {
  readonly physiologicalDateDisplay: string;
  readonly morningWakeTimeDisplay: string;
  readonly events: readonly TimelineEvent[];
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
 * Oś czasu bieżącej doby fizjologicznej prezentująca drzemki, karmienia i tagi dnia.
 *
 * @param {PhysiologicalTimelineProps} props - Dane zdarzeń doby fizjologicznej
 * @returns {ReactNode} Sekcja osi czasu
 */
export function PhysiologicalTimeline({
  physiologicalDateDisplay,
  morningWakeTimeDisplay,
  events,
}: PhysiologicalTimelineProps): ReactNode {
  const { t } = useI18n();
  return (
    <section className="w-full flex flex-col gap-2 mt-2">
      <TimelineHeader dateText={physiologicalDateDisplay} wakeTime={morningWakeTimeDisplay} />
      <div className="flex flex-col gap-2">
        {events.length === 0 ? (
          <div className="p-4 rounded-xl bg-[#151B28] border border-[#263348] text-center text-xs text-slate-400">
            {t("timeline.empty")}
          </div>
        ) : (
          events.map((event) => <TimelineEventCard key={event.id} event={event} />)
        )}
      </div>
    </section>
  );
}
