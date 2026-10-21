import type { AgeBracketConfig } from "./types";

/**
 * Domyślna matryca parametrów snu niemowląt i małych dzieci (0-36 miesięcy).
 *
 * @description
 * Tabela 13 przedziałów wiekowych. Poziom dowodu poszczególnych pól:
 * - `medianTotalSleepMin` — w zakresach WHO 2019 i AASM 2016 (Paruthi 2016) oraz blisko średnich
 *   Galland 2012; to kotwica populacyjna, nie cel dla rodzica (±2 SD to ok. 4–6 h).
 * - `minNapsCount`–`targetNapsCount` — zakres drzemek wg Galland 2012, Mindell 2016, Paavonen 2020
 *   i Iglowstein 2003; silnik schodzi do dolnej granicy, gdy dziecko samo tak śpi.
 * - `wwMinMorning` / `wwMaxEvening` — heurystyka: okna czuwania to opinia ekspercka
 *   (Flynn-Evans, Canapari), nie wynik badań; służą jako punkt startowy prognozy.
 * - `maxSingleNapMin` / `maxDaytimeSleepMin` — heurystyka i miękka sugestia, nie twardy limit
 *   (długość drzemek rośnie do 28. mies., Mindell 2016).
 * - `nightWakingsMean` / `nightWakingsUpperNorm` — normy pobudek (Galland 2012: 0–3,4 w 0–2 mies.,
 *   0–2,5 w 1–2 r.ż.; średnie z Paavonen 2020); wartości pośrednie interpolowane. Kontekst dla CAT1.
 * - `homeostaticTauRiseMin` — stała autorska Spanko (heurystyka).
 */
