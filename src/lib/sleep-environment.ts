/**
 * Miejsce i warunki snu dziecka: deterministyczne porady i flagi bezpieczeństwa.
 *
 * @description
 * Profil wypełnia rodzic raz (ustawienia dziecka), wyjątek „dziś gdzie indziej” zapisuje się na śnie.
 * Moduł NIE zmienia żadnych prognoz (okna czuwania, pora snu, dług): zwraca tylko porady,
 * flagi bezpieczeństwa i kontekst do diagnoz. Brak odpowiedzi = brak danych, nigdy „warunki dobre”.
 * AI dostaje wyłącznie kody (`code`), teksty są stałe. Źródła: AAP 2022 (Moon i in.), Lullaby Trust
 * (temperatura 16–20°C), AAP 2014 (szum cicho i z dala od łóżeczka); poziomy dowodu w docs/agent/zrodla.md.
 */

import { SAFE_SLEEP_MAX_AGE_DAYS } from "./safe-sleep";

export type EnvironmentLocale = "pl" | "en";

export const SLEEP_PLACES = [
  "crib",
  "bedside_crib",
  "moses_basket",
  "floor_bed",
  "parents_bed",
  "stroller",
  "car_seat",
] as const;
export type SleepPlace = (typeof SLEEP_PLACES)[number];

/** Miejsca „w ruchu”: zaśnięcie w drodze nie wyklucza doby i nie wchodzi do wzorców drzemek. */
export const MOTION_SLEEP_PLACES = ["stroller", "car_seat"] as const;

/** Miejsca do wyboru w profilu „Gdzie i jak śpi”: auto to wyjątek, nie zwykłe miejsce snu. */
export type ProfileSleepPlace = Exclude<SleepPlace, "car_seat">;
export const PROFILE_SLEEP_PLACES: readonly ProfileSleepPlace[] = SLEEP_PLACES.filter(
  (place): place is ProfileSleepPlace => place !== "car_seat",
);

/** Poniżej tego wieku (4 mies., ok. 120 dni) sen w foteliku wymaga kontroli co 30 min. */
export const CAR_SEAT_SUPERVISION_MAX_AGE_DAYS = 120;

/**
 * Czy sen odbył się w ruchu (wózek, auto).
 *
 * @param {string | undefined | null} place - Wartość `sleep_place` wpisu
 * @returns {boolean} True dla wózka i auta
 */
export function isMotionSleepPlace(place: string | undefined | null): boolean {
  return place === "stroller" || place === "car_seat";
}

/**
 * Porada bezpieczeństwa po zaśnięciu w foteliku: do 4. mies. kontrola co 30 min
 * i wyjęcie dziecka po dojechaniu (Arya 2017, AAP 2022).
 *
 * @param {string | undefined} place - Wybrane miejsce snu tej drzemki
 * @param {number} effectiveAgeDays - Wiek korygowany dziecka w dniach
 * @param {EnvironmentLocale} locale - Język tekstu
 * @returns {string | null} Tekst porady albo null, gdy nie dotyczy
 */
export function resolveCarSeatSafetyAdvice(
  place: string | undefined,
  effectiveAgeDays: number,
  locale: EnvironmentLocale,
): string | null {
  if (place !== "car_seat" || effectiveAgeDays >= CAR_SEAT_SUPERVISION_MAX_AGE_DAYS) return null;
  return locale === "pl"
    ? "Niemowlę w foteliku: sprawdzaj dziecko co 30 minut (oddech, kolor skóry, ułożenie główki) i po dojechaniu przełóż je na płaską, twardą powierzchnię. Fotelik to nie miejsce na dłuższy sen."
    : "Baby in a car seat: check on them every 30 minutes (breathing, skin colour, head position) and move them to a flat, firm surface once you arrive. A car seat is not for longer sleep.";
}

export const SLEEP_ROOMS = ["own", "parents"] as const;
export const BLACKOUT_LEVELS = ["yes", "partial", "no"] as const;
export const NIGHT_LIGHTS = ["none", "dim_warm", "normal"] as const;
export const WHITE_NOISE_LEVELS = ["no", "yes_safe", "yes_unsure"] as const;
export const ROOM_TEMPS = ["cool", "ok", "warm", "unknown"] as const;
export const SCREEN_LEVELS = ["usually", "rarely"] as const;

