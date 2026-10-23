"use client";

import { ChevronDown, Moon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { CopyLocale } from "@/lib/goal-copy";
import { describeTask, describeTaskShort } from "@/lib/goal-copy";
import type { DailyTask } from "@/lib/goals-engine/types";

interface NightTipCardProps {
  readonly tip: DailyTask;
  readonly locale: CopyLocale;
}

/**
 * Wskazówka nocna z planu celu — widoczna podczas trwającego snu nocnego (bez pisania).
 * Domyślnie jedno krótkie zdanie; pełny opis po dotknięciu.
 *
 * @param {NightTipCardProps} props - Zadanie nocne i język
 * @returns {ReactNode} Kompaktowa karta wskazówki
 */
export function NightTipCard({ tip, locale }: NightTipCardProps): ReactNode {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  return (
    <aside className="rounded-2xl bg-violet-950/40 border border-violet-500/30">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={expanded ? undefined : t("nightTip.more")}
        className="w-full min-h-[48px] p-3 flex items-start gap-2.5 text-left"
      >
        <Moon className="w-4 h-4 text-violet-300 mt-0.5 shrink-0" />
        <p className="flex-1 text-sm text-violet-100 leading-snug">
          {expanded ? describeTask(tip, locale) : describeTaskShort(tip, locale)}
        </p>
        {!expanded && <ChevronDown className="w-4 h-4 text-violet-300/70 mt-0.5 shrink-0" />}
      </button>
    </aside>
  );
}
