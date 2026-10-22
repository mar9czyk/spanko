/**
 * Teksty opisujące cele, metody, zadania i blokery gotowości (PL/EN).
 *
 * @description
 * Silnik Celów zwraca kody i parametry; ten moduł tłumaczy je na język rodzica.
 * Używany przez UI oraz awaryjną ścieżkę coacha (gdy brak AI).
 */

import type {
  ChairDistance,
  DailyTask,
  GoalMethod,
  GoalType,
  InterventionRung,
  ReadinessBlocker,
  ReadinessWarning,
  SleepHabit,
} from "@/lib/goals-engine/types";

export type CopyLocale = "pl" | "en";

type Localized = Readonly<Record<CopyLocale, string>>;

const pick = (value: Localized, locale: CopyLocale): string => value[locale];

export const GOAL_TITLES: Readonly<Record<GoalType, Localized>> = {
  reduce_night_wakings: { pl: "Mniej pobudek nocnych", en: "Fewer night wakings" },
  night_weaning: { pl: "Noc bez mleka", en: "Night weaning" },
  independent_sleep_onset: { pl: "Samodzielne zasypianie", en: "Falling asleep independently" },
  healthy_sleep_habits: { pl: "Lepsze nawyki snu", en: "Better sleep habits" },
};

export const GOAL_SUMMARIES: Readonly<Record<GoalType, Localized>> = {
  reduce_night_wakings: {
    pl: "Stopniowo uczymy dziecko wracać do snu bez Twojej pomocy.",
    en: "Gradually teach your baby to settle back to sleep without help.",
  },
  night_weaning: {
    pl: "Krok po kroku odstawiamy nocne karmienia.",
    en: "Step by step, we phase out night feeds.",
  },
  independent_sleep_onset: {
    pl: "Uczymy zasypiania bez karmienia, bujania i noszenia.",
    en: "Teach falling asleep without feeding, rocking or carrying.",
  },
  healthy_sleep_habits: {
    pl: "Bez treningu snu: stała pobudka, rutyna i dobre warunki do snu. Od urodzenia.",
    en: "No sleep training: steady wake-up, a routine and a good sleep space. From birth.",
  },
};

export const METHOD_TITLES: Readonly<Record<GoalMethod, Localized>> = {
  gentle_fading: { pl: "Łagodne wygaszanie", en: "Gentle fading" },
  chair_method: { pl: "Metoda krzesła", en: "Chair method" },
  pick_up_put_down: { pl: "Weź–odłóż", en: "Pick up / put down" },
  check_and_console: { pl: "Sprawdzanie w odstępach (Ferber)", en: "Check & console (Ferber)" },
  extinction: { pl: "Bez interwencji (extinction)", en: "Extinction" },
  habit_building: { pl: "Nawyk po nawyku", en: "One habit at a time" },
};

export const METHOD_DESCRIPTIONS: Readonly<Record<GoalMethod, Localized>> = {
  gentle_fading: {
    pl: "Najmniej płaczu, najwolniej. Zmniejszasz swoją pomoc co 2 noce, zwykle 1–2 tygodnie.",
    en: "Least crying, slowest. You reduce your help every 2 nights, usually 1–2 weeks.",
  },
  chair_method: {
    pl: "Siedzisz przy łóżeczku i co 3 noce odsuwasz się dalej (4 pozycje). Zwykle 10–14 nocy.",
    en: "Sit by the cot and move further away every 3 nights (4 positions). Usually 10–14 nights.",
  },
  pick_up_put_down: {
    pl: "Uspokajasz na rękach i odkładasz, gdy dziecko się wyciszy. Zwykle 2–3 tygodnie; najlepiej działa do 6. miesiąca.",
    en: "Soothe in arms, then put down once calm. Usually 2–3 weeks; works best up to 6 months.",
  },
  check_and_console: {
    pl: "Stanowcza: wychodzisz i wracasz w rosnących odstępach na krótką wizytę (do minuty). Zwykle 4–7 nocy.",
    en: "Firm: you leave and return at growing intervals for a short visit (up to a minute). Usually 4–7 nights.",
  },
  extinction: {
    pl: "Najstarsza i najszybsza, ale najtrudniejsza: bez wchodzenia do pokoju, jeśli dziecko jest bezpieczne.",
    en: "Fastest but hardest: no entering the room while your baby is safe.",
  },
  habit_building: {
    pl: "Co 3 noce dokładamy jeden nawyk, reagujesz na dziecko jak zawsze. Około 2 tygodni.",
    en: "A new habit every 3 nights while you respond to your baby as usual. About 2 weeks.",
  },
};

