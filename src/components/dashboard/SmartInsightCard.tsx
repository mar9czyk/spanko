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
        <h2 className="text-sm font-semibold text-ink leading-snug line-clamp-1">{title}</h2>
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
    <div className="flex items-center gap-2 pt-1 border-t border-[#263348]/40">
      <button
        type="button"
        onClick={() => onAccept(insightId)}
        className="flex-1 py-1 px-2.5 rounded-lg text-sm font-medium bg-[#1E2738] text-slate-300 hover:text-emerald-300 hover:bg-emerald-950/30 border border-transparent flex items-center justify-center gap-1.5 transition-all min-h-[32px]"
      >
        <Check className="w-3.5 h-3.5 text-emerald-400" />
        <span>{t("insightCard.works")}</span>
      </button>
      <Link
        href={`/insights?${CORRECT_INSIGHT_QUERY_PARAM}=${encodeURIComponent(insightId)}`}
        className="flex-1 py-1 px-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-amber-300 bg-[#1E2738] hover:bg-amber-950/30 border border-transparent flex items-center justify-center gap-1.5 transition-all min-h-[32px]"
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
        className="py-1 px-3 rounded-lg text-sm font-medium text-slate-200 bg-[#1E2738] hover:text-amber-300 flex items-center gap-1.5 min-h-[32px]"
      >
        <Undo2 className="w-3.5 h-3.5" />
        <span>{t("insightCard.undo")}</span>
      </button>
    </div>
  );
}

/**
 * Karta Smart Insight pod nagłówkiem prezentująca kluczowy aktywny wniosek z child_insights.
 *
 * @description
 * Oferuje rodzicowi natychmiastową informację o adaptacji okna czuwania lub rytmu
 * wraz z możliwością zatwierdzenia lub korekty jednym dotknięciem kciuka. Wniosek, któremu
 * rodzic już dał opinię, nie wraca na pulpit (pełna lista i cofanie są na /insights).
 *
 * @param {SmartInsightCardProps} props - Dane wniosku oraz akcje rodzica
 * @returns {ReactNode} Wyrenderowana karta wniosku
 */
export function SmartInsightCard({
  insight,
  justAcceptedInsightId,
  onAccept,
  onUndoAccept,
}: SmartInsightCardProps): ReactNode {
  const { t } = useI18n();
  if (!insight) return null;
  if (insight.id === justAcceptedInsightId) {
    return <AcceptedNotice insightId={insight.id} onUndoAccept={onUndoAccept} />;
  }
  const hasParentFeedback = insight.parent_feedback && insight.parent_feedback !== "pending";
  if (hasParentFeedback || insight.status === "validated") return null;

  return (
    <div className="w-full bg-[#151B28] border border-[#263348] rounded-2xl p-3 flex flex-col gap-2 shadow-lg shadow-black/40">
      <InsightHeader category={insight.category} title={insight.title} />
      <p className="text-sm text-slate-300 leading-relaxed pl-8 pr-1">{insight.explanation}</p>
      <InsightActions insightId={insight.id} onAccept={onAccept} />
      <div className="flex justify-end pt-0.5">
        <Link
          href="/insights"
          className="text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors"
        >
          {t("insightCard.history")} &rarr;
        </Link>
      </div>
    </div>
  );
}
