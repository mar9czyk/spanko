"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { pastDayStripNowIso } from "@/components/dashboard/dayHistory";
import { PhysiologicalTimeline } from "@/components/dashboard/PhysiologicalTimeline";
import { formatClock } from "@/components/dashboard/timelineMapping";
import { HISTORY_DAYS, useHistoryState } from "@/components/history/useHistoryState";
import { useI18n } from "@/i18n/I18nProvider";
import { dateLocaleTag } from "@/i18n/translate";

/**
 * Ekran Historia (/history): ostatnie doby jedna pod drugą, każda z paskiem 24 godzin
 * i rozwijaną listą drzemek, karmień i pieluch, do porównywania wzorców. Pod każdą dobą
 * (także pustą) jest „Dodaj wpis” do dopisywania zaległych zdarzeń.
 *
 * @returns {ReactNode} Strona historii dób
 */
export default function HistoryPage(): ReactNode {
  const { t, locale } = useI18n();
  const { child, status, days, reload } = useHistoryState();
  const formatDate = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString(dateLocaleTag(locale), {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
      month: "short",
    });

  return (
    <main className="w-full flex flex-col gap-3 pb-8">
      <header className="flex flex-col gap-3 w-full pt-1 pb-1">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 self-start text-xs font-medium text-slate-400 hover:text-amber-400 transition-colors p-1 -ml-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t("insights.dashboard")}</span>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-ink">{t("history.title")}</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {t("history.subtitle", { n: HISTORY_DAYS })}
          </p>
        </div>
      </header>

      {status === "loading" && (
        <p className="text-sm text-slate-400" role="status">
          {t("common.loading")}
        </p>
      )}
      {status === "error" && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
        >
          {t("history.loadError")}
        </p>
      )}
      {status === "empty" && <p className="text-sm text-slate-400">{t("dashboard.noChild")}</p>}
      {status === "ready" && days.every((day) => day.events.length === 0) && (
        <p className="text-sm text-slate-400">{t("history.empty")}</p>
      )}

      {days.map((day) => (
        <PhysiologicalTimeline
          key={day.date}
          physiologicalDateDisplay={formatDate(day.date)}
          morningWakeTimeDisplay={formatClock(day.dayStartIso)}
          events={day.events}
          morningWakeIso={day.dayStartIso}
          nowIso={pastDayStripNowIso(day) ?? new Date().toISOString()}
          currentSleepLog={null}
          onEntryEdited={reload}
          addEntry={
            child
              ? { day, childId: child.id, timeZone: child.timezone, onSaved: reload }
              : undefined
          }
          emptyText={t("timeline.emptyPast")}
        />
      ))}
    </main>
  );
}
