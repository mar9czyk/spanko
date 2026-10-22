import { Check, Edit3, Lightbulb, Undo2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CORRECT_INSIGHT_QUERY_PARAM } from "@/components/insights/useInsightsState";
import { useI18n } from "@/i18n/I18nProvider";
import type { ChildInsightRecord } from "@/lib/types/database";

interface SmartInsightCardProps {
  readonly insight: ChildInsightRecord | null;
  /** Wniosek właśnie potwierdzony w tej sesji — karta pokazuje wtedy możliwość cofnięcia. */
  readonly justAcceptedInsightId: string | null;
  readonly onAccept: (insightId: string) => void;
  readonly onUndoAccept: (insightId: string) => void;
}

/**
 * Nagłówek karty Smart Insight z kategorią i ikoną żarówki.
 *
 * @param {object} props - Kategoria i tytuł wniosku
 * @returns {ReactNode} Górny wiersz karty
 */
function InsightHeader({ category, title }: { category: string; title: string }) {
  const { t, tDynamic } = useI18n();
  return (
    <div className="flex items-start gap-2.5">
      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 mt-0.5">
        <Lightbulb className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-400/90 block">
          {tDynamic(`insights.cat.${category}`, t("insights.default"))}
        </span>
        <h2 className="text-base font-semibold text-ink leading-snug">{title}</h2>
      </div>
    </div>
  );
}

/**
 * Pasek przycisków akcji rodzica dla wniosku AI [👍 Działa] oraz [✏️ Skoryguj].
 * Korekta otwiera formularz na stronie wniosków (/insights?correct=<id>).
 *
 * @param {object} props - Identyfikator i handlery akcji
 * @returns {ReactNode} Wiersz przycisków
 */
function InsightActions({
  insightId,
  onAccept,
}: {
  insightId: string;
  onAccept: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onAccept(insightId)}
        className="flex-1 py-1 px-2.5 rounded-lg text-sm font-medium bg-[#1E2738] text-slate-300 hover:text-emerald-300 hover:bg-emerald-950/30 border border-transparent flex items-center justify-center gap-1.5 transition-all min-h-[48px]"
      >
        <Check className="w-3.5 h-3.5 text-emerald-400" />
        <span>{t("insightCard.works")}</span>
      </button>
      <Link
        href={`/insights?${CORRECT_INSIGHT_QUERY_PARAM}=${encodeURIComponent(insightId)}`}
        className="flex-1 py-1 px-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-amber-300 bg-[#1E2738] hover:bg-amber-950/30 border border-transparent flex items-center justify-center gap-1.5 transition-all min-h-[48px]"
      >
        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
        <span>{t("insightCard.adjust")}</span>
      </Link>
    </div>
  );
}

/**
 * Krótkie potwierdzenie po „Działa” z przyciskiem cofnięcia; znika samo po kilku sekundach.
 *
 * @param {object} props - Identyfikator wniosku i handler cofnięcia
 * @returns {ReactNode} Pasek potwierdzenia
 */
function AcceptedNotice({
  insightId,
  onUndoAccept,
}: {
  insightId: string;
  onUndoAccept: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div
      role="status"
      className="w-full bg-emerald-950/40 border border-emerald-500/30 rounded-2xl px-3 py-2 flex items-center gap-2"
    >
      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
      <span className="flex-1 text-sm text-emerald-200">{t("insightCard.saved")}</span>
      <button
        type="button"
        onClick={() => onUndoAccept(insightId)}
        className="py-1 px-3 rounded-lg text-sm font-medium text-slate-200 bg-[#1E2738] hover:text-amber-300 flex items-center gap-1.5 min-h-[48px]"
      >
        <Undo2 className="w-3.5 h-3.5" />
        <span>{t("insightCard.undo")}</span>
      </button>
    </div>
  );
}

/**
 * Czy wniosek ma być widoczny na pulpicie (bąbelek i zakładka): jeszcze bez opinii rodzica
 * albo właśnie potwierdzony w tej sesji (wtedy z możliwością cofnięcia).
 *
 * @param {ChildInsightRecord | null} insight - Aktywny wniosek
 * @param {string | null} justAcceptedInsightId - Wniosek potwierdzony przed chwilą
 * @returns {boolean} Czy pokazać wniosek
 */
export function isInsightShown(
  insight: ChildInsightRecord | null,
  justAcceptedInsightId: string | null,
): insight is ChildInsightRecord {
  if (!insight) return false;
  if (insight.id === justAcceptedInsightId) return true;
  const hasParentFeedback = insight.parent_feedback && insight.parent_feedback !== "pending";
  return !hasParentFeedback && insight.status !== "validated";
}

/**
 * Zawartość zakładki „Wniosek”: kategoria, tytuł, pełne wyjaśnienie oraz akcje
 * [Działa] / [Skoryguj] i link do historii wniosków.
 *
 * @param {SmartInsightCardProps} props - Dane wniosku oraz akcje rodzica
 * @returns {ReactNode} Wyrenderowana zawartość
 */
export function SmartInsightCard({
  insight,
  justAcceptedInsightId,
  onAccept,
  onUndoAccept,
}: SmartInsightCardProps): ReactNode {
  const { t } = useI18n();
  if (!isInsightShown(insight, justAcceptedInsightId)) return null;
  if (insight.id === justAcceptedInsightId) {
    return <AcceptedNotice insightId={insight.id} onUndoAccept={onUndoAccept} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <InsightHeader category={insight.category} title={insight.title} />
      <p className="text-base text-slate-300 leading-relaxed">{insight.explanation}</p>
      <InsightActions insightId={insight.id} onAccept={onAccept} />
      <div className="flex justify-end">
        <Link
          href="/insights"
          className="min-h-[44px] flex items-center text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors"
        >
          {t("insightCard.history")} &rarr;
        </Link>
      </div>
    </div>
  );
}
