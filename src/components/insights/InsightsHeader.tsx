import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface InsightsHeaderProps {
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
  isEvaluating,
  onTriggerEvaluation,
}: InsightsHeaderProps): ReactNode {
  return (
    <header className="flex flex-col gap-3 w-full pt-1 pb-3">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-amber-400 transition-colors p-1 -ml-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
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
          <span>{isEvaluating ? "Analizuję..." : "Przeanalizuj sen z AI"}</span>
        </button>
      </div>

      <div>
        <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <span>Karta Rozwoju Snu Dziecka</span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Ewolucyjna baza wniosków i reguł deterministycznego silnika Spanko.
        </p>
      </div>
    </header>
  );
}
