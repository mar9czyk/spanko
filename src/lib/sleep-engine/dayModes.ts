/**
 * Tryby dnia „Choroba” i „W drodze”: które podpowiedzi pokazać, kiedy zapytać o budzenie
 * i o ile wcześniej położyć dziecko po dniu z krótkimi drzemkami w drodze.
 *
 * @description
 * Czyste funkcje bez tekstów — treści PL/EN są w `src/lib/day-mode-guidance.ts`.
 * Źródła i poziom dowodów: raport „Sen w chorobie i w drodze” (badania/reports).
 * Progi czerwonych flag (NICE NG143, NHS, AAP) są wytyczną; reszta liczb to heurystyka Spanko.
 */

import { hasDayTag } from "./dayTags";
import type { DailySleepSummary, DayMode } from "./types";

/** Tagi doby, które same włączają logikę choroby (ząbkowanie nie, Azevedo 2015, Macknin 2000). */
export const ILLNESS_DAY_TAGS: readonly string[] = [
  "fever",
  "ear_infection",
  "vaccination",
  "runny_nose",
  "gastro",
];

/** Poniżej 3 mies. każda gorączka ≥38°C to stan czerwony (NICE NG143). */
export const YOUNG_INFANT_MAX_AGE_DAYS = 91;
/** 3–6 mies.: próg pilnej porady ≥39°C (NICE NG143); poniżej 6 mies. ibuprofen tylko po poradzie (AAP 2011). */
export const INFANT_UNDER_6M_MAX_AGE_DAYS = 182;

// Pytanie o budzenie przy długim śnie w chorobie: heurystyka (wytyczne mają kryterium jakościowe)
export const WAKE_CHECK_MIN_NAP_MINUTES = 180;
export const WAKE_CHECK_USUAL_NAP_FACTOR = 1.5;

// Wcześniejszy sen po dniu w drodze: częsta praktyka doradców, bez badań (heurystyka)
export const NAP_DEFICIT_THRESHOLD_MINUTES = 45;
export const MAX_EARLY_BEDTIME_MINUTES = 60;
export const EARLY_BEDTIME_STEP_MINUTES = 15;
export const USUAL_DAYTIME_SAMPLE_DAYS = 7;

export type GuidanceTopic =
  | "illness_general"
  | "fever"
  | "ear"
  | "cold"
  | "gastro"
  | "vaccination"
  | "medicines"
  | "unsafe"
  | "back_to_plan"
  | "on_the_go_naps"
  | "car_seat"
  | "stroller"
  | "carrier"
  | "new_place";

export interface DayModeGuidance {
  readonly mode: "illness" | "on_the_go";
  /** Tematy w kolejności wyświetlania. */
  readonly topics: readonly GuidanceTopic[];
  /** Dziecko poniżej 3 mies.: gorączka ≥38°C to od razu SOR lub NiŚOZ. */
  readonly isYoungInfant: boolean;
  /** Poniżej 6 mies.: o ibuprofen pytamy lekarza lub farmaceutę. */
  readonly isUnder6Months: boolean;
  /** Pokazać czerwone flagi (tylko w chorobie). */
  readonly showRedFlags: boolean;
}

/**
 * Sprawdza, czy doba jest dniem choroby: tryb „Choroba” albo tag choroby.
 *
 * @param {DayMode | undefined} dayMode - Tryb dnia dziecka
 * @param {readonly string[]} tags - Tagi bieżącej doby
 * @returns {boolean} Czy stosować logikę choroby
 */
export function isIllnessDay(dayMode: DayMode | undefined, tags: readonly string[]): boolean {
  return dayMode === "illness_regression" || ILLNESS_DAY_TAGS.some((key) => hasDayTag(tags, key));
}

/**
 * Dobiera tematy podpowiedzi do trybu dnia, tagów i wieku dziecka.
 *
 * @param {object} params - Tryb dnia, tagi doby i wiek efektywny
 * @returns {DayModeGuidance | null} Podpowiedzi albo null w zwykły dzień w domu
 */
