import { Battery, Lightbulb, Moon, Target } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { SleepRestednessLevel } from "@/lib/sleep-engine";
import { RESTEDNESS_TEXT_CLASS, restednessSegmentCount } from "./SleepBatteryIndicator";

export type DayDetailTab = "battery" | "goal" | "insight" | "nap";

/** Kolejność zakładek arkusza = kolejność bąbelków wokół pierścienia. */
export const DAY_DETAIL_TAB_ORDER: readonly DayDetailTab[] = ["battery", "goal", "insight", "nap"];

export interface DayBubblesData {
  readonly restedness: SleepRestednessLevel;
  readonly batteryPercent: number;
  /** Postęp zadań celu; null, gdy dziecko nie ma aktywnego celu. */
  readonly goalTasks: { readonly done: number; readonly total: number } | null;
  /** Wniosek czeka na opinię rodzica (kropka); null, gdy nie ma wniosku do pokazania. */
  readonly insightPending: boolean | null;
  readonly lastNapEnd: string;
}

interface DayBubblesProps {
  readonly data: DayBubblesData;
  readonly onOpen: (tab: DayDetailTab) => void;
}

/**
 * Pozycje bąbelków na przekątnych pierścienia (45°, tuż za jego krawędzią); środek kontenera
 * to środek pierścienia (r = 104 px, bąbelek 64 px, odstęp 8 px).
 */
const ORBIT_DIAGONAL_PX = Math.round((104 + 8) * Math.SQRT1_2) + 32;
const ORBIT_SLOT: Record<DayDetailTab, { left: string; top: string }> = {
  battery: {
    left: `calc(50% - ${ORBIT_DIAGONAL_PX}px)`,
    top: `calc(50% - ${ORBIT_DIAGONAL_PX}px)`,
  },
  goal: {
    left: `calc(50% + ${ORBIT_DIAGONAL_PX - 64}px)`,
    top: `calc(50% - ${ORBIT_DIAGONAL_PX}px)`,
  },
  insight: {
    left: `calc(50% - ${ORBIT_DIAGONAL_PX}px)`,
    top: `calc(50% + ${ORBIT_DIAGONAL_PX - 64}px)`,
  },
  nap: {
    left: `calc(50% + ${ORBIT_DIAGONAL_PX - 64}px)`,
    top: `calc(50% + ${ORBIT_DIAGONAL_PX - 64}px)`,
  },
};

interface BubbleProps {
  readonly tab: DayDetailTab;
  readonly label: string;
  readonly icon: ReactNode;
  readonly value: ReactNode;
  readonly valueClass: string;
  readonly hasDot?: boolean;
  readonly dotLabel?: string;
  readonly style: { left: string; top: string };
  readonly onOpen: (tab: DayDetailTab) => void;
}

/**
 * Okrągły bąbelek ze skrótem jednej informacji; stuknięcie otwiera arkusz na jego zakładce.
 *
 * @param {BubbleProps} props - Ikona, wartość i pozycja bąbelka
 * @returns {ReactNode} Przycisk 64 px
 */
function Bubble({
  tab,
  label,
  icon,
  value,
  valueClass,
  hasDot,
  dotLabel,
  style,
  onOpen,
}: BubbleProps): ReactNode {
  return (
    <button
      type="button"
      onClick={() => onOpen(tab)}
      aria-label={hasDot && dotLabel ? `${label}, ${dotLabel}` : label}
      style={style}
      className={`absolute w-16 h-16 rounded-full bg-[#151B28] border border-[#263348] flex flex-col items-center justify-center gap-0.5 shadow-md active:scale-95 transition-transform`}
    >
      {icon}
      <span className={`text-sm font-semibold tabular-nums leading-none ${valueClass}`}>
        {value}
      </span>
      {hasDot && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-[#0B0F17]"
        />
      )}
    </button>
  );
}

/**
 * Cztery bąbelki skrótów dnia (wyspanie, cel, wniosek, ostatnia drzemka). Bąbelek bez danych
 * (brak celu lub wniosku) się nie pojawia.
 *
 * @param {DayBubblesProps} props - Dane skrótów i handler otwarcia arkusza
 * @returns {ReactNode} Bąbelki ułożone w rogach kontenera z pierścieniem
 */
export function DayBubbles({ data, onOpen }: DayBubblesProps): ReactNode {
  const { t } = useI18n();
  return (
    <>
      <Bubble
        tab="battery"
        label={t("bubble.battery")}
        icon={<Battery className="w-5 h-5 text-violet-400" />}
        value={`${restednessSegmentCount(data.batteryPercent)}/5`}
        valueClass={RESTEDNESS_TEXT_CLASS[data.restedness]}
        style={ORBIT_SLOT.battery}
        onOpen={onOpen}
      />
      {data.goalTasks && (
        <Bubble
          tab="goal"
          label={t("bubble.goal")}
          icon={<Target className="w-5 h-5 text-amber-400" />}
          value={data.goalTasks.total > 0 ? `${data.goalTasks.done}/${data.goalTasks.total}` : "–"}
          valueClass="text-ink"
          style={ORBIT_SLOT.goal}
          onOpen={onOpen}
        />
      )}
      {data.insightPending !== null && (
        <Bubble
          tab="insight"
          label={t("bubble.insight")}
          icon={<Lightbulb className="w-5 h-5 text-amber-400" />}
          value={<span className="sr-only">{t("bubble.insight")}</span>}
          valueClass="text-ink"
          hasDot={data.insightPending}
          dotLabel={t("bubble.insightNew")}
          style={ORBIT_SLOT.insight}
          onOpen={onOpen}
        />
      )}
      <Bubble
        tab="nap"
        label={t("bubble.nap")}
        icon={<Moon className="w-5 h-5 text-amber-400" />}
        value={data.lastNapEnd}
        valueClass="text-ink"
        style={ORBIT_SLOT.nap}
        onOpen={onOpen}
      />
    </>
  );
}
