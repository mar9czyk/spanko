"use client";

import { Moon, Radio, Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { SleepStatus, SleepType } from "@/lib/types/database";

interface ActiveSleepTimerProps {
  readonly status: SleepStatus;
  readonly sleepType: SleepType;
  readonly startTimeIso?: string;
  /** Sugerowana pora wybudzenia z drzemki (HH:mm); miękka sugestia, nie limit. */
  readonly wakeSuggestion?: string | null;
  /** Liczba pobudek zapisanych w trwającym śnie nocnym; pokazywana od pierwszej. */
  readonly wakingsCount?: number;
}

/**
 * Formatuje liczbę sekund do postaci HH:mm:ss.
 *
 * @param {number} totalSeconds - Łączna liczba sekund
 * @returns {string} Czas w formacie HH:mm:ss
 */
function formatStopwatchTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (val: number) => String(val).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Zwraca konfigurację stylów i klucz tytułu dla bieżącego stanu snu.
 *
 * @param {SleepStatus} status - Status snu
 * @param {SleepType} sleepType - Typ snu
 * @returns {object} Kolor i klucz etykiety
 */
function resolveStatusConfig(status: SleepStatus, sleepType: SleepType) {
  if (status === "falling_asleep") {
    return {
      titleKey: "timer.fallingAsleep" as const,
      colorClass: "text-amber-400 border-amber-500/30 shadow-amber-500/10",
      accent: "text-amber-300",
    };
  }
  return {
    titleKey: sleepType === "night" ? ("timer.night" as const) : ("timer.nap" as const),
    colorClass: "text-violet-400 border-violet-500/30 shadow-violet-500/10",
    accent: "text-violet-300",
  };
}

/**
 * Aktywny stoper trwającego snu lub usypiania zsynchronizowany na żywo z PocketBase.
 *
 * @param {ActiveSleepTimerProps} props - Dane trwającej sesji snu
 * @returns {ReactNode} Komponent aktywnego stopera
 */
export function ActiveSleepTimer({
  status,
  sleepType,
  startTimeIso,
  wakeSuggestion,
  wakingsCount = 0,
}: ActiveSleepTimerProps): ReactNode {
  const { t } = useI18n();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startMs = startTimeIso ? new Date(startTimeIso).getTime() : Date.now();
    const update = () => {
      const diff = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      setElapsedSeconds(diff);
    };

    update();
    const intervalId = setInterval(update, 1000);
    return () => clearInterval(intervalId);
  }, [startTimeIso]);

  const config = resolveStatusConfig(status, sleepType);

  return (
    <div className="flex flex-col items-center justify-center my-2">
      <div
        className={`relative w-52 h-52 rounded-full border-2 bg-gradient-to-b from-[#151B28] to-[#0E1420] flex flex-col items-center justify-center shadow-2xl p-4 ${config.colorClass}`}
      >
        <div className="absolute inset-2 rounded-full border border-current opacity-20 animate-ping pointer-events-none" />
        <span
          className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${config.accent}`}
        >
          {status === "falling_asleep" ? (
            <Sparkles className="w-3.5 h-3.5" />
          ) : (
            <Moon className="w-3.5 h-3.5" />
          )}
          {t(config.titleKey)}
        </span>
        <span className="text-3xl font-extrabold text-ink tabular-nums tracking-tight my-1">
          {formatStopwatchTime(elapsedSeconds)}
        </span>
        <span className="text-sm text-slate-400 flex items-center gap-1">
          <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
          {t("timer.sync")}
        </span>
      </div>
      {sleepType === "night" && wakingsCount > 0 && (
        <p className="mt-2 text-sm text-violet-300" role="status">
          {t("timer.wakings", { count: wakingsCount })}
        </p>
      )}
      {wakeSuggestion && (
        <p className="mt-2 text-sm text-amber-300">
          {t("timer.napWakeSuggestion", { time: wakeSuggestion })}
        </p>
      )}
    </div>
  );
}
