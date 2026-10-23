import type { CopyLocale } from "@/lib/goal-copy";
import { DIAGNOSIS_CODES } from "./diagnosticTrees";

const C = DIAGNOSIS_CODES;

/**
 * Jedno zdanie wskazówki na noc dla diagnoz, które dotyczą nocy. Tekst jest stały (bez AI)
 * i zachowawczy: nie zastępuje porady lekarza.
 */
const NIGHT_ADVICE: Readonly<Record<string, Readonly<Record<CopyLocale, string>>>> = {
  [C.CAT1_HIGH_INTERVENTION]: {
    pl: "Odczekaj chwilę, zanim podejdziesz — maluch może sam wrócić do snu.",
    en: "Wait a moment before going in — baby may settle back to sleep alone.",
  },
  [C.CAT1_AGE_NORMAL]: {
    pl: "Pobudki w tym wieku są normalne — odczekaj chwilę, zanim podejdziesz.",
    en: "Night wakings are normal at this age — wait a moment before going in.",
  },
  [C.CAT3_SPLIT_NIGHT]: {
    pl: "Przy dłuższej pobudce zachowaj ciszę i przyciemnione światło.",
    en: "If baby is awake for a while, keep it quiet and the lights dim.",
  },
  [C.CAT3_EARLY_WAKING]: {
    pl: "Przy wczesnej pobudce trzymaj ciemno i spokojnie — daj szansę na dalszy sen.",
    en: "At an early waking keep it dark and calm — give baby a chance to sleep on.",
  },
  [C.CAT3_EARLY_WAKING_SHORT_NIGHT]: {
    pl: "Przy wczesnej pobudce trzymaj ciemno i spokojnie — daj szansę na dalszy sen.",
    en: "At an early waking keep it dark and calm — give baby a chance to sleep on.",
  },
  [C.CAT3_EARLY_WAKING_UNCLEAR]: {
    pl: "Przy wczesnej pobudce trzymaj ciemno i spokojnie — daj szansę na dalszy sen.",
    en: "At an early waking keep it dark and calm — give baby a chance to sleep on.",
  },
  [C.CAT5_FOUR_MONTH]: {
    pl: "To przejściowy etap — w nocy trzymaj stałą, spokojną rutynę.",
    en: "This is a passing phase — keep the night routine steady and calm.",
  },
  [C.CAT5_TRANSIENT_REGRESSION]: {
    pl: "To przejściowy etap — w nocy trzymaj stałą, spokojną rutynę.",
    en: "This is a passing phase — keep the night routine steady and calm.",
  },
  [C.CAT5_EXTINCTION_BURST]: {
    pl: "Nasilony płacz bywa przejściowy — trzymaj się ustalonego planu.",
    en: "Stronger crying is often temporary — stick to the plan you chose.",
  },
  [C.CAT5_SPONTANEOUS_RELAPSE]: {
    pl: "Nawrót bywa przejściowy — wróć spokojnie do dotychczasowej rutyny.",
    en: "A relapse is often temporary — calmly return to your usual routine.",
  },
  [C.CAT5_ILLNESS]: {
    pl: "Przy chorobie najważniejszy jest komfort dziecka — reaguj na jego potrzeby.",
    en: "When baby is ill, comfort comes first — respond to what baby needs.",
  },
  [C.CAT5_TEETHING]: {
    pl: "Ząbkowanie może budzić — pociesz dziecko spokojnie, bez nowych nawyków.",
    en: "Teething can wake baby — comfort calmly without starting new habits.",
  },
  [C.CAT6_DAY_NIGHT_CONFUSION]: {
    pl: "W nocy ciemno i cicho, bez zabawy — to pomaga odróżnić noc od dnia.",
    en: "At night keep it dark and quiet, no play — it helps tell night from day.",
  },
  [C.CAT7_HABITUAL_FEEDING]: {
    pl: "Zanim nakarmisz, spróbuj najpierw uspokoić dziecko w inny sposób.",
    en: "Before feeding, first try soothing baby another way.",
  },
  [C.CAT7_NUTRITIONAL_HUNGER]: {
    pl: "Przy prawdziwym głodzie nocne karmienie jest w porządku.",
    en: "If baby is truly hungry, a night feed is fine.",
  },
};

/**
 * Jedno zdanie wskazówki nocnej dla diagnozy z silnika snu.
 *
 * @param {string} diagnosisCode - Kod diagnozy z drzew diagnostycznych
 * @param {CopyLocale} locale - Język
 * @returns {string | null} Zdanie albo null, gdy diagnoza nie dotyczy nocy
 */
export function nightAdviceFor(diagnosisCode: string, locale: CopyLocale): string | null {
  return NIGHT_ADVICE[diagnosisCode]?.[locale] ?? null;
}
