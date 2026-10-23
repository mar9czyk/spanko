import { ChevronDown, Footprints } from "lucide-react";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { ChildInsightRecord } from "@/lib/types/database";

interface InsightAdviceWhyProps {
  readonly insight: Pick<ChildInsightRecord, "explanation" | "clinical_action">;
  /** Mniejsza typografia dla listy wniosków na stronie /insights. */
  readonly compact?: boolean;
}

/**
 * Rozdziela treść wniosku na dwie części: wyróżnioną radę („Co zrobić”) oraz zwijane „Dlaczego?”.
 * Starsze wnioski bez osobnej rady pokazują dotychczasowy, jeden tekst.
 *
 * @param {InsightAdviceWhyProps} props - Wniosek i wariant rozmiaru
 * @returns {ReactNode} Sekcje rady i uzasadnienia
 */
export function InsightAdviceWhy({ insight, compact = false }: InsightAdviceWhyProps): ReactNode {
  const { t } = useI18n();
  const [whyOpen, setWhyOpen] = useState(false);
  const whyId = useId();
  const advice = insight.clinical_action?.trim();
  const bodySize = compact ? "text-xs" : "text-base";

  if (!advice) {
    return <p className={`${bodySize} text-slate-300 leading-relaxed`}>{insight.explanation}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 border-l-4 border-l-amber-400 px-3 py-2.5 flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
          <Footprints className="w-3.5 h-3.5" />
          {t("insightCard.advice")}
        </span>
        <p className={`${bodySize} font-medium text-ink leading-relaxed`}>{advice}</p>
      </div>
      <button
        type="button"
        onClick={() => setWhyOpen((open) => !open)}
        aria-expanded={whyOpen}
        aria-controls={whyId}
        className="self-start min-h-[44px] -my-1 flex items-center gap-1 text-sm font-medium text-violet-300 hover:text-violet-200 transition-colors"
      >
        <span>{t("insightCard.why")}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${whyOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {whyOpen && (
        <p
          id={whyId}
          className={`${compact ? "text-xs" : "text-sm"} text-slate-300 leading-relaxed pl-3 border-l-2 border-violet-400/40`}
        >
          {insight.explanation}
        </p>
      )}
    </div>
  );
}
