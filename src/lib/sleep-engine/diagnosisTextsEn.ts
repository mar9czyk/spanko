import { DIAGNOSIS_CODES } from "./diagnosticTrees";
import type { DiagnosticTreeResult } from "./types";

interface DiagnosisText {
  readonly title: string;
  readonly explanation: string;
  readonly clinicalAction: string;
}

const C = DIAGNOSIS_CODES;

const NAP_TRANSITION_EXPLANATION =
  "For at least 5 days in a row your baby has taken a long time to fall asleep for the last nap or for the night. This pattern often means readiness for fewer naps.";
const COMFORT_FEED_EXPLANATION =
  "Your baby wakes for short or very frequent feeds. This pattern often means the feed helps them fall asleep rather than satisfying hunger.";
const NEWBORN_BASE_ACTION =
  "Feed on demand and respond to crying. If your baby whimpers in their sleep, wait a moment (about 60 seconds), because it may be active sleep.";

/** Angielskie odpowiedniki tekstów awaryjnych drzew (klucz = stabilny kod diagnozy). */
const DIAGNOSIS_TEXTS_EN: Readonly<Record<string, DiagnosisText>> = {
  [C.CAT1_HIGH_INTERVENTION]: {
    title: "Frequent night wakings and falling asleep with a lot of help",
    explanation:
      "Your baby wakes several times a night and needs a lot of help each time to fall asleep again. This pattern often means they fall asleep while feeding or being rocked and look for it at every waking.",
    clinicalAction:
      "Gradually reduce the help at sleep onset: put your baby down drowsy but still awake.",
  },
  [C.CAT1_AGE_NORMAL]: {
    title: "Frequent night wakings are still normal at this age",
    explanation:
      "Between 4 and 6 months many babies wake several times a night. This is not yet a pattern to change.",
    clinicalAction:
      "Respond to your baby's needs. If there are still many wakings after 6 months, it is worth looking at how your baby falls asleep.",
  },
  [C.CAT1_HEALTHY]: {
    title: "Nights without a clear waking problem",
    explanation: "The number of night wakings is within the usual range for this age.",
    clinicalAction: "Keep up your current wind-down routine before sleep.",
  },
  [C.CAT2_OVERTIRED]: {
    title: "Crying at bedtime when overtired",
    explanation:
      "Your baby takes a long time to fall asleep and cries, and the last few days had less sleep. An overtired baby often finds it harder to fall asleep.",
    clinicalAction: "Put your baby to bed 20–30 minutes earlier for the next few evenings.",
  },
  [C.CAT2_UNDERTIRED]: {
    title: "Long, calm bedtime",
    explanation:
      "Your baby takes over 30 minutes to fall asleep, but without crying. This pattern often means they are not tired enough at that time yet.",
    clinicalAction:
      "Move bedtime 15 minutes later every 3 days, until your baby falls asleep in about 15 minutes.",
  },
  [C.CAT2_UNCLEAR]: {
    title: "Long time to fall asleep without a clear cause",
    explanation:
      "Falling asleep takes over 30 minutes, but the recorded data cannot tell overtiredness from not being tired enough.",
    clinicalAction: "Record your baby's mood at bedtime for a few evenings.",
  },
  [C.CAT2_OPTIMAL]: {
    title: "Bedtime without difficulty",
    explanation: "Your baby falls asleep in a reasonable time, without much resistance.",
    clinicalAction: "Keep consistent times and a bedtime routine.",
  },
  [C.CAT3_EARLY_WAKING]: {
    title: "Early waking after a long night",
    explanation:
      "Your baby sleeps long enough at night but wakes very early. This pattern often means the whole daily rhythm has shifted earlier.",
    clinicalAction:
      "Move bedtime 15 minutes later every 2 days, until the wake-up falls at the target time. Give more light in the evening and keep the bedroom dark in the morning.",
  },
  [C.CAT3_EARLY_WAKING_SHORT_NIGHT]: {
    title: "Early waking after a short night",
    explanation:
      "The night is short and the wake-up falls very early. This pattern more often means habit or tiredness than a shifted daily rhythm.",
    clinicalAction:
      "Until the target wake-up time, treat it as night: dark, quiet, no play. Start the day at the target time and count the first nap from then.",
  },
  [C.CAT3_EARLY_WAKING_UNCLEAR]: {
    title: "Recurring early wakings",
    explanation: "Your baby wakes between 4:00 and 5:30 several times a week.",
    clinicalAction:
      "Keep the bedroom dark until the target wake-up time and do not put your baby down for the first nap too early.",
  },
  [C.CAT3_CLOCK_CHANGE]: {
    title: "Adjusting after a clock change",
    explanation:
      "After a clock change your baby wakes at the same time as usual, but the clock shows a different hour. Adjusting usually takes several days to a week.",
    clinicalAction:
      "Shift naps and bedtime by 10–15 minutes a day toward the new times. Keep the bedroom dark in the morning and give plenty of light during the day.",
  },
  [C.CAT3_NORMAL]: {
    title: "Morning wakings at the usual time",
    explanation: "Morning wakings are not regularly before 5:30.",
    clinicalAction: "Keep a consistent morning wake-up time.",
  },
  [C.CAT3_SPLIT_NIGHT]: {
    title: "Broken nights with long awake periods",
    explanation:
      "Your baby is awake for over an hour at night several times a week. This pattern often means too much sleep during the day.",
    clinicalAction:
      "Reduce total daytime sleep and lengthen the last wake window before the night.",
  },
  [C.CAT4_DEVELOPMENTAL]: {
    title: "Short naps typical for the age",
    explanation: "Naps of 30–45 minutes are common and normal for babies under 6 months.",
    clinicalAction: "Do not stretch naps by force; adjust the length of the next wake window.",
  },
  [C.CAT4_SINGLE_CYCLE]: {
    title: "Short naps during the day",
    explanation:
      "Your baby often wakes after about 40 minutes of a nap. This pattern often means they need help to move into the next sleep cycle.",
    clinicalAction:
      "Try to gently help just before the end of the first cycle (pacifier, touch around minute 35 of the nap).",
  },
  // Treść wybiera `resolveVariant` (przejście 3→2 albo 2→1)
  [C.CAT4_TRANSITION_READY]: {
    title: "Ready to move to fewer naps",
    explanation: NAP_TRANSITION_EXPLANATION,
    clinicalAction: "Drop a nap and lengthen the wake windows.",
  },
  [C.CAT4_STABLE]: {
    title: "Stable naps during the day",
    explanation: "The length of naps does not point to a problem.",
    clinicalAction: "Continue the current daily rhythm.",
  },
  [C.CAT5_ILLNESS]: {
    title: "Illness is disrupting sleep",
    explanation: "Sleep often gets worse during illness, and that is okay.",
    clinicalAction:
      "Allow more sleep and help your baby fall asleep however they need, and pause any habit changes. Return to the plan after about 2 days without fever and acute symptoms, one step back (practice, not study results).",
  },
  [C.CAT5_TEETHING]: {
    title: "Teething",
    explanation:
      "Teething worsens sleep only in some babies and usually for a few days. A high fever is not a symptom of teething.",
    clinicalAction:
      "Keep the usual rhythm and routine, and comfort your baby when they need it. If there is a fever, contact a doctor and mark illness.",
  },
  [C.CAT5_FOUR_MONTH]: {
    title: "Sleep change around 4 months",
    explanation:
      "At this age sleep matures: sleep cycles become similar to adult ones and waking between them is easier. This is a lasting change, not a phase that passes by itself in a few weeks.",
    clinicalAction:
      "Introduce a consistent wind-down sequence and give your baby a moment to return to sleep on their own before you help.",
  },
  [C.CAT5_TRANSIENT_REGRESSION]: {
    title: "Temporary worsening of sleep",
    explanation:
      "At this age worse sleep often goes with new skills or separation anxiety and usually passes in 2–4 weeks.",
    clinicalAction:
      "Keep a steady rhythm and routine. If it lasts more than a month, talk to a doctor.",
  },
  [C.CAT5_EXTINCTION_BURST]: {
    title: "A bit more protest after a change of habits",
    explanation:
      "More crying or waking on nights 2–5 after a change is a common, temporary stage (the so-called extinction burst). It usually means your baby noticed the change.",
    clinicalAction:
      "If the plan works for you, stick to it consistently for the following nights. If your baby seems ill, pause the plan.",
  },
  [C.CAT5_SPONTANEOUS_RELAPSE]: {
    title: "Wakings are back after an improvement",
    explanation:
      "Wakings returning after a few better nights are common, especially after illness, travel or a change of surroundings. It usually passes quickly if the adults' responses stay the same.",
    clinicalAction:
      "Respond the same way as in the plan and do not return to the old ways of settling.",
  },
  [C.CAT5_STABLE]: {
    title: "Stable period",
    explanation: "Nothing points to a sudden worsening of sleep.",
    clinicalAction: "Continue the current rhythm and plan.",
  },
  [C.CAT6_NEWBORN_GUARDRAIL]: {
    title: "Newborn sleep protection (under 16 weeks)",
    explanation:
      "The daily rhythm is only just forming (usually between weeks 8 and 16), so this is not the time to teach independent falling asleep.",
    clinicalAction: NEWBORN_BASE_ACTION,
  },
  [C.CAT6_MATURE]: {
    title: "The daily rhythm is now clear",
    explanation:
      "Your baby has turned 16 weeks; the day and night rhythm is usually settled by now.",
    clinicalAction: "If you like, you can gradually teach independent falling asleep.",
  },
  [C.CAT7_HABITUAL_FEEDING]: {
    title: "Night feeding for comfort",
    explanation: COMFORT_FEED_EXPLANATION,
    clinicalAction:
      "If you want to change this, reduce the night milk portion gradually every 2 nights, and leave the settling to the other parent.",
  },
  [C.CAT7_NUTRITIONAL_HUNGER]: {
    title: "Night feeds are needed at this age",
    explanation: "Babies under 6 months usually need to eat at night too.",
    clinicalAction: "Feed as needed, without trying to limit night feeds.",
  },
  [C.CAT7_BALANCED]: {
    title: "Night feeds without a clear comfort pattern",
    explanation: "Night feeds do not look habitual.",
    clinicalAction: "Make sure meals during the day are filling.",
  },
};

