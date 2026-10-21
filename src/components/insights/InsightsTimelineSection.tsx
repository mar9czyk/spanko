import { AlertTriangle, Clock, GitCommit, MessageSquare, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { dateLocaleTag } from "@/i18n/translate";
import type { ChildInsightRecord } from "@/lib/types/database";

interface InsightsTimelineSectionProps {
  readonly historyInsights: readonly ChildInsightRecord[];
}

/**
 * Formatuje znacznik czasu ISO do daty i godziny w języku interfejsu.
 *
 * @param {string | undefined} isoString - Czas w formacie ISO
 * @param {string} localeTag - Znacznik języka BCP-47
 * @param {string} fallback - Tekst, gdy brak daty
 * @returns {string} Sformatowana data
 */
function formatTimestampDisplay(
  isoString: string | undefined,
  localeTag: string,
  fallback: string,
) {
  if (!isoString) return fallback;
  return new Date(isoString).toLocaleDateString(localeTag, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Odznaka statusu historycznego wniosku (zastąpiony lub skorygowany przez rodzica).
 *
 * @param {object} props - Właściwości statusu
 * @returns {ReactNode} Etykieta statusu
 */
function HistoryStatusBadge({ status }: { status: ChildInsightRecord["status"] }) {
  const { t } = useI18n();
  if (status === "corrected_by_parent") {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
        <AlertTriangle className="w-2.5 h-2.5" />
        <span>{t("insights.correctedByParent")}</span>
      </span>
    );
  }

  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
      <Clock className="w-2.5 h-2.5" />
      <span>{t("insights.superseded")}</span>
    </span>
  );
}

/**
 * Pojedynczy punkt na osi czasu ewolucji snu dziecka.
 *
 * @param {object} props - Wpis historyczny
 * @returns {ReactNode} Element osi czasu
 */
function TimelineEventItem({ insight }: { insight: ChildInsightRecord }) {
  const { t, locale } = useI18n();
  const isCorrected = insight.status === "corrected_by_parent";

  return (
    <div className="relative pl-6 pb-4 group last:pb-1">
      <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-[#151B28] border-2 border-amber-500/60 group-last:border-emerald-500/60 flex items-center justify-center -translate-x-[5px]" />

      <div className="w-full bg-[#151B28]/70 border border-[#263348]/70 rounded-2xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <span className="text-xs text-slate-400 tabular-nums">
            {formatTimestampDisplay(
              insight.valid_from || insight.created,
              dateLocaleTag(locale),
              t("insights.noDate"),
            )}
          </span>
          <HistoryStatusBadge status={insight.status} />
        </div>

        <h3 className="text-xs font-semibold text-slate-200">{insight.title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed">{insight.explanation}</p>

        {isCorrected && insight.parent_correction_note && (
          <div className="p-2 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span className="leading-snug">
              {t("insights.parentSays", { note: insight.parent_correction_note })}
            </span>
          </div>
        )}

        {isCorrected && (
          <div className="text-xs text-emerald-400 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            <span>{t("insights.anomalyExcluded")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Oś czasu prezentująca ewolucję wniosków i historię korekt rodzica.
 *
 * @param {InsightsTimelineSectionProps} props - Lista wpisów historycznych
 * @returns {ReactNode} Sekcja osi czasu
 */
export function InsightsTimelineSection({
  historyInsights,
}: InsightsTimelineSectionProps): ReactNode {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-2.5 w-full pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <GitCommit className="w-3.5 h-3.5 text-amber-400" />
          <span>{t("insights.timelineTitle")}</span>
        </h2>
        <span className="text-xs bg-[#1E2738] px-2 py-0.5 rounded-full text-slate-300 tabular-nums">
          {historyInsights.length}
        </span>
      </div>

      <div className="relative border-l-2 border-[#263348] ml-2 flex flex-col pt-1">
        {historyInsights.length === 0 ? (
          <div className="pl-6 text-xs text-slate-400 py-2">{t("insights.timelineEmpty")}</div>
        ) : (
          historyInsights.map((insight) => <TimelineEventItem key={insight.id} insight={insight} />)
        )}
      </div>
    </section>
  );
}
