"use client";

import { Car, ChevronDown, HeartPulse, Phone } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  EMERGENCY_SIGNS,
  GUIDANCE_COPY,
  GUIDANCE_TOPICS,
  type GuidanceLocale,
  URGENT_SIGNS,
} from "@/lib/day-mode-guidance";
import type { DayModeGuidance } from "@/lib/sleep-engine";

interface DayModeGuidanceCardProps {
  readonly guidance: DayModeGuidance | null;
  readonly isWakeCheckNeeded: boolean;
  readonly locale: GuidanceLocale;
}

/**
 * Podpowiedzi trybów „Choroba” i „W drodze”: jak pomóc w spaniu, bezpieczeństwo i czerwone flagi.
 *
 * @description
 * Treść deterministyczna z `day-mode-guidance.ts`, tematy wybiera silnik. Przy długim śnie
 * w chorobie karta pyta jednym dotknięciem, czy dziecko łatwo się wybudza (NICE NG143).
 *
 * @param {DayModeGuidanceCardProps} props - Wybrane tematy, pytanie o budzenie i język
 * @returns {ReactNode} Karta albo nic w zwykły dzień w domu
 */
export function DayModeGuidanceCard({
  guidance,
  isWakeCheckNeeded,
  locale,
}: DayModeGuidanceCardProps): ReactNode {
  const [wakeAnswer, setWakeAnswer] = useState<"yes" | "no" | null>(null);
  if (!guidance) return null;
  const copy = GUIDANCE_COPY[locale];
  const isIllness = guidance.mode === "illness";
  const showAlarm = wakeAnswer === "no";

  return (
    <section
      className={`rounded-2xl bg-[#151B28] border p-3.5 flex flex-col gap-3 ${
        isIllness ? "border-coral-400/30" : "border-amber-500/25"
      }`}
    >
      <h2
        className={`flex items-center gap-2 text-sm font-semibold ${
          isIllness ? "text-coral-200" : "text-amber-200"
        }`}
      >
        {isIllness ? <HeartPulse className="w-4 h-4" /> : <Car className="w-4 h-4" />}
        {isIllness ? copy.illnessTitle : copy.onTheGoTitle}
      </h2>

      {isIllness && isWakeCheckNeeded && wakeAnswer !== "yes" && !showAlarm && (
        <div className="rounded-xl bg-[#1E2738] p-3 flex flex-col gap-2">
          <p className="text-sm text-ink">{copy.wakeCheckQuestion}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setWakeAnswer("yes")}
              className="min-h-12 flex-1 rounded-xl bg-emerald-500/15 text-sm font-semibold text-emerald-200"
            >
              {copy.wakeCheckYes}
            </button>
            <button
              type="button"
              onClick={() => setWakeAnswer("no")}
              className="min-h-12 flex-1 rounded-xl bg-coral-500/20 text-sm font-semibold text-coral-200"
            >
              {copy.wakeCheckNo}
            </button>
          </div>
        </div>
      )}
      {wakeAnswer === "yes" && <p className="text-sm text-emerald-200">{copy.wakeCheckOk}</p>}

      {guidance.showRedFlags && (
        <div
          role={showAlarm ? "alert" : undefined}
          className={`rounded-xl px-3 flex flex-col gap-1.5 ${
            showAlarm ? "bg-coral-500/25 border border-coral-400/60" : "bg-coral-500/10"
          }`}
        >
          <h3 className="min-h-12 flex items-center gap-1.5 text-sm font-semibold text-coral-200">
            <Phone className="w-4 h-4 shrink-0" /> {copy.redFlagsTitle}
          </h3>
          {showAlarm && (
            <p className="text-base font-semibold text-coral-200">{copy.wakeCheckAlarm}</p>
          )}
          <p className="text-sm font-semibold text-coral-200">{copy.emergencyTitle}</p>
          <ul className="list-disc pl-4 text-sm text-ink flex flex-col gap-0.5">
            {EMERGENCY_SIGNS[locale].map((sign) => (
              <li key={sign}>{sign}</li>
            ))}
          </ul>
          <p className="pt-1 text-sm font-semibold text-coral-200">{copy.urgentTitle}</p>
          <ul className="list-disc pl-4 text-sm text-ink flex flex-col gap-0.5">
            {guidance.isYoungInfant && <li className="font-semibold">{copy.youngInfantFever}</li>}
            {URGENT_SIGNS[locale].map((sign) => (
              <li key={sign}>{sign}</li>
            ))}
          </ul>
          <p className="pt-1 pb-3 text-xs text-slate-400">{copy.whereToGo}</p>
        </div>
      )}

      {guidance.topics.map((topic) => {
        const section = GUIDANCE_TOPICS[topic][locale];
        return (
          <details key={topic} className="group">
            <summary className="cursor-pointer list-none min-h-12 flex items-center text-sm font-semibold text-ink">
              {section.title}
              <ChevronDown className="w-4 h-4 ml-auto shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <ul className="list-disc pl-4 pb-1 text-sm text-slate-300 flex flex-col gap-1">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
              {topic === "medicines" && guidance.isUnder6Months && (
                <li>{copy.under6MonthsIbuprofen}</li>
              )}
            </ul>
          </details>
        );
      })}

      <p className="text-xs text-slate-400">{isIllness ? copy.sources : copy.sourcesOnTheGo}</p>
    </section>
  );
}
