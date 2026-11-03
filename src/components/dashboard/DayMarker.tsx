import { AlarmClock, Droplet, Milk, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";

export type DayMarkerKind = "wake" | "nap" | "night" | "feeding" | "wet" | "dirty";

const SHAPES: Readonly<Record<DayMarkerKind, string>> = {
  wake: "h-2 w-2 rounded-full bg-amber-400",
  nap: "h-2 w-2 rounded-[2px] bg-amber-400",
  night: "h-2 w-2 rounded-full bg-violet-300",
  feeding: "h-3 w-[2px] rounded-full bg-emerald-400",
  wet: "h-2 w-2 rounded-full bg-diaper",
  dirty: "h-1.5 w-1.5 rotate-45 rounded-[1px] bg-poop",
};

/**
 * Znak zdarzenia o tym samym kształcie i kolorze co na pasku doby (znacznik = legenda).
 *
 * @param {object} props - Rodzaj znaku
 * @returns {ReactNode} Mały znak
 */
export function DayMarker({ kind }: { kind: DayMarkerKind }): ReactNode {
  return <span aria-hidden="true" className={`inline-block shrink-0 ${SHAPES[kind]}`} />;
}

export type SummaryIconKind = "wake" | "nap" | "feeding" | "wet" | "dirty" | "night";

/**
 * Własna ikona kupki (lucide nie ma jej w zestawie): kopczyk z oczkami, w kolorze `poop`.
 *
 * @returns {ReactNode} Ikona SVG
 */
function PoopIcon(): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-poop"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3c1 1.5 0 2.5-1 3.5h1c2.5 0 4 1.5 4 3.5h.5c2.5 0 4.5 1.8 4.5 4.5S19 20 16.5 20h-9C5 20 3 18.2 3 15.5S5 11 7.5 11H8c0-1.8 1.2-3.2 3-3.5" />
      <path d="M9 15.5h.01M15 15.5h.01" />
    </svg>
  );
}

/**
 * Ikona podsumowania doby: słonko (pobudka), księżyc (czas drzemek), butelka (karmienia),
 * kropla (siku), kupka i budzik (pobudki nocne).
 *
 * @param {object} props - Rodzaj ikony
 * @returns {ReactNode} Ikona
 */
export function SummaryIcon({ kind }: { kind: SummaryIconKind }): ReactNode {
  const cls = "h-4 w-4 shrink-0";
  switch (kind) {
    case "wake":
      return <Sun aria-hidden="true" className={`${cls} text-amber-400`} />;
    case "nap":
      return <Moon aria-hidden="true" className={`${cls} text-amber-400`} />;
    case "feeding":
      return <Milk aria-hidden="true" className={`${cls} text-emerald-400`} />;
    case "wet":
      return <Droplet aria-hidden="true" className={`${cls} text-diaper`} />;
    case "dirty":
      return <PoopIcon />;
    case "night":
      return <AlarmClock aria-hidden="true" className={`${cls} text-violet-300`} />;
  }
}
