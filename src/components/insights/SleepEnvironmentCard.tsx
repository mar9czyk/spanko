import { BedDouble } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { calculateEffectiveAgeDays } from "@/lib/sleep-engine";
import {
  hasSleepEnvironment,
  parseSleepEnvironment,
  sleepEnvironmentAdvice,
} from "@/lib/sleep-environment";
import type { ChildRecord } from "@/lib/types/database";

/**
 * Karta „Miejsce i warunki snu”: stałe porady i flagi bezpieczeństwa dla profilu środowiska dziecka.
 * Bez profilu zachęca do jego wypełnienia. Nie wpływa na żadne prognozy.
 *
 * @param {object} props - Aktywne dziecko
 * @returns {ReactNode} Zwijana karta rad lub null, gdy brak dziecka
 */
export function SleepEnvironmentCard({ child }: { readonly child: ChildRecord | null }): ReactNode {
  const { t, locale } = useI18n();
  if (!child) return null;
  const env = parseSleepEnvironment(child.sleep_environment);
  const ageDays = calculateEffectiveAgeDays(
    child.birth_date,
    child.due_date,
    new Date().toISOString(),
  );
  const advice = sleepEnvironmentAdvice(env, ageDays, locale);
  const groups = [
    { kind: "safety", title: t("env.advice.safety") },
    { kind: "tip", title: t("env.advice.tips") },
    { kind: "context", title: t("env.advice.context") },
  ] as const;

  return (
    <details
      open={advice.some((item) => item.kind === "safety")}
      className="rounded-2xl bg-[#151B28] border border-violet-500/20 p-3.5 text-xs text-slate-300"
    >
      <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-semibold text-violet-200 min-h-[28px]">
        <BedDouble className="w-4 h-4 shrink-0" /> {t("env.advice.title")}
      </summary>
      <div className="pt-2 flex flex-col gap-2">
        {!hasSleepEnvironment(env) && <p>{t("env.advice.fill")}</p>}
        {hasSleepEnvironment(env) && advice.length === 0 && <p>{t("env.advice.none")}</p>}
        {groups.map(({ kind, title }) => {
          const items = advice.filter((item) => item.kind === kind);
          if (items.length === 0) return null;
          return (
            <div key={kind} className="flex flex-col gap-1">
              <span
                className={`font-semibold uppercase tracking-wider ${kind === "safety" ? "text-amber-300" : "text-slate-400"}`}
              >
                {title}
              </span>
              <ul className="list-disc pl-4 flex flex-col gap-1">
                {items.map((item) => (
                  <li key={item.code}>{item.text}</li>
                ))}
              </ul>
            </div>
          );
        })}
        <Link
          href="/settings"
          className="w-fit min-h-10 flex items-center font-semibold text-amber-400"
        >
          {t("env.advice.edit")}
        </Link>
      </div>
    </details>
  );
}