/** Profil środowiska snu (children.sleep_environment); wszystkie pola opcjonalne. */
export interface SleepEnvironment {
  readonly nightPlace?: ProfileSleepPlace;
  readonly napPlace?: ProfileSleepPlace;
  readonly room?: (typeof SLEEP_ROOMS)[number];
  readonly blackout?: (typeof BLACKOUT_LEVELS)[number];
  readonly nightLight?: (typeof NIGHT_LIGHTS)[number];
  readonly whiteNoise?: (typeof WHITE_NOISE_LEVELS)[number];
  readonly roomTemp?: (typeof ROOM_TEMPS)[number];
  readonly smokingAtHome?: boolean;
  readonly screensBeforeBed?: (typeof SCREEN_LEVELS)[number];
}

export type EnvironmentAdviceKind = "safety" | "tip" | "context";

/** Diagnoza, do której porada jest kontekstem (tylko opis, bez wpływu na liczby). */
export type EnvironmentDiagnosis = "bedtime_resistance" | "early_waking" | "short_naps";

export interface EnvironmentAdvice {
  /** Stały kod przekazywany AI zamiast tekstu. */
  readonly code: string;
  readonly kind: EnvironmentAdviceKind;
  readonly diagnosis?: EnvironmentDiagnosis;
  readonly text: string;
}

type Localized = Readonly<Record<EnvironmentLocale, string>>;

interface Rule {
  readonly code: string;
  readonly kind: EnvironmentAdviceKind;
  readonly diagnosis?: EnvironmentDiagnosis;
  readonly applies: (env: SleepEnvironment, ageDays: number) => boolean;
  readonly text: Localized;
}

const usesPlace = (env: SleepEnvironment, place: SleepPlace): boolean =>
  env.nightPlace === place || env.napPlace === place;

