import { Moon } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { calculateEffectiveAgeDays } from "@/lib/sleep-engine";
import { sleepFoundationsForAge } from "@/lib/sleep-foundations";
import type { ChildRecord } from "@/lib/types/database";

interface SleepFoundationsCardProps {
  readonly child: ChildRecord | null;
}

/**
 * Karta „Fundamenty dobrego snu”: stałe rady bez treningu snu, dobrane do wieku korygowanego.
 *
 * @param {SleepFoundationsCardProps} props - Aktywne dziecko
 * @returns {ReactNode} Zwijana karta rad
 */
export function SleepFoundationsCard({ child }: SleepFoundationsCardProps): ReactNode {
  const { t, locale } = useI18n();
  if (!child) return null;
  const ageDays = calculateEffectiveAgeDays(
    child.birth_date,
    child.due_date,
    new Date().toISOString(),
  );

  return (
    <details className="rounded-2xl bg-[#151B28] border border-violet-500/20 p-3.5 text-xs text-slate-300">
      <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-semibold text-violet-200 min-h-[28px]">
        <Moon className="w-4 h-4 shrink-0" /> {t("foundations.title")}
      </summary>
      <ul className="list-disc pl-4 pt-2 flex flex-col gap-1">
        {sleepFoundationsForAge(ageDays, locale).map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </details>
  );
}