/**
 * Pod metodami: stanowisko ABM obok AASM/AAP (decyzja planu etap D, jedno zdanie).
 */
export const METHOD_FEEDING_NOTE: Localized = {
  pl: "Karmisz piersią? AASM i AAP uznają metody behawioralne za bezpieczne, a ABM (Academy of Breastfeeding Medicine) przypomina, że ograniczanie nocnych karmień może zmniejszyć laktację, więc wybierz łagodniejsze tempo i obserwuj ilość pokarmu.",
  en: "Breastfeeding? AASM and AAP consider behavioural methods safe, while ABM (Academy of Breastfeeding Medicine) notes that cutting night feeds can lower milk supply, so choose a gentler pace and watch your supply.",
};

/**
 * Sygnały, przy których przed treningiem snu trzeba porozmawiać z lekarzem
 * (AAP, AASM; wyczerpanie rodzica: EPDS / Hiscock 2008).
 */
export const RED_FLAGS: readonly Localized[] = [
  {
    pl: "Dziecko słabo przybiera na wadze lub pediatra zalecił nocne karmienia",
    en: "My baby gains weight poorly or a doctor advised night feeds",
  },
  {
    pl: "Podejrzewam refluks, alergię, infekcję ucha lub inną chorobę",
    en: "I suspect reflux, allergy, an ear infection or another illness",
  },
  {
    pl: "Dziecko głośno chrapie, ma przerwy w oddychaniu lub wybudza się z krztuszeniem",
    en: "My baby snores loudly, pauses breathing or wakes choking",
  },
  {
    pl: "Dziecko jest bardzo niespokojne ruchowo w nocy, kopie lub przebiera nogami (warto sprawdzić żelazo)",
    en: "My baby is very restless at night, kicking or moving their legs (iron is worth checking)",
  },
  {
    pl: "Dziecko ma atopowe zapalenie skóry, swędzenie, astmę lub nocny kaszel",
    en: "My baby has eczema, itching, asthma or a night-time cough",
  },
  {
    pl: "Zdarzyły się drgawki, napady, sztywnienie lub „wyłączanie się” dziecka",
    en: "My baby has had seizures, fits, stiffening or 'switching off' episodes",
  },
  {
    pl: "Gorączka 38°C lub więcej u dziecka poniżej 3 miesięcy, letarg, trudność z obudzeniem, sztywność karku, uwypuklone ciemiączko lub powtarzające się wymioty — to pilny kontakt z lekarzem",
    en: "Fever of 38°C or more under 3 months, lethargy, hard to wake, stiff neck, bulging soft spot or repeated vomiting — contact a doctor urgently",
  },
  {
    pl: "Czuję się skrajnie wyczerpana/y, przygnębiona/y lub mam myśli, że sobie nie radzę — porozmawiaj z lekarzem, to częste i da się pomóc",
    en: "I feel exhausted, low or like I can't cope — talk to a doctor, this is common and help works",
  },
];

export const BLOCKER_TEXT: Readonly<Record<ReadinessBlocker, Localized>> = {
  AGE_TOO_YOUNG: {
    pl: "Dziecko jest jeszcze za małe na ten cel (liczymy wiek korygowany).",
    en: "Your baby is too young for this goal (corrected age).",
  },
  METHOD_AGE_TOO_YOUNG: {
    pl: "Ta metoda jest dostępna od 6. miesiąca życia. Wybierz łagodniejszą.",
    en: "This method is available from 6 months. Choose a gentler one.",
  },
  METHOD_NOT_SUPPORTED: {
    pl: "Ta metoda nie pasuje do wybranego celu.",
    en: "This method doesn't fit the chosen goal.",
  },
  INSUFFICIENT_DATA: {
    pl: "Zapisuj sen i karmienia jeszcze kilka nocy — potrzebujemy min. 3 pełnych dób.",
    en: "Keep logging sleep and feeds — we need at least 3 full days.",
  },
  ILLNESS_ACTIVE: {
    pl: "Dziecko jest chore lub po szczepieniu. Zacznijmy, gdy poczuje się lepiej.",
    en: "Your baby is unwell or just vaccinated. Let's start once recovered.",
  },
  RED_FLAGS_NOT_ACKNOWLEDGED: {
    pl: "Potwierdź, że żaden z sygnałów alarmowych Cię nie dotyczy.",
    en: "Confirm that none of the warning signs apply.",
  },
  NO_PROBLEM_TO_SOLVE: {
    pl: "Według Twoich danych ten cel nie jest teraz potrzebny — jest dobrze!",
    en: "Your data shows this goal isn't needed right now — all good!",
  },
};

