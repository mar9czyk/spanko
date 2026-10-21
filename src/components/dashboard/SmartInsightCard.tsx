import { Check, Edit3, Lightbulb } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { ChildInsightRecord } from "@/lib/types/database";

interface SmartInsightCardProps {
  readonly insight: ChildInsightRecord | null;
  readonly onAccept: (insightId: string) => void;
  readonly onAdjust: (insightId: string) => void;
}

/**
 * Nagłówek karty Smart Insight z kategorią i ikoną żarówki.
 *
 * @param {object} props - Kategoria i tytuł wniosku
 * @returns {ReactNode} Górny wiersz karty
 */
function InsightHeader({ category, title }: { category: string; title: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 mt-0.5">
        <Lightbulb className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-400/90 block">
          {category}
        </span>
        <h2 className="text-sm font-semibold text-ink leading-snug line-clamp-1">{title}</h2>
      </div>
    </div>
  );
}

/**
 * Pasek przycisków akcji rodzica dla wniosku AI [👍 Działa] oraz [✏️ Skoryguj].
 *
 * @param {object} props - Identyfikator i handlery akcji
 * @returns {ReactNode} Wiersz przycisków
 */
function InsightActions({
  insightId,
  isAccepted,
  onAccept,
  onAdjust,
}: {
  insightId: string;
  isAccepted: boolean;
  onAccept: (id: string) => void;
  onAdjust: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2 pt-1 border-t border-[#263348]/40">
      <button
        type="button"
        onClick={() => onAccept(insightId)}
        className={`flex-1 py-1 px-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-all min-h-[32px] ${
          isAccepted
            ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/40"
            : "bg-[#1E2738] text-slate-300 hover:text-emerald-300 hover:bg-emerald-950/30 border border-transparent"
        }`}
      >
        <Check className="w-3.5 h-3.5 text-emerald-400" />
        <span>{isAccepted ? t("insightCard.worksActive") : t("insightCard.works")}</span>
      </button>
      <button
        type="button"
        onClick={() => onAdjust(insightId)}
        className="flex-1 py-1 px-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-amber-300 bg-[#1E2738] hover:bg-amber-950/30 border border-transparent flex items-center justify-center gap-1.5 transition-all min-h-[32px]"
      >
        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
        <span>{t("insightCard.adjust")}</span>
      </button>
    </div>
  );
}

/**
 * Karta Smart Insight pod nagłówkiem prezentująca kluczowy aktywny wniosek z child_insights.
 *
 * @description
 * Oferuje rodzicowi natychmiastową informację o adaptacji okna czuwania lub rytmu
 * wraz z możliwością zatwierdzenia lub korekty jednym dotknięciem kciuka.
 *
 * @param {SmartInsightCardProps} props - Dane wniosku oraz akcje rodzica
 * @returns {ReactNode} Wyrenderowana karta wniosku
 */
export function SmartInsightCard({
  insight,
  onAccept,
  onAdjust,
}: SmartInsightCardProps): ReactNode {
  const { t } = useI18n();
  if (!insight) return null;

  const isAccepted = insight.parent_feedback === "accepted";

  return (
    <div className="w-full bg-[#151B28] border border-[#263348] rounded-2xl p-3 flex flex-col gap-2 shadow-lg shadow-black/40">
      <InsightHeader category={insight.category} title={insight.title} />
      <p className="text-sm text-slate-300 leading-relaxed pl-8 pr-1">{insight.explanation}</p>
      <InsightActions
        insightId={insight.id}
        isAccepted={isAccepted}
        onAccept={onAccept}
        onAdjust={onAdjust}
      />
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
