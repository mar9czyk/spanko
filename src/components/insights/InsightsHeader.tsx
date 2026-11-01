import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChildAvatar, useChildFileToken } from "@/components/dashboard/ChildSwitcher";
import { formatChildAge } from "@/components/dashboard/useDashboardState";
import { useI18n } from "@/i18n/I18nProvider";
import { childPhotoUrl } from "@/lib/child-photo";
import { calculateEffectiveAgeDays } from "@/lib/sleep-engine";
import type { ChildRecord } from "@/lib/types/database";

interface InsightsHeaderProps {
  /** Dziecko, którego dotyczą wnioski; null przed załadowaniem */
  readonly child: ChildRecord | null;
  readonly isEvaluating: boolean;
  readonly onTriggerEvaluation: () => void;
}

/**
 * Górny pasek nawigacyjny widoku Karta Rozwoju Snu Dziecka z akcją wywołania AI.
 *
 * @param {InsightsHeaderProps} props - Stan ładowania oraz callback analizy
 * @returns {ReactNode} Nagłówek widoku
 */
export function InsightsHeader({
  child,
  isEvaluating,
  onTriggerEvaluation,
}: InsightsHeaderProps): ReactNode {
  const { t } = useI18n();
  const fileToken = useChildFileToken(child ? [child] : []);
  return (
    <header className="flex flex-col gap-3 w-full pt-1 pb-3">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-amber-400 transition-colors p-1 -ml-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t("insights.dashboard")}</span>
        </Link>
        <button
          type="button"
          onClick={onTriggerEvaluation}
          disabled={isEvaluating}
          className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
        >
          {isEvaluating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          <span>{isEvaluating ? t("insights.analyzing") : t("insights.analyze")}</span>
        </button>
      </div>

      {child && (
        <div className="flex items-center gap-2.5" data-testid="insights-child">
          <ChildAvatar
            child={child}
            photoUrl={fileToken ? childPhotoUrl(child, fileToken) : null}
            size="md"
            isActive
          />
          <p className="text-sm font-semibold text-ink leading-tight">
            {child.name}
            <span className="ml-1.5 text-xs font-normal text-slate-400">
              (
              {formatChildAge(
                calculateEffectiveAgeDays(
                  child.birth_date,
                  child.due_date,
                  new Date().toISOString(),
                ),
                t,
              )}
              )
            </span>
          </p>
        </div>
      )}

      <div>
        <h1 className="text-lg font-bold text-ink flex items-center gap-2">
          <span>{t("insights.title")}</span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">{t("insights.subtitle")}</p>
      </div>
    </header>
  );
}
