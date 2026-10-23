"use client";

import { ChevronDown, Moon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

interface NightTipCardProps {
  /** Jedno zdanie widoczne od razu. */
  readonly short: string;
  /** Pełny opis po dotknięciu; brak = karta bez rozwijania. */
  readonly full?: string;
}

/**
 * Wskazówka nocna z planu celu — widoczna podczas trwającego snu nocnego (bez pisania).
 * Domyślnie jedno krótkie zdanie; pełny opis (jeśli jest) po dotknięciu.
 *
 * @param {NightTipCardProps} props - Zdanie i opcjonalny pełny opis
 * @returns {ReactNode} Kompaktowa karta wskazówki
 */
export function NightTipCard({ short, full }: NightTipCardProps): ReactNode {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const canExpand = full !== undefined && full !== short;

  return (
    <aside className="rounded-2xl bg-violet-950/40 border border-violet-500/30">
      <button
        type="button"
        onClick={() => canExpand && setExpanded((v) => !v)}
        aria-expanded={canExpand ? expanded : undefined}
        aria-label={canExpand && !expanded ? t("nightTip.more") : undefined}
        className="w-full min-h-[48px] p-3 flex items-start gap-2.5 text-left"
      >
        <Moon className="w-4 h-4 text-violet-300 mt-0.5 shrink-0" />
        <p className="flex-1 text-sm text-violet-100 leading-snug">
          {expanded && full ? full : short}
        </p>
        {canExpand && !expanded && (
          <ChevronDown className="w-4 h-4 text-violet-300/70 mt-0.5 shrink-0" />
        )}
      </button>
    </aside>
  );
}
