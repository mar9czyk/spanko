/**
 * Podróż ze zmianą strefy czasowej: w którym zegarze żyje dziecko i jak przestawiać sen.
 *
 * @description
 * Silnik zwraca momenty (ISO), więc telefon i tak pokazuje je w czasie lokalnym. Strefa wpływa
 * tylko na godziny „od północy”: kotwicę poranną, przewidywaną porę snu, WMZ, wczesne pobudki
 * i granicę doby. Ten moduł wybiera strefę do tych obliczeń i przesunięcie rytmu na dziś.
 *
 * Strategie (raport „Sen w chorobie i w drodze”, opinia chronobiologa, bez badań u niemowląt):
 * - `stay_home`: krótki wyjazd i mała różnica — dziecko zostaje na czasie domowym,
 * - `gradual`: przesuwanie o 30 min/dzień na wschód i 60 min/dzień na zachód od przyjazdu,
 * - `local_now`: od razu czas lokalny (mała różnica albo decyzja rodzica).
 * Liczby to heurystyka [E/H].
 */

import {
  getMinutesFromMidnightInTimeZone,
  getUtcOffsetMinutesInTimeZone,
  MILLISECONDS_IN_DAY,
} from "./physiologicalDay";

export type TravelStrategy = "stay_home" | "gradual" | "local_now";

/** Plan podróży zapisany przy dziecku (`children.travel_json`). */
export interface TravelPlan {
  /** Strefa, w której dziecko żyło przed zmianą (np. dom). */
  readonly fromTimeZone: string;
  /** Strefa, w której dziecko jest teraz. */
  readonly toTimeZone: string;
  /** Moment wyboru strategii (zwykle przyjazd). */
  readonly startedAt: string;
  readonly strategy: TravelStrategy;
}

export const EAST_SHIFT_STEP_MINUTES = 30;
export const WEST_SHIFT_STEP_MINUTES = 60;
/** Czas domowy zalecamy przy wyjeździe do 4 dni i różnicy do 3 h. */
export const STAY_HOME_MAX_DIFF_MINUTES = 180;
export const STAY_HOME_MAX_TRIP_DAYS = 4;
/** Różnicę do 1 h dziecko zwykle łapie od razu (jak zmiana czasu). */
export const LOCAL_NOW_MAX_DIFF_MINUTES = 60;
/** Doby po zmianie strefy bez diagnoz (dzień podróży i dzień po nim). */
export const TRAVEL_DIAGNOSTIC_PAUSE_DAYS = 2;

export interface ScheduleClock {
  /** Strefa do liczenia godzin „od północy” (kotwica, WMZ, doba fizjologiczna). */
  readonly timeZone: string;
  /** Przesunięcie rytmu w minutach zegara `timeZone`, dodawane do kotwicy i pory snu. */
  readonly circadianShiftMin: number;
  /** Trwa stopniowe przestawianie. */
  readonly isAdapting: boolean;
  /** Kotwicę liczymy tylko z nocy sprzed tego momentu (rytm sprzed podróży); null = wszystkie. */
  readonly anchorBeforeIso: string | null;
  /** Wstrzymać drzewa zależne od godzin (CAT2–4). */
  readonly pauseTimeDiagnostics: boolean;
  /** Ile dób trwa przestawianie i która to doba (0 gdy nie dotyczy). */
  readonly adaptationDays: number;
  readonly adaptationDay: number;
  /** Wszystkie wpisy liczymy w `timeZone` (czas domowy, trwa przestawianie). */
  readonly useSingleClock: boolean;
  /** Strefa dla starych wpisów bez zapisanej strefy (sprzed `fallbackBeforeIso`). */
  readonly legacyTimeZone: string;
  readonly fallbackBeforeIso: string | null;
}

/**
 * Różnica stref w minutach (dodatnia = cel na wschód od źródła).
 *
 * @param {string} fromTimeZone - Strefa źródłowa
 * @param {string} toTimeZone - Strefa docelowa
 * @param {string} atIso - Moment porównania (zmiana czasu zmienia różnicę)
 * @returns {number} offset(to) − offset(from)
 */
