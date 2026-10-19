import {
  calculateCircadianParameters,
  getAgeBracket,
  predictNextSleepSlot,
} from "@/lib/sleep-engine";
import type { AgeBracketConfig } from "@/lib/sleep-engine/types";

export interface PreviewProfile {
  readonly label: string;
  readonly ageDays: number;
}

export const PREVIEW_PROFILES: readonly PreviewProfile[] = [
  { label: "10 tyg.", ageDays: 70 },
  { label: "6 mies.", ageDays: 180 },
  { label: "14 mies.", ageDays: 425 },
];

const PREVIEW_WAKE_UP_ISO = "2026-01-01T07:00:00.000Z";
const PREVIEW_WAKE_MINUTES = 420;
const MS_PER_MINUTE = 60_000;

export interface PreviewWindow {
  /** Docelowe okno czuwania w minutach */
  readonly wakeWindowMin: number;
  /** SweetSpot w minutach od porannej pobudki */
  readonly sweetSpotAfterWakeMin: number;
}

export interface MatrixPreviewRow {
  readonly label: string;
  readonly ageDays: number;
  readonly firstWindow: { readonly before: PreviewWindow; readonly after: PreviewWindow };
  readonly bedtimeWindow: { readonly before: PreviewWindow; readonly after: PreviewWindow };
  /** Zmiana SweetSpotu przed 1. drzemką (minuty; + = później) */
  readonly firstWindowDeltaMin: number;
  /** Zmiana SweetSpotu przed snem nocnym (minuty; + = później) */
  readonly bedtimeDeltaMin: number;
}

/**
 * Liczy okno czuwania i SweetSpot dla profilu dziecka według podanej matrycy.
 *
 * @param {readonly AgeBracketConfig[]} matrix - Matryca wiekowa
 * @param {number} ageDays - Wiek efektywny w dniach
 * @param {"first" | "bedtime"} slot - Okno przed 1. drzemką albo przed snem nocnym
 * @returns {PreviewWindow} Okno i SweetSpot
 */
function previewWindow(
  matrix: readonly AgeBracketConfig[],
  ageDays: number,
  slot: "first" | "bedtime",
): PreviewWindow {
  const bracket = getAgeBracket(ageDays, matrix);
  const circadian = calculateCircadianParameters({
    morningWakeTimesLast5DaysMinutesFromMidnight: [PREVIEW_WAKE_MINUTES],
    bracket,
  });
  const prediction = predictNextSleepSlot({
    lastWakeUpIso: PREVIEW_WAKE_UP_ISO,
    previousNapDurationMin: null,
    napIndexToday: slot === "first" ? 0 : bracket.targetNapsCount,
    effectiveAgeDays: ageDays,
    bracket,
    chronicSleepDebtMin: 0,
    dayMode: "home",
    insightWwOffsetMin: 0,
    biologicalBedtimeMinFromMidnight: circadian.biologicalBedtimeMinFromMidnight,
  });
  return {
    wakeWindowMin: prediction.targetWakeWindowMin,
    sweetSpotAfterWakeMin: Math.round(
      (new Date(prediction.sweetSpotIso).getTime() - new Date(PREVIEW_WAKE_UP_ISO).getTime()) /
        MS_PER_MINUTE,
    ),
  };
}

/**
 * Porównuje skutki dwóch matryc dla 3 przykładowych profili dziecka (SweetSpot przed 1. drzemką
 * i przed snem nocnym). Czysta funkcja — używa wyłącznie silnika deterministycznego.
 *
 * @param {readonly AgeBracketConfig[]} before - Matryca obecna
 * @param {readonly AgeBracketConfig[]} after - Matryca proponowana
 * @param {readonly PreviewProfile[]} [profiles] - Profile do porównania
 * @returns {MatrixPreviewRow[]} Wiersze porównania
 */
export function compareMatrices(
  before: readonly AgeBracketConfig[],
  after: readonly AgeBracketConfig[],
  profiles: readonly PreviewProfile[] = PREVIEW_PROFILES,
): MatrixPreviewRow[] {
  return profiles.map((profile) => {
    const firstWindow = {
      before: previewWindow(before, profile.ageDays, "first"),
      after: previewWindow(after, profile.ageDays, "first"),
    };
    const bedtimeWindow = {
      before: previewWindow(before, profile.ageDays, "bedtime"),
      after: previewWindow(after, profile.ageDays, "bedtime"),
    };
    return {
      label: profile.label,
      ageDays: profile.ageDays,
      firstWindow,
      bedtimeWindow,
      firstWindowDeltaMin:
        firstWindow.after.sweetSpotAfterWakeMin - firstWindow.before.sweetSpotAfterWakeMin,
      bedtimeDeltaMin:
        bedtimeWindow.after.sweetSpotAfterWakeMin - bedtimeWindow.before.sweetSpotAfterWakeMin,
    };
  });
}
