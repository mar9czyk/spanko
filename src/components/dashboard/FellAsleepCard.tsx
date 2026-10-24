"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/messages";
import { SLEEP_PLACES, type SleepPlace } from "@/lib/sleep-environment";
import type { InterventionLevel, SleepMood } from "@/lib/types/database";
import { SleepHowPicker } from "./SleepHowPicker";

const AUTO_DISMISS_MS = 15_000;

interface FellAsleepCardProps {
  readonly onSave: (
    mood: SleepMood | undefined,
    interventions: readonly InterventionLevel[],
  ) => void;
  readonly onDismiss: () => void;
  /** Domyślne miejsce snu z profilu dziecka; bez niego chip „dziś gdzie indziej” się nie pokazuje. */
  readonly defaultPlace?: SleepPlace;
  readonly onSavePlace?: (place: SleepPlace | "") => void;
}

/**
 * Opcjonalna karta po „Zasnął”: jak dziecko zasnęło i co pomogło. Każde dotknięcie zapisuje
 * się od razu na śnie; karta znika sama po chwili bez dotyku.
 *
 * @param {FellAsleepCardProps} props - Zapis wyboru i zamknięcie
 * @returns {ReactNode} Karta
 */
export function FellAsleepCard({
  onSave,
  onDismiss,
  defaultPlace,
  onSavePlace,
}: FellAsleepCardProps): ReactNode {
  const { t } = useI18n();
  const [mood, setMood] = useState<SleepMood | undefined>(undefined);
  const [interventions, setInterventions] = useState<readonly InterventionLevel[]>([]);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [place, setPlace] = useState<SleepPlace | undefined>(undefined);

  // Każda zmiana wyboru odświeża odliczanie do samoczynnego zamknięcia
  // biome-ignore lint/correctness/useExhaustiveDependencies: odliczanie ma ruszać od nowa przy zmianie wyboru
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [mood, interventions, place, placeOpen, onDismiss]);

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
      {defaultPlace && onSavePlace && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            aria-expanded={placeOpen}
            onClick={() => setPlaceOpen((open) => !open)}
            className="min-h-10 w-fit rounded-lg border border-[#263348] bg-[#1E2738] px-3 text-sm text-slate-300"
          >
            {t("env.elsewhere")}
          </button>
          {placeOpen && (
            <div className="flex flex-wrap gap-1.5" title={t("env.elsewhereLabel")}>
              {SLEEP_PLACES.filter((option) => option !== defaultPlace).map((option) => {
                const selected = place === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setPlace(selected ? undefined : option);
                      onSavePlace(selected ? "" : option);
                    }}
                    className={`min-h-10 rounded-lg border px-3 text-sm ${selected ? "border-amber-400/60 bg-amber-950/40 text-amber-200" : "border-[#263348] bg-[#1E2738] text-slate-300"}`}
                  >
                    {t(`env.place.${option}` as MessageKey)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
