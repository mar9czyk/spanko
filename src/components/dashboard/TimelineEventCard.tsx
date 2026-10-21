import { Apple, Droplets, Milk, Moon, Sparkles, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDuration, formatVolume } from "@/i18n/translate";
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
  const { t } = useI18n();
  const isNight = event.type === "night";
  const durationText = event.durationMinutes
    ? formatDuration(event.durationMinutes)
    : t("timeline.inProgress");

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-[#151B28] border border-[#263348] shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`p-2 rounded-lg ${isNight ? "bg-violet-950/60 text-violet-400" : "bg-amber-950/60 text-amber-400"}`}
        >
          {isNight ? <Moon className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
        </div>
        <div>
          <span className="text-sm font-semibold text-ink block">
            {isNight ? t("timeline.night") : t("timeline.nap")}
          </span>
          <span className="text-sm text-slate-400 tabular-nums">
            {event.startTime} {event.endTime ? `— ${event.endTime}` : ""}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs tabular-nums font-medium text-slate-200 bg-[#1E2738] px-2 py-0.5 rounded-md">
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
  const { t, units } = useI18n();
  let label = t("timeline.feeding");
  if (event.feedingType === "breast") {
    const side =
      event.breastSide === "left"
        ? t("side.left")
        : event.breastSide === "right"
          ? t("side.right")
          : t("side.both");
    const details = event.breastMinutes ? `${side}, ${formatDuration(event.breastMinutes)}` : side;
    label = t("timeline.breast", { details });
  } else if (event.feedingType === "bottle") {
    label = t("timeline.bottle", { volume: formatVolume(event.bottleMl || 120, units) });
  } else if (event.feedingType === "solid") {
    label = `${t("timeline.solid")}${event.notes ? ` (${event.notes})` : ""}`;
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
          <span className="text-sm font-semibold text-ink block">{label}</span>
          <span className="text-sm text-slate-400 tabular-nums">{event.time}</span>
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
  const { t } = useI18n();
  const label = t(`diaper.${event.diaperKind}` as const).replace(/^\S+\s/, "");
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#151B28] border border-[#263348] shadow-sm">
      <div className="p-2 rounded-lg bg-diaper/10 text-diaper">
        <Droplets className="w-4 h-4" />
      </div>
      <div>
        <span className="text-sm font-semibold text-ink block">
          {t("timeline.diaper", { kind: label })}
        </span>
        <span className="text-sm text-slate-400 tabular-nums">{event.time}</span>
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
  const { t, tDynamic } = useI18n();
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
        <span className="text-sm font-semibold text-slate-200 block">
          {t("timeline.tags", {
            tags: event.tags.map((tag) => tDynamic(`tag.${tag}`, tag)).join(", "),
          })}
        </span>
        <span className="text-sm text-slate-400 tabular-nums">{event.time}</span>
      </div>
    </div>
  );
}