export function resolveDayModeGuidance(params: {
  readonly dayMode: DayMode;
  readonly tags: readonly string[];
  readonly effectiveAgeDays: number;
}): DayModeGuidance | null {
  const { dayMode, tags, effectiveAgeDays } = params;
  const age = {
    isYoungInfant: effectiveAgeDays < YOUNG_INFANT_MAX_AGE_DAYS,
    isUnder6Months: effectiveAgeDays < INFANT_UNDER_6M_MAX_AGE_DAYS,
  };

  if (isIllnessDay(dayMode, tags)) {
    const specific: GuidanceTopic[] = [];
    if (hasDayTag(tags, "fever")) specific.push("fever");
    if (hasDayTag(tags, "ear_infection")) specific.push("ear");
    if (hasDayTag(tags, "runny_nose")) specific.push("cold");
    if (hasDayTag(tags, "gastro")) specific.push("gastro");
    if (hasDayTag(tags, "vaccination")) specific.push("vaccination");
    return {
      mode: "illness",
      topics: ["illness_general", ...specific, "medicines", "unsafe", "back_to_plan"],
      ...age,
      showRedFlags: true,
    };
  }

  if (dayMode === "on_the_go") {
    return {
      mode: "on_the_go",
      topics: ["on_the_go_naps", "car_seat", "stroller", "carrier", "new_place"],
      ...age,
      showRedFlags: false,
    };
  }
  return null;
}

/**
 * Czy w chorobie zapytać rodzica, czy dziecko łatwo się wybudza (NICE NG143: senność to flaga).
 *
 * @description
 * Pytamy, gdy drzemka (zakończona lub trwająca) jest dłuższa niż 3 h albo niż 1,5× zwykła drzemka.
 * Wytyczne nie podają progu w godzinach — liczby to heurystyka, samo pytanie jest z wytycznych.
 *
 * @param {object} params - Czy to dzień choroby, długość drzemki i zwykła najdłuższa drzemka
 * @returns {boolean} Czy pokazać pytanie o budzenie
 */
export function needsWakeCheck(params: {
  readonly isIllness: boolean;
  readonly napDurationMin: number;
  readonly usualLongestNapMin: number | null;
}): boolean {
  if (!params.isIllness) return false;
  const usualLimit =
    params.usualLongestNapMin && params.usualLongestNapMin > 0
      ? params.usualLongestNapMin * WAKE_CHECK_USUAL_NAP_FACTOR
      : Number.POSITIVE_INFINITY;
  return params.napDurationMin > Math.min(WAKE_CHECK_MIN_NAP_MINUTES, usualLimit);
}

/**
 * Mediana z listy (null dla pustej).
 *
 * @param {readonly number[]} values - Wartości
 * @returns {number | null} Mediana zaokrąglona do minut
 */
function medianOrNull(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0
      ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
      : (sorted[middle] ?? 0);
  return Math.round(value);
}

/**
 * Zwykły sen dzienny i najdłuższa drzemka dziecka z ostatnich pełnych dób z drzemkami.
 *
 * @param {readonly DailySleepSummary[]} completedDays - Pełne doby, najnowsza pierwsza
 * @returns {{ daytimeMin: number | null; longestNapMin: number | null }} Mediany albo null
 */
export function resolveUsualNapStats(completedDays: readonly DailySleepSummary[]): {
  readonly daytimeMin: number | null;
  readonly longestNapMin: number | null;
} {
  const days = completedDays
    .filter((d) => !d.isIllOrIgnored && (d.napCount ?? 0) > 0)
    .slice(0, USUAL_DAYTIME_SAMPLE_DAYS);
  return {
    daytimeMin: medianOrNull(days.map((d) => d.daytimeSleepMin ?? 0)),
    longestNapMin: medianOrNull(days.map((d) => d.longestNapMin ?? 0)),
  };
}

/**
 * O ile minut wcześniej położyć dziecko na noc po dniu w drodze z niedoborem drzemek.
 *
 * @description
 * Niedobór > 45 min względem zwykłego snu dziennego → połowa niedoboru, maks. 60 min,
 * zaokrąglona w dół do 15 min. Częsta praktyka, ograniczone dowody (heurystyka).
 *
 * @param {number} todayDaytimeSleepMin - Sen dzienny bieżącej doby
 * @param {number | null} usualDaytimeSleepMin - Zwykły sen dzienny dziecka
 * @returns {number} Minuty przyspieszenia (0 = bez zmian)
 */
export function resolveOnTheGoBedtimeAdvance(
  todayDaytimeSleepMin: number,
  usualDaytimeSleepMin: number | null,
): number {
  if (usualDaytimeSleepMin === null) return 0;
  const deficit = usualDaytimeSleepMin - Math.max(0, todayDaytimeSleepMin);
  if (deficit <= NAP_DEFICIT_THRESHOLD_MINUTES) return 0;
  const advance = Math.min(MAX_EARLY_BEDTIME_MINUTES, deficit / 2);
  return Math.floor(advance / EARLY_BEDTIME_STEP_MINUTES) * EARLY_BEDTIME_STEP_MINUTES;
}