export function getTimeZoneDifferenceMinutes(
  fromTimeZone: string,
  toTimeZone: string,
  atIso: string,
): number {
  return (
    getUtcOffsetMinutesInTimeZone(atIso, toTimeZone) -
    getUtcOffsetMinutesInTimeZone(atIso, fromTimeZone)
  );
}

/**
 * Zalecana strategia dla różnicy stref i długości wyjazdu.
 *
 * @param {number} diffMinutes - Różnica stref (offset celu − offset źródła)
 * @param {boolean} isShortTrip - Wyjazd do 4 dni
 * @returns {TravelStrategy} Zalecana strategia
 */
export function recommendTravelStrategy(diffMinutes: number, isShortTrip: boolean): TravelStrategy {
  const absDiff = Math.abs(diffMinutes);
  if (absDiff <= LOCAL_NOW_MAX_DIFF_MINUTES) return "local_now";
  if (isShortTrip && absDiff <= STAY_HOME_MAX_DIFF_MINUTES) return "stay_home";
  return "gradual";
}

/**
 * Liczba dób stopniowego przestawiania dla różnicy stref.
 *
 * @param {number} diffMinutes - Różnica stref
 * @returns {number} Doby (min. 1)
 */
export function resolveAdaptationDays(diffMinutes: number): number {
  const step = diffMinutes > 0 ? EAST_SHIFT_STEP_MINUTES : WEST_SHIFT_STEP_MINUTES;
  return Math.max(1, Math.ceil(Math.abs(diffMinutes) / step));
}

/**
 * Wyznacza zegar harmonogramu dziecka na dany moment.
 *
 * @description
 * `gradual`: do końca przestawiania liczymy w strefie źródłowej, a rytm przesuwamy o krok dziennie
 * w stronę celu (na wschód wcześniej, na zachód później w zegarze domowym). Kotwica pochodzi
 * z nocy sprzed podróży, bo noce w trakcie przesuwają się celowo. Po przestawieniu i przy
 * `local_now` liczymy w strefie dziecka, a każdy wpis w strefie, w której powstał.
 *
 * @param {string} childTimeZone - Bieżąca strefa dziecka (`children.timezone`)
 * @param {TravelPlan | null | undefined} plan - Plan podróży
 * @param {string} nowIso - Czas odniesienia
 * @returns {ScheduleClock} Zegar do obliczeń silnika
 */
export function resolveScheduleClock(
  childTimeZone: string,
  plan: TravelPlan | null | undefined,
  nowIso: string,
): ScheduleClock {
  const base: ScheduleClock = {
    timeZone: childTimeZone,
    circadianShiftMin: 0,
    isAdapting: false,
    anchorBeforeIso: null,
    pauseTimeDiagnostics: false,
    adaptationDays: 0,
    adaptationDay: 0,
    useSingleClock: false,
    legacyTimeZone: plan?.fromTimeZone ?? childTimeZone,
    fallbackBeforeIso: plan?.startedAt ?? null,
  };
  if (!plan) return base;

  const elapsedMs = new Date(nowIso).getTime() - new Date(plan.startedAt).getTime();
  if (elapsedMs < 0) return base;
  const dayIndex = Math.floor(elapsedMs / MILLISECONDS_IN_DAY) + 1;
  const isFreshChange = dayIndex <= TRAVEL_DIAGNOSTIC_PAUSE_DAYS;

  if (plan.strategy === "stay_home") {
    // Dziecko żyje dalej w strefie źródłowej, nawet jeśli strefa w profilu się zmieniła
    return { ...base, timeZone: plan.fromTimeZone, useSingleClock: true };
  }
  if (plan.strategy === "local_now") {
    return { ...base, pauseTimeDiagnostics: isFreshChange };
  }

  const diff = getTimeZoneDifferenceMinutes(plan.fromTimeZone, plan.toTimeZone, nowIso);
  const days = resolveAdaptationDays(diff);
  if (diff === 0 || dayIndex > days) {
    return { ...base, pauseTimeDiagnostics: dayIndex <= days + 1 };
  }
  const step = diff > 0 ? EAST_SHIFT_STEP_MINUTES : WEST_SHIFT_STEP_MINUTES;
  const shifted = Math.min(Math.abs(diff), dayIndex * step);
  return {
    ...base,
    timeZone: plan.fromTimeZone,
    // Na wschód lokalny wieczór wypada wcześniej w zegarze domowym, na zachód później
    circadianShiftMin: -Math.sign(diff) * shifted,
    isAdapting: true,
    anchorBeforeIso: plan.startedAt,
    pauseTimeDiagnostics: true,
    adaptationDays: days,
    adaptationDay: dayIndex,
    useSingleClock: true,
  };
}