const RULES: readonly Rule[] = [
  {
    code: "ENV_SMOKE_SAFETY",
    kind: "safety",
    applies: (env) => env.smokingAtHome === true,
    text: {
      pl: "Dym tytoniowy w domu to jeden z najmocniej udokumentowanych czynników ryzyka SIDS. Nie pal przy dziecku ani w pomieszczeniach, w których śpi, i nie bierz go do łóżka po paleniu.",
      en: "Tobacco smoke at home is one of the best-documented SIDS risk factors. Don't smoke around your baby or in rooms where they sleep, and don't bring them into your bed after smoking.",
    },
  },
  {
    code: "ENV_PARENTS_BED_SAFETY",
    kind: "safety",
    applies: (env, age) => usesPlace(env, "parents_bed") && age < SAFE_SLEEP_MAX_AGE_DAYS,
    text: {
      pl: "Skoro dziecko śpi w waszym łóżku, zadbaj o zasady: twardy materac, dziecko na plecach, bez poduszek i ciężkiej kołdry przy nim, nie zasypiaj z nim po alkoholu ani lekach nasennych, nigdy na kanapie czy fotelu. Osobne łóżeczko przy waszym łóżku jest bezpieczniejsze (AAP 2022).",
      en: "Since your baby sleeps in your bed, keep to the rules: firm mattress, baby on their back, no pillows or heavy duvet near them, never after alcohol or sedating medication, and never on a sofa or armchair. A separate cot next to your bed is safer (AAP 2022).",
    },
  },
  {
    code: "ENV_MOSES_BASKET_OUTGROW",
    kind: "safety",
    applies: (env) => usesPlace(env, "moses_basket"),
    text: {
      pl: "Kosz Mojżesza jest na pierwsze tygodnie: przenieś dziecko do łóżeczka, gdy zacznie się przekręcać albo wyrośnie z kosza (sprawdź limit producenta).",
      en: "A Moses basket is for the first weeks: move your baby to a cot once they start rolling or outgrow it (check the maker's limit).",
    },
  },
  {
    code: "ENV_FLOOR_BED_SAFETY",
    kind: "safety",
    applies: (env) => usesPlace(env, "floor_bed"),
    text: {
      pl: "Łóżko Montessori: pokój musi być bezpieczny w całości. Zabezpiecz meble, kable, okno i drzwi, a wokół łóżka zostaw pusto i miękko. Dziecko może z niego wyjść samo.",
      en: "Montessori floor bed: the whole room must be childproof. Secure furniture, cords, windows and doors, and keep the area around the bed clear. Your baby can get out on their own.",
    },
  },
  {
    code: "ENV_STROLLER_SUPERVISED",
    kind: "safety",
    applies: (env) => usesPlace(env, "stroller"),
    text: {
      pl: "Sen w wózku tylko pod okiem: pasy odpięte lub luźne, nic na twarzy, bez przegrzewania. Po powrocie przełóż śpiące dziecko na płaską, twardą powierzchnię.",
      en: "Stroller sleep only while supervised: nothing covering the face, no overheating. Move a sleeping baby to a flat, firm surface once you're home.",
    },
  },
  {
    code: "ENV_WHITE_NOISE_VOLUME",
    kind: "safety",
    applies: (env) => env.whiteNoise === "yes_unsure",
    text: {
      pl: "Biały szum puszczaj cicho (nie głośniej niż rozmowa) i ustaw urządzenie ponad 2 m od łóżeczka, nie przy główce dziecka (AAP 2014).",
      en: "Keep white noise quiet (no louder than a conversation) and place the device more than 2 m from the cot, never by your baby's head (AAP 2014).",
    },
  },
  {
    code: "ENV_HEAT_SAFETY",
    kind: "safety",
    applies: (env) => env.roomTemp === "warm",
    text: {
      pl: "W pokoju jest ciepło (powyżej 20°C): ubieraj lżej, bez czapeczki do snu, a ciepło dziecka sprawdzaj dotykiem karku. Zimne dłonie i stopy nic nie mówią. Zalecane jest 16–20°C.",
      en: "The room is warm (above 20°C): dress your baby lighter, no hat for sleep, and check warmth at the back of the neck. Cold hands and feet don't tell you anything. 16–20°C is recommended.",
    },
  },
  {
    code: "ENV_COOL_ROOM",
    kind: "tip",
    applies: (env) => env.roomTemp === "cool",
    text: {
      pl: "W pokoju jest chłodno (poniżej 16°C): dołóż warstwę lub cieplejszy śpiworek zamiast kocyka, nadal bez czapeczki do snu.",
      en: "The room is cool (below 16°C): add a layer or a warmer sleeping bag instead of a blanket, still no hat for sleep.",
    },
  },
  {
    code: "ENV_NIGHT_LIGHT",
    kind: "tip",
    applies: (env) => env.nightLight === "normal",
    text: {
      pl: "Do nocnych karmień wystarczy przyciemniona, ciepła lampka. Jasne światło mocniej budzi dziecko i rodzica.",
      en: "A dim, warm lamp is enough for night feeds. Bright light wakes baby and parent more.",
    },
  },
  {
    code: "ENV_BLACKOUT_EARLY_WAKING",
    kind: "context",
    diagnosis: "early_waking",
    applies: (env) => env.blackout === "no" || env.blackout === "partial",
    text: {
      pl: "Przy wczesnych pobudkach: pokój nie jest w pełni zaciemniony. Rozważ rolety zaciemniające, bo świt może kończyć sen o świcie.",
      en: "For early waking: the room isn't fully dark. Consider blackout blinds, as dawn light can cut sleep short.",
    },
  },
  {
    code: "ENV_BLACKOUT_NAPS",
    kind: "context",
    diagnosis: "short_naps",
    applies: (env) => env.blackout === "no",
    text: {
      pl: "Przy krótkich drzemkach: w jasnym pokoju dziecko łatwiej budzi się po jednym cyklu. Spróbuj zaciemnić pokój na drzemki.",
      en: "For short naps: in a bright room babies wake more easily after one cycle. Try darkening the room for naps.",
    },
  },
  {
    code: "ENV_EVENING_SCREEN",
    kind: "context",
    diagnosis: "bedtime_resistance",
    applies: (env) => env.screensBeforeBed === "usually",
    text: {
      pl: "Przy oporze przed snem: ekran w ostatniej godzinie przed snem utrudnia zasypianie. Zastąp go spokojną rutyną i przyciemnionym światłem.",
      en: "For bedtime resistance: screens in the last hour before bed make falling asleep harder. Swap them for a calm routine and dim light.",
    },
  },
  {
    code: "ENV_STROLLER_NAPS",
    kind: "context",
    diagnosis: "short_naps",
    applies: (env) => env.napPlace === "stroller",
    text: {
      pl: "Przy krótkich drzemkach: drzemki w wózku bywają krótsze (hałas, ruch). Dla porównania spróbuj kilku drzemek w łóżeczku.",
      en: "For short naps: stroller naps tend to be shorter (noise, motion). Try a few cot naps to compare.",
    },
  },
];

