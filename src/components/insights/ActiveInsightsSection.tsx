import { Check, CheckCircle2, Edit3, Sliders, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { ChildInsightRecord } from "@/lib/types/database";
import { CATEGORY_PRESENTATIONS, DEFAULT_CATEGORY_PRESENTATION } from "./constants";

interface ActiveInsightsSectionProps {
  readonly insights: readonly ChildInsightRecord[];
  readonly onAccept: (insightId: string) => void;
  readonly onOpenCorrection: (insight: ChildInsightRecord) => void;
}

/**
 * Odznaka kategorii wniosku z unikalną kolorystyką problemu.
 *
 * @param {object} props - Kod kategorii
 * @returns {ReactNode} Pigułka kategorii
 */
function CategoryBadge({ category }: { category: string }) {
  const { t, tDynamic } = useI18n();
  const config = CATEGORY_PRESENTATIONS[category] || DEFAULT_CATEGORY_PRESENTATION;
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border tracking-wide uppercase ${config.badgeStyle}`}
    >
      {tDynamic(`insights.cat.${category}`, t("insights.default"))}
    </span>
  );
}

/**
 * Pigułka prezentująca parametry nadpisania algorytmu, np. przesunięcie okna czuwania.
 *
 * @param {object} props - Obiekt nadpisania algorytmu
 * @returns {ReactNode | null} Element wizualny nadpisania lub null
 */
function AlgorithmOverridePill({ overrides }: { overrides?: Record<string, unknown> }) {
  if (!overrides || Object.keys(overrides).length === 0) return null;
  const entries = Object.entries(overrides);

  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 text-[10px] font-mono bg-[#1E2738] text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded"
        >
          <Sliders className="w-2.5 h-2.5" />
          <span>
            {key}: {String(value)}
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * Karta pojedynczego aktywnego wniosku lub reguły snu.
 *
 * @param {object} props - Dane wniosku i handlery
 * @returns {ReactNode} Karta wniosku
 */
function ActiveInsightCard({
  insight,
  onAccept,
  onOpenCorrection,
}: {
  insight: ChildInsightRecord;
  onAccept: (id: string) => void;
  onOpenCorrection: (insight: ChildInsightRecord) => void;
}) {
  const { t } = useI18n();
  const isValidated = insight.status === "validated" || insight.parent_feedback === "accepted";
  const confidencePercent = Math.round((insight.confidence_score || 0.85) * 100);

  return (
    <article className="w-full bg-[#151B28] border border-[#263348] rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-lg shadow-black/30">
      <div className="flex items-center justify-between gap-2">
        <CategoryBadge category={insight.category} />
        <span className="text-[10px] text-slate-400 font-medium">
          {t("insights.confidence", { percent: confidencePercent })}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-slate-100 leading-snug">{insight.title}</h3>
        <p className="text-xs text-slate-300 leading-relaxed">{insight.explanation}</p>
        <AlgorithmOverridePill overrides={insight.algorithm_override_json} />
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-[#263348]/60">
        <button
          type="button"
          onClick={() => onAccept(insight.id)}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all min-h-[36px] ${
            isValidated
              ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/40"
              : "bg-[#1E2738] text-slate-200 hover:text-emerald-300 hover:bg-emerald-950/30 border border-transparent"
          }`}
        >
          {isValidated ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>{isValidated ? t("insights.confirmed") : t("insights.worksForUs")}</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenCorrection(insight)}
          className="flex-1 py-1.5 px-3 rounded-xl text-xs font-medium text-slate-200 hover:text-amber-300 bg-[#1E2738] hover:bg-amber-950/30 border border-transparent flex items-center justify-center gap-1.5 transition-all min-h-[36px]"
        >
          <Edit3 className="w-3.5 h-3.5 text-amber-400" />
          <span>{t("insights.adjust")}</span>
        </button>
      </div>
    </article>
  );
}

/**
 * Sekcja prezentująca aktywne i zweryfikowane reguły snu dziecka.
 *
 * @param {ActiveInsightsSectionProps} props - Lista wniosków i handlery
 * @returns {ReactNode} Sekcja aktywnych wniosków
 */
export function ActiveInsightsSection({
  insights,
  onAccept,
  onOpenCorrection,
}: ActiveInsightsSectionProps): ReactNode {
  const { t } = useI18n();
  if (insights.length === 0) {
    return (
      <div className="w-full p-4 rounded-2xl bg-[#151B28]/60 border border-dashed border-[#263348] text-center text-xs text-slate-400">
        {t("insights.emptyActive")}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-2.5 w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{t("insights.activeTitle")}</span>
        </h2>
        <span className="text-[10px] bg-[#1E2738] px-2 py-0.5 rounded-full text-slate-300 font-mono">
          {insights.length}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {insights.map((insight) => (
          <ActiveInsightCard
            key={insight.id}
            insight={insight}
            onAccept={onAccept}
            onOpenCorrection={onOpenCorrection}
          />
        ))}
      </div>
    </section>
  );
}
