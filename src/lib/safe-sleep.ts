/**
 * Bezpieczny sen: stały blok zaleceń AAP 2022 i filtr fraz zakazanych w odpowiedziach AI.
 *
 * @description
 * Zalecenia bezpiecznego snu nigdy nie są generowane przez model — to tekst deterministyczny.
 * Filtr sprawdza tekst od modelu; przy trafieniu wywołujący zastępuje go tekstem silnika.
 * Filtr jest celowo nadgorliwy: zaprzeczenie („nie kładź na brzuchu”) też jest trafieniem,
 * bo tekst deterministyczny jest zawsze bezpieczną odpowiedzią.
 */

export type SafeSleepLocale = "pl" | "en";

/** Blok zaleceń pokazujemy do ukończenia 12. mies. (wiek korygowany). */
export const SAFE_SLEEP_MAX_AGE_DAYS = 365;

/** Trening snu (metody behawioralne) nie wcześniej niż od 16. tyg. (AASM, Mindell 2006). */
export const MIN_SLEEP_TRAINING_AGE_DAYS = 112;

/** Zalecenia bezpiecznego snu wg AAP 2022 (Moon i in., Pediatrics 2022). */
export const SAFE_SLEEP_GUIDELINES: Readonly<Record<SafeSleepLocale, readonly string[]>> = {
  pl: [
    "Do każdego snu kładź dziecko na plecach.",
    "Twardy, płaski materac bez pochylenia, z dopasowanym prześcieradłem.",
    "W łóżeczku nic więcej: bez poduszek, kocyków, ochraniaczy i maskotek.",
    "Osobne łóżeczko w pokoju rodziców, najlepiej przez pierwsze 6 miesięcy.",
    "Nie zasypiaj z dzieckiem na kanapie ani w fotelu.",
    "Bez dymu tytoniowego w otoczeniu dziecka i bez przegrzewania (bez czapeczki do snu).",
  ],
  en: [
    "Place your baby on their back for every sleep.",
    "A firm, flat, non-inclined mattress with a fitted sheet.",
    "Nothing else in the cot: no pillows, blankets, bumpers or soft toys.",
    "A separate cot in the parents' room, ideally for the first 6 months.",
    "Don't fall asleep with your baby on a sofa or armchair.",
    "No smoke around your baby and no overheating (no hat for sleep).",
  ],
};

export type SafetyRule = "BED_SHARING" | "PRONE_OR_INCLINED" | "PILLOWS" | "EARLY_SLEEP_TRAINING";

interface SafetyPattern {
  readonly rule: SafetyRule;
  readonly pattern: RegExp;
}

const ALWAYS_FORBIDDEN: readonly SafetyPattern[] = [
  {
    rule: "BED_SHARING",
    pattern:
      /wspóln\w*\s+(spani|spa[ćc]|łóż)|łóżk\w*\s+(rodzic|dorosł)|(w|we)\s+(swoim|swym|waszym|twoim|jednym|dużym)\s+łóżk|co-?sleep|bed[- ]?shar|(your|the parents'?|an adult)\s+bed\b/i,
  },
  {
    rule: "PRONE_OR_INCLINED",
    pattern:
      /na\s+brzu(ch|szk)|na\s+boku|pochył|uniesi\w*\s+(materac|wezgłow|główk)|\bklin(a|em|ie|u)?\b|on\s+(their|his|her|the)\s+(tummy|stomach|side)|\bprone\b|\bincline|\bwedge|positioner/i,
  },
  { rule: "PILLOWS", pattern: /poduszk|poduszecz|\bpillows?\b/i },
];

const EARLY_TRAINING: SafetyPattern = {
  rule: "EARLY_SLEEP_TRAINING",
  pattern:
    /trening\w*\s+snu|ferber|wypłakiw|wypłak|kontrolowan\w*\s+płacz|extinction|cry[- ]it[- ]out|sleep[- ]train/i,
};

/**
 * Szuka w tekście modelu fraz sprzecznych z zasadami bezpiecznego snu.
 *
 * @param {readonly (string | undefined)[]} texts - Pola tekstowe odpowiedzi modelu
 * @param {number} effectiveAgeDays - Wiek korygowany dziecka w dniach
 * @returns {SafetyRule | null} Pierwsza naruszona reguła lub null, gdy tekst jest bezpieczny
 */
export function findUnsafeAdvice(
  texts: readonly (string | undefined)[],
  effectiveAgeDays: number,
): SafetyRule | null {
  const joined = texts.filter(Boolean).join("\n");
  const patterns =
    effectiveAgeDays < MIN_SLEEP_TRAINING_AGE_DAYS
      ? [...ALWAYS_FORBIDDEN, EARLY_TRAINING]
      : ALWAYS_FORBIDDEN;
  return patterns.find((p) => p.pattern.test(joined))?.rule ?? null;
}

/** Błąd oznaczający odrzucenie odpowiedzi modelu przez filtr bezpieczeństwa. */
export class UnsafeAdviceError extends Error {
  readonly rule: SafetyRule;

  constructor(rule: SafetyRule) {
    super(`Filtr bezpieczeństwa odrzucił odpowiedź modelu (${rule}).`);
    this.name = "UnsafeAdviceError";
    this.rule = rule;
  }
}
