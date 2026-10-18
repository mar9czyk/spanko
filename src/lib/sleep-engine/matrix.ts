import type { AgeBracketConfig } from "./types";

/**
 * Domyślna matryca parametrów snu niemowląt i małych dzieci (0-36 miesięcy).
 *
 * @description
 * Tabela 12 przedziałów wiekowych definiująca liczbę drzemek, minimalne i maksymalne
 * okna czuwania, maksymalne czasy trwania drzemek, normę dobową oraz stałą Tau.
 */
export const DEFAULT_SLEEP_MATRIX: readonly AgeBracketConfig[] = [
  {
    minAgeDays: 0,
    maxAgeDays: 28,
    targetNapsCount: 5,
    wwMinMorning: 35,
    wwMaxEvening: 60,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 450,
    medianTotalSleepMin: 960,
    homeostaticTauRiseMin: 55,
  },
  {
    minAgeDays: 29,
    maxAgeDays: 60,
    targetNapsCount: 4,
    wwMinMorning: 45,
    wwMaxEvening: 75,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 390,
    medianTotalSleepMin: 930,
    homeostaticTauRiseMin: 70,
  },
  {
    minAgeDays: 61,
    maxAgeDays: 90,
    targetNapsCount: 4,
    wwMinMorning: 60,
    wwMaxEvening: 95,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 330,
    medianTotalSleepMin: 900,
    homeostaticTauRiseMin: 85,
  },
  {
    minAgeDays: 91,
    maxAgeDays: 120,
    targetNapsCount: 3,
    wwMinMorning: 75,
    wwMaxEvening: 120,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 270,
    medianTotalSleepMin: 870,
    homeostaticTauRiseMin: 105,
  },
  {
    minAgeDays: 121,
    maxAgeDays: 150,
    targetNapsCount: 3,
    wwMinMorning: 95,
    wwMaxEvening: 140,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 240,
    medianTotalSleepMin: 855,
    homeostaticTauRiseMin: 125,
  },
  {
    minAgeDays: 151,
    maxAgeDays: 180,
    targetNapsCount: 3,
    wwMinMorning: 110,
    wwMaxEvening: 155,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 210,
    medianTotalSleepMin: 840,
    homeostaticTauRiseMin: 140,
  },
  {
    minAgeDays: 181,
    maxAgeDays: 240,
    targetNapsCount: 2,
    wwMinMorning: 135,
    wwMaxEvening: 195,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 195,
    medianTotalSleepMin: 825,
    homeostaticTauRiseMin: 175,
  },
  {
    minAgeDays: 241,
    maxAgeDays: 300,
    targetNapsCount: 2,
    wwMinMorning: 155,
    wwMaxEvening: 215,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 180,
    medianTotalSleepMin: 810,
    homeostaticTauRiseMin: 195,
  },
  {
    minAgeDays: 301,
    maxAgeDays: 390,
    targetNapsCount: 2,
    wwMinMorning: 180,
    wwMaxEvening: 240,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 165,
    medianTotalSleepMin: 795,
    homeostaticTauRiseMin: 220,
  },
  {
    minAgeDays: 391,
    maxAgeDays: 540,
    targetNapsCount: 1,
    wwMinMorning: 270,
    wwMaxEvening: 330,
    maxSingleNapMin: 150,
    maxDaytimeSleepMin: 150,
    medianTotalSleepMin: 780,
    homeostaticTauRiseMin: 300,
  },
  {
    minAgeDays: 541,
    maxAgeDays: 730,
    targetNapsCount: 1,
    wwMinMorning: 300,
    wwMaxEvening: 360,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 120,
    medianTotalSleepMin: 765,
    homeostaticTauRiseMin: 340,
  },
  {
    minAgeDays: 731,
    maxAgeDays: 1095,
    targetNapsCount: 1,
    wwMinMorning: 330,
    wwMaxEvening: 390,
    maxSingleNapMin: 90,
    maxDaytimeSleepMin: 90,
    medianTotalSleepMin: 735,
    homeostaticTauRiseMin: 380,
  },
];

/**
 * Znajduje przedział wiekowy dla zadanego wieku efektywnego w dniach.
 *
 * @param {number} effectiveAgeDays - Wiek efektywny dziecka w dniach
 * @param {readonly AgeBracketConfig[]} [matrix=DEFAULT_SLEEP_MATRIX] - Opcjonalna nadpisana matryca wiekowa
 * @returns {AgeBracketConfig} Konfiguracja przedziału wiekowego
 */
export function getAgeBracket(
  effectiveAgeDays: number,
  matrix: readonly AgeBracketConfig[] = DEFAULT_SLEEP_MATRIX,
): AgeBracketConfig {
  const boundedAge = Math.max(0, effectiveAgeDays);
  const matchedBracket = matrix.find(
    (bracket) => boundedAge >= bracket.minAgeDays && boundedAge <= bracket.maxAgeDays,
  );

  if (matchedBracket) {
    return matchedBracket;
  }

  const lastBracket = matrix[matrix.length - 1];
  if (!lastBracket) {
    throw new Error("Pusta matryca konfiguracji snu.");
  }
  return lastBracket;
}
