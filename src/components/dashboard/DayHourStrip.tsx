import { Droplets, Milk } from "lucide-react";
import type { ReactNode } from "react";
import { buildDayHourStrip, type DayStripHour, type DayStripInput } from "./dayHourStrip";

const MIN_BAR_PX = 6;
const MAX_EXTRA_BAR_PX = 34;
const LABEL_EVERY_HOURS = 3;

/**
 * Dobiera kolor kreseczki: drzemka bursztynowa, noc fioletowa, czuwanie szare.
 *
 * @param {DayStripHour} hour - Godzina paska
 * @returns {string} Klasy Tailwind
 */
function barColor(hour: DayStripHour): string {
  if (hour.sleepFraction > 0) {
    return hour.sleepType === "night" ? "bg-violet-400" : "bg-amber-400";
  }
  if (hour.state === "future") return "bg-slate-800";
  return hour.state === "current" ? "bg-slate-400" : "bg-slate-600";
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
 * Pasek doby: 24 kreseczki, po jednej na godzinę od porannej pobudki. Wysokość kreseczki
 * to część godziny przespana, a ikonki nad nią to karmienia i zmiany pieluchy.
 *
 * @param {object} props - Dane paska i opis dla czytników ekranu
 * @returns {ReactNode} Pasek godzin
 */
export function DayHourStrip({
  input,
  ariaLabel,
}: {
  input: DayStripInput;
  ariaLabel: string;
}): ReactNode {
  const hours = buildDayHourStrip(input);
  return (
    <div role="img" aria-label={ariaLabel} className="w-full">
      <div className="flex items-end gap-[3px] h-16">
        {hours.map((hour) => (
          <div
            key={hour.startMs}
            className={`flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-0.5 ${hour.state === "future" ? "opacity-50" : ""}`}
          >
            {hour.feedings > 0 && <Milk className="w-3 h-3 shrink-0 text-emerald-400" />}
            {hour.diapers > 0 && <Droplets className="w-3 h-3 shrink-0 text-sky-400" />}
            <div
              className={`w-full rounded-sm ${barColor(hour)} ${hour.state === "current" ? "ring-1 ring-amber-200/70" : ""}`}
              style={{ height: MIN_BAR_PX + MAX_EXTRA_BAR_PX * hour.sleepFraction }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] pt-1" aria-hidden="true">
        {hours.map((hour, index) => (
          <span
            key={hour.startMs}
            className="flex-1 min-w-0 overflow-visible whitespace-nowrap text-[9px] font-mono text-slate-500"
          >
            {index % LABEL_EVERY_HOURS === 0 ? formatHour(hour.startMs) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
