"use client";

import { Check } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/messages";
import { loadActiveChild } from "@/lib/client-data";
import { pb } from "@/lib/pocketbase";
import {
  BLACKOUT_LEVELS,
  hasSleepEnvironment,
  NIGHT_LIGHTS,
  parseSleepEnvironment,
  ROOM_TEMPS,
  SCREEN_LEVELS,
  SLEEP_PLACES,
  SLEEP_ROOMS,
  type SleepEnvironment,
  WHITE_NOISE_LEVELS,
} from "@/lib/sleep-environment";
import type { ChildRecord } from "@/lib/types/database";

type SaveStatus = "idle" | "saved" | "error";

interface ChipGroupProps<T extends string> {
  readonly label: string;
  readonly options: readonly T[];
  readonly labelOf: (option: T) => string;
  readonly value: T | undefined;
  readonly onSelect: (option: T | undefined) => void;
}

function ChipGroup<T extends string>({
  label,
  options,
  labelOf,
  value,
  onSelect,
}: ChipGroupProps<T>): ReactNode {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(selected ? undefined : option)}
              className={`min-h-10 rounded-lg border px-3 text-sm ${selected ? "border-amber-400/60 bg-amber-950/40 text-amber-200" : "border-[#263348] bg-[#1E2738] text-slate-300"}`}
            >
              {labelOf(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Karta „Gdzie i jak śpi” w ustawieniach: profil środowiska snu aktywnego dziecka, same kliknięcia.
 * Każde dotknięcie zapisuje się od razu; ponowne dotknięcie wybranej opcji ją czyści.
 *
 * @returns {ReactNode} Zawartość karty (opakowanie w SettingsCard robi strona)
 */
export function SleepEnvironmentSection(): ReactNode {
  const { t } = useI18n();
  const [child, setChild] = useState<ChildRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [env, setEnv] = useState<SleepEnvironment>({});
  const [status, setStatus] = useState<SaveStatus>("idle");
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    loadActiveChild()
      .then((loadedChild) => {
        setChild(loadedChild);
        setEnv(parseSleepEnvironment(loadedChild?.sleep_environment));
      })
      .catch(() => setChild(null))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return <p className="text-sm text-slate-400">{t("env.loading")}</p>;
  if (!child) return <p className="text-sm text-slate-400">{t("env.noChild")}</p>;

  const update = (patch: Partial<Record<keyof SleepEnvironment, unknown>>) => {
    const next = parseSleepEnvironment({ ...env, ...patch });
    setEnv(next);
    // Zapisy idą po kolei, żeby szybkie dotknięcia nie nadpisały się nawzajem
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        await pb.collection("children").update(child.id, { sleep_environment: next });
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  };

  const yesNo = (value: boolean | undefined) =>
    value === undefined ? undefined : value ? "yes" : "no";

  return (
    <div className="flex flex-col gap-4">
      <ChipGroup
        label={t("env.nightPlace")}
        options={SLEEP_PLACES}
        labelOf={(o) => t(`env.place.${o}` as MessageKey)}
        value={env.nightPlace}
        onSelect={(v) => update({ nightPlace: v })}
      />
      <ChipGroup
        label={t("env.napPlace")}
        options={SLEEP_PLACES}
        labelOf={(o) => t(`env.place.${o}` as MessageKey)}
        value={env.napPlace}
        onSelect={(v) => update({ napPlace: v })}
      />
      <ChipGroup
        label={t("env.room")}
        options={SLEEP_ROOMS}
        labelOf={(o) => t(`env.room.${o}` as MessageKey)}
        value={env.room}
        onSelect={(v) => update({ room: v })}
      />
      <ChipGroup
        label={t("env.blackout")}
        options={BLACKOUT_LEVELS}
        labelOf={(o) => t(`env.blackout.${o}` as MessageKey)}
        value={env.blackout}
        onSelect={(v) => update({ blackout: v })}
      />
      <ChipGroup
        label={t("env.nightLight")}
        options={NIGHT_LIGHTS}
        labelOf={(o) => t(`env.nightLight.${o}` as MessageKey)}
        value={env.nightLight}
        onSelect={(v) => update({ nightLight: v })}
      />
      <ChipGroup
        label={t("env.whiteNoise")}
        options={WHITE_NOISE_LEVELS}
        labelOf={(o) => t(`env.whiteNoise.${o}` as MessageKey)}
        value={env.whiteNoise}
        onSelect={(v) => update({ whiteNoise: v })}
      />
      <ChipGroup
        label={t("env.roomTemp")}
        options={ROOM_TEMPS}
        labelOf={(o) => t(`env.roomTemp.${o}` as MessageKey)}
        value={env.roomTemp}
        onSelect={(v) => update({ roomTemp: v })}
      />
      <ChipGroup
        label={t("env.screens")}
        options={SCREEN_LEVELS}
        labelOf={(o) => t(`env.screens.${o}` as MessageKey)}
        value={env.screensBeforeBed}
        onSelect={(v) => update({ screensBeforeBed: v })}
      />
      <ChipGroup
        label={t("env.smoking")}
        options={["yes", "no"] as const}
        labelOf={(o) => t(o === "yes" ? "env.yes" : "env.no")}
        value={yesNo(env.smokingAtHome)}
        onSelect={(v) => update({ smokingAtHome: v === undefined ? undefined : v === "yes" })}
      />
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={!hasSleepEnvironment(env)}
          onClick={() =>
            update(Object.fromEntries(Object.keys(env).map((key) => [key, undefined])))
          }
          className="min-h-10 text-xs font-semibold text-slate-400 disabled:opacity-40"
        >
          {t("env.clear")}
        </button>
        {status === "saved" && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <Check className="w-3.5 h-3.5" />
            {t("env.saved")}
          </span>
        )}
        {status === "error" && (
          <span role="alert" className="text-xs text-red-300">
            {t("env.saveFailed")}
          </span>
        )}
      </div>
    </div>
  );
}