/**
 * Wariantowe teksty kodów, których treść zależy od danych (wykrywane po treści źródła PL).
 */
function resolveVariant(result: DiagnosticTreeResult, text: DiagnosisText): DiagnosisText {
  switch (result.diagnosisCode) {
    case C.CAT4_TRANSITION_READY: {
      const isTwoToOne = result.title.includes("jedną");
      return {
        title: isTwoToOne ? "Ready to move to one nap" : "Ready to move from three naps to two",
        explanation: NAP_TRANSITION_EXPLANATION,
        clinicalAction: isTwoToOne
          ? "Move the morning nap 15 minutes later every 3 days, until it starts around 12:00–12:30. During the transition, put your baby to bed a little earlier."
          : "Drop the third nap and lengthen the wake windows. During the transition, put your baby to bed a little earlier.",
      };
    }
    case C.CAT6_NEWBORN_GUARDRAIL:
      return {
        ...text,
        clinicalAction: result.clinicalAction.includes("Budź")
          ? `${NEWBORN_BASE_ACTION} Wake your baby from the daytime nap after 2 hours, so that more sleep falls at night.`
          : NEWBORN_BASE_ACTION,
      };
    case C.CAT7_HABITUAL_FEEDING:
      return {
        ...text,
        explanation: result.explanation.includes("Między 6.")
          ? `${COMFORT_FEED_EXPLANATION} Between 6 and 9 months some babies still need to eat at night, so a change is a family's choice.`
          : COMFORT_FEED_EXPLANATION,
        clinicalAction: result.clinicalAction.includes("laktację")
          ? "If you want to change this, shorten night feeds slowly, e.g. every 3–4 nights, and leave the settling to the other parent. Cutting night feeds quickly may reduce milk supply, so if in doubt talk to a lactation consultant."
          : text.clinicalAction,
      };
    default:
      return text;
  }
}

/**
 * Podmienia polskie teksty awaryjne diagnozy na angielskie; kody i liczby się nie zmieniają.
 * Nieznany kod zostaje bez zmian (polski tekst), więc nowa diagnoza nie psuje wyniku.
 *
 * @param {DiagnosticTreeResult} result - Wynik drzewa (teksty PL)
 * @param {"pl" | "en"} locale - Docelowy język
 * @returns {DiagnosticTreeResult} Wynik z tekstami w żądanym języku
 */
export function localizeDiagnosticTexts(
  result: DiagnosticTreeResult,
  locale: "pl" | "en",
): DiagnosticTreeResult {
  if (locale !== "en") return result;
  const text = DIAGNOSIS_TEXTS_EN[result.diagnosisCode];
  if (!text) return result;
  return { ...result, ...resolveVariant(result, text) };
}
