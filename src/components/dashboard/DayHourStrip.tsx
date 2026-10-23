import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { buildDayStrip, type DayStripInput, type DayStripSlot } from "./dayHourStrip";

const AWAKE_TICK_PX = 3;
const MIN_SLEEP_TICK_PX = 4;
const MAX_EXTRA_SLEEP_TICK_PX = 24;
const MS_PER_HOUR = 3_600_000;
const LABEL_HOURS = [0, 3, 6, 9, 12, 15, 18, 21] as const;

/**
 * Dobiera kolor kreski: drzemka bursztynowa, noc fioletowa, czuwanie szare.
 *
 * @param {DayStripSlot} slot - Odcinek paska
 * @returns {string} Klasy Tailwind
 */
function tickColor(slot: DayStripSlot): string {
  if (slot.sleepFraction > 0) {
    return slot.sleepType === "night" ? "bg-violet-400" : "bg-amber-400";
  }
  if (slot.state === "future") return "bg-slate-800";
  return slot.state === "current" ? "bg-slate-300" : "bg-slate-600";
}

/**
 * Formatuje pełną godzinę w lokalnym zapisie urządzenia (np. „6” albo „6 AM”).
 *
 * @param {number} ms - Początek godziny
 * @returns {string} Etykieta godziny
 */
function formatHour(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric" });
}

/**
 * Procentowe położenie na pasku dla stylu `left`.
 *
 * @param {number} offset - Położenie 0..1
 * @returns {string} Wartość CSS
 */
function toPercent(offset: number): string {
  return `${(offset * 100).toFixed(3)}%`;
}

/**
 * Pasek doby w układzie „lustra”: 96 cienkich kresek po 15 minut od porannej pobudki.
 * Sen rośnie w górę od linii (drzemka bursztynowa, noc fioletowa), a pod linią schodzą
 * karmienia (zielona kreska) i zmiany pieluchy (niebieski romb) w dokładnym momencie.
 *
 * @param {object} props - Dane paska i opis dla czytników ekranu
 * @returns {ReactNode} Pasek doby
 */
export function DayHourStrip({
  input,
  ariaLabel,
}: {
  input: DayStripInput;
  ariaLabel: string;
}): ReactNode {
  const { t } = useI18n();
  const strip = buildDayStrip(input);
  return (
    <div role="img" aria-label={ariaLabel} className="w-full">
      <div className="relative h-12">
        <div className="absolute inset-x-0 top-0 h-7 flex items-end">
          {strip.slots.map((slot) => (
            <div key={slot.startMs} className="flex-1 flex justify-center">
              <div
                className={`w-[2px] rounded-full ${tickColor(slot)}`}
                style={{
                  height:
                    slot.sleepFraction > 0
                      ? MIN_SLEEP_TICK_PX + MAX_EXTRA_SLEEP_TICK_PX * slot.sleepFraction
                      : AWAKE_TICK_PX,
                }}
              />
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 top-7 h-px bg-slate-700/70" />
        {strip.marks.map((mark) =>
          mark.kind === "feeding" ? (
            <div
              key={`f-${mark.offset}`}
              className="absolute top-[30px] h-3 w-[2px] -translate-x-1/2 rounded-full bg-emerald-400"
              style={{ left: toPercent(mark.offset) }}
            />
          ) : mark.kind === "waking" ? (
            <div
              key={`w-${mark.offset}`}
              className="absolute top-[30px] h-2 w-2 -translate-x-1/2 rounded-full bg-violet-300 ring-2 ring-violet-950"
              style={{ left: toPercent(mark.offset) }}
            />
          ) : (
            <div
              key={`d-${mark.offset}`}
              className="absolute top-[32px] h-1.5 w-1.5 -translate-x-1/2 rotate-45 rounded-[1px] bg-diaper"
              style={{ left: toPercent(mark.offset) }}
            />
          ),
        )}
        {strip.nowOffset !== null && (
          <div
            className="absolute -top-1 bottom-0 border-l border-dashed border-slate-300/60"
            style={{ left: toPercent(strip.nowOffset) }}
          />
        )}
      </div>
      <div className="relative h-4" aria-hidden="true">
        {LABEL_HOURS.map((hour) => (
          <span
            key={hour}
            className="absolute whitespace-nowrap text-xs tabular-nums text-slate-400"
            style={{ left: toPercent(hour / 24) }}
          >
            {formatHour(strip.startMs + hour * MS_PER_HOUR)}
          </span>
        ))}
      </div>
      <div className="flex justify-end gap-3 pt-1.5 text-xs text-slate-400" aria-hidden="true">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-[2px] rounded-full bg-emerald-400" />
          {t("timeline.legendFeeding")}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rotate-45 rounded-[1px] bg-diaper" />
          {t("timeline.legendDiaper")}
        </span>
        {input.wakingIsos?.length ? (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-violet-300" />
            {t("timeline.legendWaking")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