/**
 * Strefa, w której liczymy godzinę wpisu.
 *
 * @description
 * Na czasie domowym i w trakcie przestawiania: zawsze strefa zegara. Poza tym strefa zapisana
 * przy wpisie, a dla starych wpisów bez strefy: strefa sprzed podróży (przed jej startem)
 * albo strefa zegara.
 *
 * @param {string} eventIso - Moment wpisu
 * @param {string | undefined} logTimeZone - Strefa zapisana przy wpisie
 * @param {ScheduleClock} clock - Zegar harmonogramu
 * @returns {string} Strefa IANA
 */
export function resolveLogTimeZone(
  eventIso: string,
  logTimeZone: string | undefined,
  clock: ScheduleClock,
): string {
  // W trakcie przestawiania i na czasie domowym wszystko liczymy w jednym zegarze
  if (clock.useSingleClock) return clock.timeZone;
  if (logTimeZone) return logTimeZone;
  if (clock.fallbackBeforeIso && eventIso < clock.fallbackBeforeIso) return clock.legacyTimeZone;
  return clock.timeZone;
}

/**
 * Przesuwa minuty od północy o przesunięcie rytmu (zawija przez północ).
 *
 * @param {number} minutes - Minuty od północy
 * @param {number} shiftMin - Przesunięcie
 * @returns {number} Minuty 0–1439
 */
export function shiftMinutesOfDay(minutes: number, shiftMin: number): number {
  return (((minutes + shiftMin) % 1440) + 1440) % 1440;
}

/** Noc do kotwicy okołodobowej (pola wspólne dla rekordu bazy i logu silnika). */
export interface CircadianNightSample {
  readonly wokeUpAt: string;
  readonly fellAsleepAt: string;
  readonly timeZone?: string;
}

/**
 * Godziny porannych pobudek i zaśnięć z ostatnich nocy, w zegarze harmonogramu.
 *
 * @description
 * W trakcie przestawiania bierze tylko noce sprzed podróży (gdy są) i dodaje przesunięcie dnia.
 *
 * @param {readonly CircadianNightSample[]} nightsNewestFirst - Zakończone noce, najnowsza pierwsza
 * @param {ScheduleClock} clock - Zegar harmonogramu
 * @param {number} sampleSize - Ile nocy wziąć
 * @returns {{ wakeMinutes: number[]; bedtimeMinutes: number[] }} Minuty od północy
 */
export function collectCircadianSamples(
  nightsNewestFirst: readonly CircadianNightSample[],
  clock: ScheduleClock,
  sampleSize: number,
): { wakeMinutes: number[]; bedtimeMinutes: number[] } {
  const beforeTrip = clock.anchorBeforeIso
    ? nightsNewestFirst.filter((n) => n.fellAsleepAt < (clock.anchorBeforeIso as string))
    : nightsNewestFirst;
  const nights = (beforeTrip.length > 0 ? beforeTrip : nightsNewestFirst).slice(0, sampleSize);
  const toMinutes = (iso: string, logTimeZone?: string) =>
    shiftMinutesOfDay(
      getMinutesFromMidnightInTimeZone(iso, resolveLogTimeZone(iso, logTimeZone, clock)),
      clock.circadianShiftMin,
    );
  return {
    wakeMinutes: nights.map((n) => toMinutes(n.wokeUpAt, n.timeZone)),
    bedtimeMinutes: nights.map((n) => toMinutes(n.fellAsleepAt, n.timeZone)),
  };
}
