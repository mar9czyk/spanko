import { Apple, Droplets, Milk, Moon, Sparkles, Tag } from "lucide-react";
import type { ReactNode } from "react";
import type {
  TimelineDiaperEvent,
  TimelineEvent,
  TimelineFeedingEvent,
  TimelineNapEvent,
} from "./types";

/**
 * Prezentuje kartę zdarzenia snu lub drzemki na osi czasu.
 *
 * @param {object} props - Wpis snu
 * @returns {ReactNode} Karta snu
 */
function NapEventCard({ event }: { event: TimelineNapEvent }) {
  const isNight = event.type === "night";
  const durationText = event.durationMinutes ? `${event.durationMinutes} min` : "W toku...";

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-[#151B28] border border-[#263348] shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`p-2 rounded-lg ${isNight ? "bg-violet-950/60 text-violet-400" : "bg-amber-950/60 text-amber-400"}`}
        >
          {isNight ? <Moon className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
        </div>
        <div>
          <span className="text-xs font-semibold text-slate-100 block">
            {isNight ? "Sen nocny" : "Drzemka"}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {event.startTime} {event.endTime ? `— ${event.endTime}` : ""}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono font-medium text-slate-200 bg-[#1E2738] px-2 py-0.5 rounded-md">
          {durationText}
        </span>
      </div>
    </div>
  );
}

/**
 * Prezentuje kartę karmienia (pierś, butelka lub stały posiłek).
 *
 * @param {object} props - Wpis karmienia
 * @returns {ReactNode} Karta karmienia
 */
function FeedingEventCard({ event }: { event: TimelineFeedingEvent }) {
  let label = "Karmienie";
  if (event.feedingType === "breast") {
    const side =
      event.breastSide === "left" ? "Lewa" : event.breastSide === "right" ? "Prawa" : "L+P";
    label = `Pierś (${side}${event.breastMinutes ? `, ${event.breastMinutes} min` : ""})`;
  } else if (event.feedingType === "bottle") {
    label = `Butelka (${event.bottleMl || 120} ml)`;
  } else if (event.feedingType === "solid") {
    label = `Stały posiłek ${event.notes ? `(${event.notes})` : ""}`;
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-[#151B28] border border-[#263348] shadow-sm">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-950/50 text-emerald-400">
          {event.feedingType === "solid" ? (
            <Apple className="w-4 h-4" />
          ) : (
            <Milk className="w-4 h-4" />
          )}
        </div>
        <div>
          <span className="text-xs font-semibold text-slate-100 block">{label}</span>
          <span className="text-[11px] text-slate-400 font-mono">{event.time}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Prezentuje kartę zmiany pieluchy.
 *
 * @param {object} props - Wpis pieluchy
 * @returns {ReactNode} Karta pieluchy
 */
function DiaperEventCard({ event }: { event: TimelineDiaperEvent }) {
  const label =
    event.diaperKind === "wet"
      ? "Mokra"
      : event.diaperKind === "dirty"
        ? "Brudna"
        : "Mokra + brudna";
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#151B28] border border-[#263348] shadow-sm">
      <div className="p-2 rounded-lg bg-sky-950/50 text-sky-400">
        <Droplets className="w-4 h-4" />
      </div>
      <div>
        <span className="text-xs font-semibold text-slate-100 block">Pielucha: {label}</span>
        <span className="text-[11px] text-slate-400 font-mono">{event.time}</span>
      </div>
    </div>
  );
}

/**
 * Pojedyncza karta wpisu na osi czasu bieżącej doby fizjologicznej.
 *
 * @param {object} props - Zdarzenie osi czasu
 * @returns {ReactNode} Wyrenderowana karta
 */
export function TimelineEventCard({ event }: { event: TimelineEvent }): ReactNode {
  if (event.kind === "nap") {
    return <NapEventCard event={event} />;
  }
  if (event.kind === "feeding") {
    return <FeedingEventCard event={event} />;
  }
  if (event.kind === "diaper") {
    return <DiaperEventCard event={event} />;
  }
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#151B28] border border-[#263348]">
      <div className="p-2 rounded-lg bg-[#1E2738] text-slate-400">
        <Tag className="w-4 h-4" />
      </div>
      <div>
        <span className="text-xs font-semibold text-slate-200 block">
          Tagi: {event.tags.join(", ")}
        </span>
        <span className="text-[11px] text-slate-400 font-mono">{event.time}</span>
      </div>
    </div>
  );
}
