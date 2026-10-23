"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { InterventionLevel, SleepMood } from "@/lib/types/database";
import { SleepHowPicker } from "./SleepHowPicker";

const AUTO_DISMISS_MS = 15_000;

interface FellAsleepCardProps {
  readonly onSave: (
    mood: SleepMood | undefined,
    interventions: readonly InterventionLevel[],
  ) => void;
  readonly onDismiss: () => void;
}

/**
 * Opcjonalna karta po „Zasnął”: jak dziecko zasnęło i co pomogło. Każde dotknięcie zapisuje
 * się od razu na śnie; karta znika sama po chwili bez dotyku.
 *
 * @param {FellAsleepCardProps} props - Zapis wyboru i zamknięcie
 * @returns {ReactNode} Karta
 */
export function FellAsleepCard({ onSave, onDismiss }: FellAsleepCardProps): ReactNode {
  const { t } = useI18n();
  const [mood, setMood] = useState<SleepMood | undefined>(undefined);
  const [interventions, setInterventions] = useState<readonly InterventionLevel[]>([]);

  // Każda zmiana wyboru odświeża odliczanie do samoczynnego zamknięcia
  // biome-ignore lint/correctness/useExhaustiveDependencies: odliczanie ma ruszać od nowa przy zmianie wyboru
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [mood, interventions, onDismiss]);

  const hasChoice = mood !== undefined || interventions.length > 0;
  return (
    <section
      aria-label={t("fellAsleep.title")}
      className="pointer-events-auto flex flex-col gap-3 rounded-2xl border border-violet-500/40 bg-[#151B28] p-3 shadow-xl"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{t("fellAsleep.title")}</h2>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-12 px-2 text-sm font-semibold text-amber-300"
        >
          {hasChoice ? t("fellAsleep.done") : t("fellAsleep.skip")}
        </button>
      </div>
      <SleepHowPicker
        mood={mood}
        interventions={interventions}
        onChange={(nextMood, nextInterventions) => {
          setMood(nextMood);
          setInterventions(nextInterventions);
          onSave(nextMood, nextInterventions);
        }}
      />
    </section>
  );
}