export const WARNING_TEXT: Readonly<Record<ReadinessWarning, Localized>> = {
  TEETHING_ACTIVE: {
    pl: "Ząbkowanie może utrudniać postępy. Możesz zacząć łagodniej lub poczekać.",
    en: "Teething may slow progress. Consider a gentler start or waiting.",
  },
  LOW_DATA_QUALITY: {
    pl: "Mało danych — plan będzie mniej dopasowany.",
    en: "Little data — the plan will be less tailored.",
  },
  PUPD_OLDER_CHILD: {
    pl: "Po 6. miesiącu branie na ręce często bardziej pobudza niż uspokaja. Możesz spróbować, ale metoda krzesła bywa skuteczniejsza.",
    en: "After 6 months, picking up often stimulates more than it soothes. You can try, but the chair method often works better.",
  },
};

const RUNG_TEXT: Readonly<Record<InterventionRung, Localized>> = {
  feed: { pl: "karmienie", en: "feeding" },
  carry: { pl: "noszenie lub bujanie", en: "carrying or rocking" },
  pat: { pl: "głaskanie lub smoczek", en: "patting or pacifier" },
  shush: { pl: "szum i głos", en: "shushing and voice" },
  presence: { pl: "sama obecność w pokoju", en: "just being in the room" },
  independent: { pl: "samodzielnie, bez pomocy", en: "on their own, no help" },
};

const HABIT_TEXT: Readonly<Record<SleepHabit, Localized>> = {
  WAKE_ANCHOR: {
    pl: "Budź dziecko rano o stałej porze (± 30 min) i od razu odsłoń okna.",
    en: "Wake your baby at a steady time each morning (± 30 min) and open the curtains right away.",
  },
  BEDTIME_ROUTINE: {
    pl: "Wieczorem 20–30 min tej samej rutyny, np. kąpiel, piżama, karmienie, kołysanka.",
    en: "In the evening, 20–30 min of the same routine, e.g. bath, pyjamas, feed, lullaby.",
  },
  SLEEP_ENVIRONMENT: {
    pl: "Przygotuj pokój: ciemno, 16–20°C, lekki śpiworek; w nocy tylko przyciemnione światło.",
    en: "Set up the room: dark, 16–20°C, a light sleep bag; only dim light at night.",
  },
  DROWSY_PUT_DOWN: {
    pl: "Spróbuj raz dziennie odłożyć dziecko senne, ale jeszcze nie śpiące. Jeśli płacze, pomóż jak zwykle.",
    en: "Once a day, try putting your baby down drowsy but awake. If they cry, help as usual.",
  },
};

const CHAIR_TEXT: Readonly<Record<ChairDistance, Localized>> = {
  bedside: { pl: "przy łóżeczku", en: "next to the cot" },
  mid_room: { pl: "w połowie pokoju", en: "mid-room" },
  doorway: { pl: "w drzwiach", en: "in the doorway" },
  outside: { pl: "za drzwiami", en: "outside the door" },
};

/**
 * Opisuje zadanie dnia lub wskazówkę nocną.
 *
 * @param {DailyTask} task - Zadanie z Silnika Celów
 * @param {CopyLocale} locale - Język
 * @returns {string} Opis dla rodzica
 */
