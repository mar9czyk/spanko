/**
 * „Fundamenty dobrego snu” — stałe rady bez treningu snu, dobrane do wieku korygowanego.
 *
 * @description
 * Tekst deterministyczny (nie z AI). Źródła: AAP (rutyna, rytm dobowy), Mindell 2015/2017
 * (stała rutyna przed snem), Lullaby Trust (temperatura pokoju 16–20°C), AAP 2014
 * (szum cicho i z dala od łóżeczka); pora pobudki jako kotwica rytmu to heurystyka Spanko.
 */

export type FoundationLocale = "pl" | "en";

type Localized = Readonly<Record<FoundationLocale, string>>;

interface FoundationTip {
  /** Od jakiego wieku korygowanego (dni) rada ma sens. */
  readonly fromAgeDays: number;
  /** Do jakiego wieku (dni, wyłącznie); brak = bez górnej granicy. */
  readonly untilAgeDays?: number;
  readonly text: Localized;
}

const NEWBORN_DAYS = 56;

const FOUNDATION_TIPS: readonly FoundationTip[] = [
  {
    fromAgeDays: 0,
    untilAgeDays: NEWBORN_DAYS,
    text: {
      pl: "Rytm dobowy dopiero się kształtuje (8–16 tyg.): karm na żądanie i nie trzymaj się jeszcze sztywnego planu.",
      en: "The body clock is still forming (8–16 weeks): feed on demand and don't follow a strict schedule yet.",
    },
  },
  {
    fromAgeDays: 0,
    text: {
      pl: "Dzień jasny i gwarny, noc ciemna i nudna: w nocy przyciemnione światło, cichy głos, bez zabawy.",
      en: "Bright, lively days and dark, boring nights: dim light, quiet voice and no play at night.",
    },
  },
  {
    fromAgeDays: NEWBORN_DAYS,
    text: {
      pl: "Stała pora porannej pobudki (± 30 min), także w weekend. To kotwica całego dnia.",
      en: "A steady morning wake-up time (± 30 min), weekends too. It anchors the whole day.",
    },
  },
  {
    fromAgeDays: NEWBORN_DAYS,
    text: {
      pl: "Poranne światło dzienne: spacer lub zabawa przy oknie w pierwszych godzinach po pobudce.",
      en: "Morning daylight: a walk or play by the window in the first hours after waking.",
    },
  },
  {
    fromAgeDays: NEWBORN_DAYS,
    text: {
      pl: "Krótka rutyna przed snem (20–30 min), zawsze te same kroki, np. kąpiel, piżama, karmienie, kołysanka.",
      en: "A short bedtime routine (20–30 min) with the same steps, e.g. bath, pyjamas, feed, lullaby.",
    },
  },
  {
    fromAgeDays: 0,
    text: {
      pl: "W pokoju 16–20°C, lekkie ubranie lub śpiworek, ciemno. Szum, jeśli pomaga, cicho i z dala od łóżeczka.",
      en: "Room at 16–20°C, light clothing or a sleep bag, dark. White noise, if it helps, quiet and away from the cot.",
    },
  },
  {
    fromAgeDays: NEWBORN_DAYS,
    text: {
      pl: "Odkładaj czasem dziecko senne, ale jeszcze nie śpiące. Nie musi się udać za każdym razem.",
      en: "Sometimes put your baby down drowsy but still awake. It doesn't have to work every time.",
    },
  },
  {
    fromAgeDays: 0,
    text: {
      pl: "Pilnuj okien czuwania: przewidywaną porę następnego snu pokazuje strona główna.",
      en: "Watch wake windows: the home screen shows the predicted time of the next sleep.",
    },
  },
];

/**
 * Zwraca rady „fundamentów snu” odpowiednie dla wieku dziecka.
 *
 * @param {number} effectiveAgeDays - Wiek korygowany w dniach
 * @param {FoundationLocale} locale - Język
 * @returns {readonly string[]} Rady w kolejności wyświetlania
 */
export function sleepFoundationsForAge(
  effectiveAgeDays: number,
  locale: FoundationLocale,
): readonly string[] {
  return FOUNDATION_TIPS.filter(
    (tip) =>
      effectiveAgeDays >= tip.fromAgeDays &&
      (tip.untilAgeDays === undefined || effectiveAgeDays < tip.untilAgeDays),
  ).map((tip) => tip.text[locale]);
}