/**
 * Porady i flagi bezpieczeństwa dla profilu środowiska, flagi bezpieczeństwa na początku.
 *
 * @param {SleepEnvironment | null | undefined} env - Profil środowiska (brak = pusta lista)
 * @param {number} ageDays - Wiek korygowany dziecka w dniach
 * @param {EnvironmentLocale} locale - Język tekstów
 * @returns {readonly EnvironmentAdvice[]} Porady w kolejności: safety, tip, context
 */
export function sleepEnvironmentAdvice(
  env: SleepEnvironment | null | undefined,
  ageDays: number,
  locale: EnvironmentLocale,
): readonly EnvironmentAdvice[] {
  if (!env) return [];
  const order: Record<EnvironmentAdviceKind, number> = { safety: 0, tip: 1, context: 2 };
  return RULES.filter((rule) => rule.applies(env, ageDays))
    .map((rule) => ({
      code: rule.code,
      kind: rule.kind,
      ...(rule.diagnosis ? { diagnosis: rule.diagnosis } : {}),
      text: rule.text[locale],
    }))
    .sort((a, b) => order[a.kind] - order[b.kind]);
}

/** Kody porad dla AI (bez tekstów); AI nigdy nie dostaje surowego profilu. */
export function sleepEnvironmentCodes(
  env: SleepEnvironment | null | undefined,
  ageDays: number,
): readonly string[] {
  return sleepEnvironmentAdvice(env, ageDays, "en").map((advice) => advice.code);
}

/** Czy profil ma choć jedną odpowiedź. */
export function hasSleepEnvironment(env: SleepEnvironment | null | undefined): boolean {
  return !!env && Object.values(env).some((value) => value !== undefined && value !== null);
}

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);

/**
 * Czyści dane z bazy do poprawnego profilu: nieznane wartości są pomijane.
 *
 * @param {unknown} raw - Wartość pola `sleep_environment`
 * @returns {SleepEnvironment} Profil tylko ze znanymi wartościami
 */
export function parseSleepEnvironment(raw: unknown): SleepEnvironment {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  return {
    ...(isOneOf(PROFILE_SLEEP_PLACES, r.nightPlace) ? { nightPlace: r.nightPlace } : {}),
    ...(isOneOf(PROFILE_SLEEP_PLACES, r.napPlace) ? { napPlace: r.napPlace } : {}),
    ...(isOneOf(SLEEP_ROOMS, r.room) ? { room: r.room } : {}),
    ...(isOneOf(BLACKOUT_LEVELS, r.blackout) ? { blackout: r.blackout } : {}),
    ...(isOneOf(NIGHT_LIGHTS, r.nightLight) ? { nightLight: r.nightLight } : {}),
    ...(isOneOf(WHITE_NOISE_LEVELS, r.whiteNoise) ? { whiteNoise: r.whiteNoise } : {}),
    ...(isOneOf(ROOM_TEMPS, r.roomTemp) ? { roomTemp: r.roomTemp } : {}),
    ...(typeof r.smokingAtHome === "boolean" ? { smokingAtHome: r.smokingAtHome } : {}),
    ...(isOneOf(SCREEN_LEVELS, r.screensBeforeBed) ? { screensBeforeBed: r.screensBeforeBed } : {}),
  };
}