export function describeTask(task: DailyTask, locale: CopyLocale = "pl"): string {
  const { params } = task;
  const isPl = locale === "pl";
  switch (task.kind) {
    case "NIGHT_FEED_LIMIT": {
      const feeds = params.nightFeedsAllowed ?? 0;
      if (feeds === 0) {
        return isPl
          ? "W nocy bez mleka — uspokajaj w inny sposób (głos, dotyk, woda)."
          : "No milk at night — soothe another way (voice, touch, water).";
      }
      const ml = params.mlPerFeed ? ` ${params.mlPerFeed} ml` : "";
      return isPl
        ? `W nocy maks. ${feeds} karmień po${ml || " mniejszej porcji"}.`
        : `At night: max ${feeds} feeds of${ml || " a smaller amount"}.`;
    }
    case "CHECK_INTERVALS": {
      const list = (params.checkIntervalsMin ?? []).join(" → ");
      return isPl
        ? `Przy płaczu sprawdzaj po ${list} min (potem co ostatni odstęp). Wizyta do minuty: uspokój głosem lub dotykiem, nie biorąc na ręce.`
        : `If crying, check after ${list} min (then repeat the last). Visit for up to a minute: reassure with voice or touch, without picking up.`;
    }
    case "RESPONSE_RUNG":
      return isPl
        ? `Przy pobudce pomagaj tylko na poziomie: ${RUNG_TEXT[params.rung ?? "independent"].pl}.`
        : `When baby wakes, help only at the level of: ${RUNG_TEXT[params.rung ?? "independent"].en}.`;
    case "CHAIR_DISTANCE":
      return isPl
        ? `Siedź ${pick(CHAIR_TEXT[params.chairDistance ?? "outside"], locale)} aż dziecko zaśnie.`
        : `Sit ${pick(CHAIR_TEXT[params.chairDistance ?? "outside"], locale)} until baby sleeps.`;
    case "PICK_UP_PUT_DOWN":
      return isPl
        ? "Gdy płacze — weź na ręce, uspokój i odłóż, jak tylko się wyciszy (jeszcze przed zaśnięciem)."
        : "If crying, pick up, calm, and put down as soon as settled (before asleep).";
    case "NO_RESPONSE":
      return isPl
        ? "Nie wchodź do pokoju, jeśli dziecko jest bezpieczne, zdrowe i nie ma powodu do niepokoju."
        : "Don't enter the room if baby is safe, healthy and not in distress.";
    case "SLEEP_HABIT":
      return pick(HABIT_TEXT[params.habit ?? "BEDTIME_ROUTINE"], locale);
    case "BEDTIME_ROUTINE":
      return isPl
        ? "Zachowaj stałą, krótką rutynę przed snem (ok. 20 min, te same kroki)."
        : "Keep a short, consistent bedtime routine (~20 min, same steps).";
    default:
      return "";
  }
}

const HABIT_SHORT: Readonly<Record<SleepHabit, Localized>> = {
  WAKE_ANCHOR: { pl: "Stała pobudka rano", en: "Steady morning wake-up" },
  BEDTIME_ROUTINE: { pl: "Wieczorna rutyna", en: "Bedtime routine" },
  SLEEP_ENVIRONMENT: { pl: "Ciemny, chłodny pokój", en: "Dark, cool room" },
  DROWSY_PUT_DOWN: { pl: "Odłóż senne, nie śpiące", en: "Put down drowsy, not asleep" },
};

const RUNG_SHORT: Readonly<Record<InterventionRung, Localized>> = {
  feed: { pl: "Pobudka: karmienie", en: "Waking: feeding" },
  carry: { pl: "Pobudka: noszenie lub bujanie", en: "Waking: carrying or rocking" },
  pat: { pl: "Pobudka: głaskanie lub smoczek", en: "Waking: patting or pacifier" },
  shush: { pl: "Pobudka: tylko dotyk i głos", en: "Waking: just touch and voice" },
  presence: { pl: "Pobudka: sama obecność", en: "Waking: just presence" },
  independent: { pl: "Pobudka: bez pomocy", en: "Waking: no help" },
};

/**
 * Krótki tytuł zadania dnia (do listy z odhaczaniem); pełny opis zwraca `describeTask`.
 *
 * @param {DailyTask} task - Zadanie z Silnika Celów
 * @param {CopyLocale} locale - Język
 * @returns {string} Kilkuwyrazowy tytuł
 */
