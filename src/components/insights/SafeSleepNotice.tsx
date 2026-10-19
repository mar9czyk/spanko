import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { SAFE_SLEEP_GUIDELINES, SAFE_SLEEP_MAX_AGE_DAYS } from "@/lib/safe-sleep";
import { calculateEffectiveAgeDays } from "@/lib/sleep-engine";
import type { ChildRecord } from "@/lib/types/database";

interface SafeSleepNoticeProps {
  readonly child: ChildRecord | null;
}

/**
 * Stały blok zaleceń bezpiecznego snu AAP 2022 dla dzieci poniżej 12 mies. (wiek korygowany).
 *
 * @description
 * Tekst deterministyczny z `safe-sleep.ts` — nigdy nie pochodzi z AI.
 *
 * @param {SafeSleepNoticeProps} props - Aktywne dziecko
 * @returns {ReactNode} Karta zaleceń lub nic dla starszych dzieci
 */
export function SafeSleepNotice({ child }: SafeSleepNoticeProps): ReactNode {
  const { t, locale } = useI18n();
  if (!child) return null;
  const ageDays = calculateEffectiveAgeDays(
    child.birth_date,
    child.due_date,
    new Date().toISOString(),
  );
  if (ageDays >= SAFE_SLEEP_MAX_AGE_DAYS) return null;

  return (
    <details
      open
      className="rounded-2xl bg-[#151B28] border border-emerald-500/20 p-3.5 text-xs text-slate-300"
    >
      <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-semibold text-emerald-200 min-h-[28px]">
        <ShieldCheck className="w-4 h-4 shrink-0" /> {t("safeSleep.title")}
      </summary>
      <ul className="list-disc pl-4 pt-2 flex flex-col gap-1">
        {SAFE_SLEEP_GUIDELINES[locale].map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="pt-2 text-[11px] text-slate-400">{t("safeSleep.source")}</p>
    </details>
  );
}
