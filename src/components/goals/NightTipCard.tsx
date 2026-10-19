import { Moon } from "lucide-react";
import type { ReactNode } from "react";
import type { CopyLocale } from "@/lib/goal-copy";
import { describeTask } from "@/lib/goal-copy";
import type { DailyTask } from "@/lib/goals-engine/types";

interface NightTipCardProps {
  readonly tip: DailyTask;
  readonly locale: CopyLocale;
}

/**
 * Wskazówka nocna z planu celu — widoczna podczas trwającego snu nocnego (bez pisania).
 *
 * @param {NightTipCardProps} props - Zadanie nocne i język
 * @returns {ReactNode} Kompaktowa karta wskazówki
 */
export function NightTipCard({ tip, locale }: NightTipCardProps): ReactNode {
  return (
    <aside className="rounded-2xl bg-violet-950/40 border border-violet-500/30 p-3 flex items-start gap-2.5">
      <Moon className="w-4 h-4 text-violet-300 mt-0.5 shrink-0" />
      <p className="text-sm text-violet-100 leading-snug">{describeTask(tip, locale)}</p>
    </aside>
  );
}