export function describeTaskShort(task: DailyTask, locale: CopyLocale = "pl"): string {
  const { params } = task;
  const isPl = locale === "pl";
  switch (task.kind) {
    case "NIGHT_FEED_LIMIT": {
      const feeds = params.nightFeedsAllowed ?? 0;
      if (feeds === 0) return isPl ? "Noc bez mleka" : "No milk at night";
      return isPl ? `W nocy maks. ${feeds} karm.` : `Max ${feeds} night feeds`;
    }
    case "CHECK_INTERVALS": {
      const list = (params.checkIntervalsMin ?? []).join(" → ");
      return isPl ? `Sprawdzaj po ${list} min` : `Check after ${list} min`;
    }
    case "RESPONSE_RUNG":
      return pick(RUNG_SHORT[params.rung ?? "independent"], locale);
    case "CHAIR_DISTANCE":
      return isPl
        ? `Krzesło: ${pick(CHAIR_TEXT[params.chairDistance ?? "outside"], locale)}`
        : `Chair: ${pick(CHAIR_TEXT[params.chairDistance ?? "outside"], locale)}`;
    case "PICK_UP_PUT_DOWN":
      return isPl ? "Weź na ręce i odłóż" : "Pick up, put down";
    case "NO_RESPONSE":
      return isPl ? "Bez wchodzenia do pokoju" : "Don't enter the room";
    case "SLEEP_HABIT":
      return pick(HABIT_SHORT[params.habit ?? "BEDTIME_ROUTINE"], locale);
    case "BEDTIME_ROUTINE":
      return isPl ? "Wieczorna rutyna" : "Bedtime routine";
    default:
      return "";
  }
}

export const REASON_TEXT: Readonly<Record<string, Localized>> = {
  ILLNESS_PAUSE: {
    pl: "Dziecko chore — plan wstrzymany, wracamy po wyzdrowieniu.",
    en: "Baby unwell — plan paused, resume once better.",
  },
  TARGET_REACHED: {
    pl: "Cel spełniony w co najmniej 5 z ostatnich 7 nocy! 🎉",
    en: "Target met on at least 5 of the last 7 nights! 🎉",
  },
  STEP_IN_PROGRESS: { pl: "Trzymaj się dzisiejszego kroku.", en: "Stick to today's step." },
  STEP_COMPLETED: { pl: "Krok zaliczony — przechodzimy dalej.", en: "Step done — moving on." },
  REGRESSION_DETECTED: {
    pl: "Było trudniej niż zwykle — cofamy się o krok, to normalne.",
    en: "Harder than usual — stepping back, that's normal.",
  },
  CONSOLIDATING: { pl: "Utrwalamy efekt.", en: "Consolidating the result." },
  INSUFFICIENT_DATA: {
    pl: "Brakuje danych z ostatnich nocy — zapisz pobudkę.",
    en: "Missing data from recent nights — log the wake-up.",
  },
};

const FERBER_EXPECTED_LAST_NIGHT = 7;
const FERBER_HARDEST_NIGHTS = 3;

/**
 * Komunikat postępu zależny od metody i nocy planu (np. oczekiwany efekt Ferbera po 4–7 nocach).
 *
 * @param {GoalMethod} method - Metoda celu
 * @param {number} dayNumber - Numer nocy planu (1-based)
 * @param {CopyLocale} locale - Język
 * @returns {string | null} Komunikat lub null, gdy metoda go nie ma
 */
export function methodProgressNote(
  method: GoalMethod,
  dayNumber: number,
  locale: CopyLocale = "pl",
): string | null {
  if (method !== "check_and_console") return null;
  const isPl = locale === "pl";
  if (dayNumber <= FERBER_HARDEST_NIGHTS) {
    return isPl
      ? "Pierwsze noce bywają najtrudniejsze, płacz często na chwilę się nasila. Poprawa zwykle przychodzi po 4–7 nocach."
      : "The first nights are often the hardest and crying may briefly increase. Improvement usually comes after 4–7 nights.";
  }
  if (dayNumber <= FERBER_EXPECTED_LAST_NIGHT) {
    return isPl
      ? "To noce, w których zwykle widać poprawę. Trzymaj stałe odstępy."
      : "These are the nights when improvement usually shows. Keep the intervals steady.";
  }
  return isPl
    ? "Jeśli po tygodniu nie widać poprawy, porozmawiaj z pediatrą albo wróć do łagodniejszej metody."
    : "If there's no improvement after a week, talk to your paediatrician or switch to a gentler method.";
}

/**
 * Zwraca tekst z lokalizacją.
 *
 * @param {Localized} value - Tekst PL/EN
 * @param {CopyLocale} locale - Język
 * @returns {string} Tekst w wybranym języku
 */
export function localize(value: Localized, locale: CopyLocale = "pl"): string {
  return pick(value, locale);
}
