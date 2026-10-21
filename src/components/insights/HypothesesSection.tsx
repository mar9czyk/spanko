import { Eye, HelpCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { ChildInsightRecord } from "@/lib/types/database";
import { CATEGORY_PRESENTATIONS, DEFAULT_CATEGORY_PRESENTATION } from "./constants";

interface HypothesesSectionProps {
  readonly hypotheses: readonly ChildInsightRecord[];
}

/**
 * Karta pojedynczej hipotezy w trakcie zbierania danych z doby fizjologicznej.
 *
 * @param {object} props - Dane hipotezy
 * @returns {ReactNode} Karta hipotezy
 */
function HypothesisCard({ hypothesis }: { hypothesis: ChildInsightRecord }) {
  const { t, tDynamic } = useI18n();
  const config = CATEGORY_PRESENTATIONS[hypothesis.category] || DEFAULT_CATEGORY_PRESENTATION;

  return (
    <article className="w-full bg-[#151B28]/80 border border-violet-500/20 rounded-2xl p-3.5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded border tracking-wide uppercase ${config.badgeStyle}`}
        >
          {tDynamic(`insights.cat.${hypothesis.category}`, t("insights.default"))}
        </span>
        <span className="text-xs text-violet-300 bg-violet-950/60 border border-violet-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
          <Eye className="w-2.5 h-2.5" />
          <span>{t("insights.observation")}</span>
        </span>
      </div>

      <h3 className="text-xs font-semibold text-ink">{hypothesis.title}</h3>
      <p className="text-xs text-slate-300 leading-relaxed">{hypothesis.explanation}</p>
    </article>
  );
}

/**
 * Sekcja prezentująca wstępne hipotezy silnika snu będące pod obserwacją.
 *
 * @param {HypothesesSectionProps} props - Lista hipotez
 * @returns {ReactNode | null} Sekcja hipotez lub null
 */
export function HypothesesSection({ hypotheses }: HypothesesSectionProps): ReactNode {
  const { t } = useI18n();
  if (hypotheses.length === 0) return null;

  return (
    <section className="flex flex-col gap-2 w-full pt-1">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>{t("insights.hypothesesTitle")}</span>
        </h2>
        <span className="text-xs bg-[#1E2738] px-2 py-0.5 rounded-full text-slate-300 tabular-nums">
          {hypotheses.length}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {hypotheses.map((hypothesis) => (
          <HypothesisCard key={hypothesis.id} hypothesis={hypothesis} />
        ))}
      </div>
    </section>
  );
}
