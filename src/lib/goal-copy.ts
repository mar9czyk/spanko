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
} from "@/lib/goals-engine/types";

export type CopyLocale = "pl" | "en";

type Localized = Readonly<Record<CopyLocale, string>>;

const pick = (value: Localized, locale: CopyLocale): string => value[locale];

export const GOAL_TITLES: Readonly<Record<GoalType, Localized>> = {
  reduce_night_wakings: { pl: "Mniej pobudek nocnych", en: "Fewer night wakings" },
  night_weaning: { pl: "Noc bez mleka", en: "Night weaning" },
  independent_sleep_onset: { pl: "Samodzielne zasypianie", en: "Falling asleep independently" },
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
};

export const METHOD_TITLES: Readonly<Record<GoalMethod, Localized>> = {
  gentle_fading: { pl: "Łagodne wygaszanie", en: "Gentle fading" },
  chair_method: { pl: "Metoda krzesła", en: "Chair method" },
  pick_up_put_down: { pl: "Weź–odłóż", en: "Pick up / put down" },
  check_and_console: { pl: "Sprawdzanie w odstępach (Ferber)", en: "Check & console (Ferber)" },
  extinction: { pl: "Bez interwencji (extinction)", en: "Extinction" },
};

export const METHOD_DESCRIPTIONS: Readonly<Record<GoalMethod, Localized>> = {
  gentle_fading: {
    pl: "Najmniej płaczu, najwolniej. Zmniejszasz swoją pomoc co kilka dni.",
    en: "Least crying, slowest. You reduce your help every few days.",
  },
  chair_method: {
    pl: "Siedzisz przy łóżeczku i co 3 dni odsuwasz się dalej. Umiarkowane tempo.",
    en: "Sit by the cot and move further away every 3 days. Moderate pace.",
  },
  pick_up_put_down: {
    pl: "Uspokajasz na rękach i odkładasz, gdy dziecko się wyciszy. Wymaga cierpliwości.",
    en: "Soothe in arms, then put down once calm. Takes patience.",
  },
  check_and_console: {
    pl: "Stanowcza: wychodzisz i wracasz w rosnących odstępach, by krótko uspokoić. Zwykle 4–7 nocy.",
    en: "Firm: you leave and return at growing intervals to briefly reassure. Usually 4–7 nights.",
  },
  extinction: {
    pl: "Najstarsza i najszybsza, ale najtrudniejsza: bez wchodzenia do pokoju, jeśli dziecko jest bezpieczne.",
    en: "Fastest but hardest: no entering the room while your baby is safe.",
  },
};

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
};

const RUNG_TEXT: Readonly<Record<InterventionRung, Localized>> = {
  feed: { pl: "karmienie", en: "feeding" },
  carry: { pl: "noszenie lub bujanie", en: "carrying or rocking" },
  pat: { pl: "głaskanie lub smoczek", en: "patting or pacifier" },
  shush: { pl: "szum i głos", en: "shushing and voice" },
  presence: { pl: "sama obecność w pokoju", en: "just being in the room" },
  independent: { pl: "samodzielnie, bez pomocy", en: "on their own, no help" },
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
        ? `Przy płaczu sprawdzaj po ${list} min (potem co ostatni odstęp). Krótko uspokój, nie biorąc na ręce.`
        : `If crying, check after ${list} min (then repeat the last). Reassure briefly without picking up.`;
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
    case "BEDTIME_ROUTINE":
      return isPl
        ? "Zachowaj stałą, krótką rutynę przed snem (ok. 20 min, te same kroki)."
        : "Keep a short, consistent bedtime routine (~20 min, same steps).";
    default:
      return "";
  }
}

export const REASON_TEXT: Readonly<Record<string, Localized>> = {
  ILLNESS_PAUSE: {
    pl: "Dziecko chore — plan wstrzymany, wracamy po wyzdrowieniu.",
    en: "Baby unwell — plan paused, resume once better.",
  },
  TARGET_REACHED: { pl: "Cel osiągnięty! 🎉", en: "Goal reached! 🎉" },
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