export const DEFAULT_SLEEP_MATRIX: readonly AgeBracketConfig[] = [
  // Noworodek: sen polifazowy, ok. 3,1 drzemki (1,2–5,0) przy 1 mies. (Galland 2012), więc zakres 3–5.
  {
    minAgeDays: 0,
    maxAgeDays: 28,
    targetNapsCount: 5,
    minNapsCount: 3,
    wwMinMorning: 35,
    wwMaxEvening: 60,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 450,
    medianTotalSleepMin: 960,
    homeostaticTauRiseMin: 55,
    nightWakingsMean: 1.7,
    nightWakingsUpperNorm: 3.4,
  },
  {
    minAgeDays: 29,
    maxAgeDays: 60,
    targetNapsCount: 4,
    minNapsCount: 3,
    wwMinMorning: 45,
    wwMaxEvening: 75,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 390,
    medianTotalSleepMin: 930,
    homeostaticTauRiseMin: 70,
    nightWakingsMean: 1.7,
    nightWakingsUpperNorm: 3.4,
  },
  {
    minAgeDays: 61,
    maxAgeDays: 90,
    targetNapsCount: 4,
    minNapsCount: 3,
    wwMinMorning: 60,
    wwMaxEvening: 95,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 330,
    medianTotalSleepMin: 900,
    homeostaticTauRiseMin: 85,
    nightWakingsMean: 2.2,
    nightWakingsUpperNorm: 3.4,
  },
  // Pobudki: ok. 2,2 w 3. mies. (Paavonen 2020).
  {
    minAgeDays: 91,
    maxAgeDays: 120,
    targetNapsCount: 3,
    minNapsCount: 3,
    wwMinMorning: 75,
    wwMaxEvening: 120,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 270,
    medianTotalSleepMin: 870,
    homeostaticTauRiseMin: 105,
    nightWakingsMean: 2.2,
    nightWakingsUpperNorm: 3.4,
  },
  // Od 4. mies. dopuszczone 2 drzemki: konsolidacja do 2 w 3.–7. mies. (Mindell 2016).
  {
    minAgeDays: 121,
    maxAgeDays: 150,
    targetNapsCount: 3,
    minNapsCount: 2,
    wwMinMorning: 95,
    wwMaxEvening: 140,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 240,
    medianTotalSleepMin: 855,
    homeostaticTauRiseMin: 125,
    nightWakingsMean: 2.2,
    nightWakingsUpperNorm: 3.0,
  },
  {
    minAgeDays: 151,
    maxAgeDays: 180,
    targetNapsCount: 3,
    minNapsCount: 2,
    wwMinMorning: 110,
    wwMaxEvening: 155,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 210,
    medianTotalSleepMin: 840,
    homeostaticTauRiseMin: 140,
    nightWakingsMean: 2.3,
    nightWakingsUpperNorm: 3.0,
  },
  // 2 drzemki u ok. 72% w 8. mies., pobudki ok. 2,4 (Paavonen 2020).
  {
    minAgeDays: 181,
    maxAgeDays: 240,
    targetNapsCount: 2,
    minNapsCount: 2,
    wwMinMorning: 135,
    wwMaxEvening: 195,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 195,
    medianTotalSleepMin: 825,
    homeostaticTauRiseMin: 175,
    nightWakingsMean: 2.4,
    nightWakingsUpperNorm: 3.0,
  },
  {
    minAgeDays: 241,
    maxAgeDays: 300,
    targetNapsCount: 2,
    minNapsCount: 2,
    wwMinMorning: 155,
    wwMaxEvening: 215,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 180,
    medianTotalSleepMin: 810,
    homeostaticTauRiseMin: 195,
    nightWakingsMean: 2.4,
    nightWakingsUpperNorm: 3.0,
  },
  {
    minAgeDays: 301,
    maxAgeDays: 390,
    targetNapsCount: 2,
    minNapsCount: 2,
    wwMinMorning: 180,
    wwMaxEvening: 240,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 165,
    medianTotalSleepMin: 795,
    homeostaticTauRiseMin: 220,
    nightWakingsMean: 1.8,
    nightWakingsUpperNorm: 2.5,
  },
  // Przejście 2→1 zwykle w 13–18 mies. (Iglowstein 2003, Oster); do ok. 15 mies. nadal 2 drzemki, 1 dopuszczona.
  {
    minAgeDays: 391,
    maxAgeDays: 450,
    targetNapsCount: 2,
    minNapsCount: 1,
    wwMinMorning: 180,
    wwMaxEvening: 240,
    maxSingleNapMin: 120,
    maxDaytimeSleepMin: 165,
    medianTotalSleepMin: 780,
    homeostaticTauRiseMin: 220,
    nightWakingsMean: 1.4,
    nightWakingsUpperNorm: 2.5,
  },
  // 1 drzemka; pobudki ok. 1,1 w 18. mies. (Paavonen 2020).
  {
    minAgeDays: 451,
    maxAgeDays: 540,
    targetNapsCount: 1,
    minNapsCount: 1,
    wwMinMorning: 270,
    wwMaxEvening: 330,
    maxSingleNapMin: 150,
    maxDaytimeSleepMin: 150,
    medianTotalSleepMin: 780,
    homeostaticTauRiseMin: 300,
    nightWakingsMean: 1.1,
    nightWakingsUpperNorm: 2.5,
  },
  // Drzemki rosną do 28. mies. (Mindell 2016): limit 150 min to miękka sugestia; pobudki ok. 0,9 w 24. mies.
  {
    minAgeDays: 541,
    maxAgeDays: 730,
    targetNapsCount: 1,
    minNapsCount: 1,
    wwMinMorning: 300,
    wwMaxEvening: 360,
    maxSingleNapMin: 150,
    maxDaytimeSleepMin: 150,
    medianTotalSleepMin: 765,
    homeostaticTauRiseMin: 340,
    nightWakingsMean: 0.9,
    nightWakingsUpperNorm: 2.5,
  },
  // 3. rok: ok. połowa dzieci przestaje drzemać (Iglowstein 2003), więc dopuszczony dzień bez drzemki.
  {
    minAgeDays: 731,
    maxAgeDays: 1095,
    targetNapsCount: 1,
    minNapsCount: 0,
    wwMinMorning: 330,
    wwMaxEvening: 390,
    maxSingleNapMin: 150,
    maxDaytimeSleepMin: 150,
    medianTotalSleepMin: 735,
    homeostaticTauRiseMin: 380,
    nightWakingsMean: 0.9,
    nightWakingsUpperNorm: 2.5,
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

/** Ile ostatnich pełnych dób bierzemy pod uwagę przy wykrywaniu mniejszej liczby drzemek. */
export const NAP_TRANSITION_SAMPLE_DAYS = 7;
/** Ile z tych dób musi mieć ≤ minNapsCount drzemek (spec v2.0: przejście po ≥5 dniach). */
export const NAP_TRANSITION_MIN_DAYS = 5;

/**
 * Dopasowuje liczbę drzemek przedziału do tego, jak dziecko faktycznie śpi.
 *
 * @description
 * Gdy przedział dopuszcza zakres (`minNapsCount` < `targetNapsCount`) i w ≥5 z ostatnich 7 pełnych
 * dób dziecko miało najwyżej `minNapsCount` drzemek, silnik planuje dzień na tę mniejszą liczbę
 * (np. 3→2 od 4. mies., 2→1 od 13. mies., dzień bez drzemki w 3. roku). Bez danych nic nie zmienia.
 * Przy trybie bez drzemki zeruje też oczekiwany sen dzienny.
 *
 * @param {AgeBracketConfig} bracket - Przedział z matrycy
 * @param {readonly { napCount?: number }[]} completedDays - Pełne doby, najnowsza pierwsza
 * @returns {AgeBracketConfig} Przedział z liczbą drzemek dopasowaną do dziecka
 */
export function applyObservedNapsCount(
  bracket: AgeBracketConfig,
  completedDays: readonly { readonly napCount?: number }[],
): AgeBracketConfig {
  const minNaps = bracket.minNapsCount;
  if (minNaps === undefined || minNaps >= bracket.targetNapsCount) return bracket;

  const fewNapDays = completedDays
    .slice(0, NAP_TRANSITION_SAMPLE_DAYS)
    .filter((day) => day.napCount !== undefined && day.napCount <= minNaps).length;
  if (fewNapDays < NAP_TRANSITION_MIN_DAYS) return bracket;

  return {
    ...bracket,
    targetNapsCount: minNaps,
    maxDaytimeSleepMin: minNaps === 0 ? 0 : bracket.maxDaytimeSleepMin,
  };
}
