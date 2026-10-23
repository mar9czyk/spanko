// Testowe rodziny DEV: osobne gospodarstwa z kontami rodziców, dzieckiem i 21 dobami historii
// (sen + karmienia + pieluchy). Czysty generator, bez PocketBase — używa go scripts/dev-seed-families.mjs
// i test src/lib/__tests__/seedFamilies.test.ts. Sen generuje ten sam generator co seed-profiles.
import { addDays, generateProfileSleepLogs, zonedIso } from "./seed-profiles.mjs";

/**
 * Rodziny testowe. `role` to rola logowania DEV (src/lib/dev-auth.ts), `envPrefix` — prefiks
 * zmiennych EMAIL/PASSWORD w .env.development.local. Rodzina „niemowlę” ma dwoje rodziców
 * w jednym gospodarstwie (test współdzielenia danych).
 */
export const SEED_FAMILIES = [
  {
    key: "newborn",
    household: "Rodzina: noworodek (DEV)",
    parents: [
      {
        role: "family-newborn",
        envPrefix: "DEV_FAMILY_NEWBORN",
        email: "dev-noworodek@spanko.test",
        name: "Anna (DEV)",
      },
    ],
    child: { name: "Lena (DEV)", ageDays: 60 },
    // ~2 mies.: 5 krótkich drzemek, 2 nocne karmienia
    profile: {
      key: "family_newborn",
      morningWake: [415, 445],
      bedtime: [1245, 1285],
      nightLatency: [10, 25],
      naps: [
        { wakeWindow: [60, 80], duration: [35, 80] },
        { wakeWindow: [65, 85], duration: [30, 75] },
        { wakeWindow: [65, 85], duration: [30, 70] },
        { wakeWindow: [65, 90], duration: [25, 60] },
        { wakeWindow: [60, 85], duration: [20, 45] },
      ],
      napLatency: [5, 15],
      nightWakings: [2, 3],
      fedWakings: 2,
      wakingInterventions: ["breast", "patting"],
    },
    feeding: {
      milk: [450, 600, 735, 870, 1005, 1140, 1230],
      solids: [],
      breastShare: 0.6,
      bottleMl: [60, 100],
      nightBottleMl: [50, 90],
      diapers: [430, 540, 660, 780, 900, 1050, 1200],
    },
  },
  {
    key: "infant",
    household: "Rodzina: niemowlę (DEV)",
    parents: [
      {
        role: "family-infant",
        envPrefix: "DEV_FAMILY_INFANT",
        email: "dev-niemowle-mama@spanko.test",
        name: "Marta (DEV)",
      },
      {
        role: "family-infant-partner",
        envPrefix: "DEV_FAMILY_INFANT_PARTNER",
        email: "dev-niemowle-tata@spanko.test",
        name: "Piotr (DEV)",
      },
    ],
    child: { name: "Franek (DEV)", ageDays: 215 },
    // ~7 mies.: 3 drzemki, 3-4 nocne pobudki (1 karmiona)
    profile: {
      key: "family_infant",
      morningWake: [380, 420],
      bedtime: [1170, 1200],
      nightLatency: [10, 25],
      naps: [
        { wakeWindow: [120, 140], duration: [45, 80] },
        { wakeWindow: [130, 150], duration: [40, 75] },
        { wakeWindow: [140, 165], duration: [25, 45] },
      ],
      napLatency: [5, 15],
      nightWakings: [3, 4],
      fedWakings: 1,
      wakingInterventions: ["breast", "patting", "pacifier_reinsert"],
    },
    feeding: {
      milk: [420, 660, 900, 1140],
      solids: [720, 1050],
      breastShare: 0.4,
      bottleMl: [150, 210],
      nightBottleMl: [90, 150],
      diapers: [430, 600, 780, 960, 1130],
    },
  },
  {
    key: "toddler",
    household: "Rodzina: przedszkolak (DEV)",
    parents: [
      {
        role: "family-toddler",
        envPrefix: "DEV_FAMILY_TODDLER",
        email: "dev-maluch@spanko.test",
        name: "Kasia (DEV)",
      },
    ],
    child: { name: "Ola (DEV)", ageDays: 425 },
    // ~14 mies.: jedna drzemka, noc bez karmień
    profile: {
      key: "family_toddler",
      morningWake: [385, 425],
      bedtime: [1150, 1190],
      nightLatency: [8, 20],
      naps: [{ wakeWindow: [330, 370], duration: [90, 130] }],
      napLatency: [8, 20],
      nightWakings: [0, 1],
      fedWakings: 0,
      wakingInterventions: ["patting"],
    },
    feeding: {
      milk: [1130],
      solids: [480, 720, 930, 1080],
      breastShare: 0,
      bottleMl: [140, 180],
      nightBottleMl: [100, 140],
      diapers: [440, 700, 930, 1120],
    },
  },
];

/**
 * Prosty deterministyczny generator liczb (LCG) zależny od klucza rodziny.
 *
 * @param {string} key - Klucz rodziny
 * @returns {() => number} Funkcja zwracająca liczby z [0, 1)
 */
function createRandom(key) {
  let seed = [...key].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 4294967296, 11);
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/**
 * Zdarzenia kontekstu dnia (karmienia, pieluchy) dla `days` dób rodziny.
 *
 * @param {(typeof SEED_FAMILIES)[number]} family - Rodzina
 * @param {{ childId: string; today: string; days: number; timeZone: string; sleepLogs: object[] }} options - Opcje
 * @returns {object[]} Rekordy w kształcie `day_context`
 */
export function generateFamilyDayContext(family, { childId, today, days, timeZone, sleepLogs }) {
  const random = createRandom(family.key);
  const between = ([min, max]) => Math.round(min + random() * (max - min));
  const jitter = (minutes) => minutes + between([-15, 15]);
  const { feeding } = family;
  const records = [];
  const base = (date, timestamp) => ({
    child_id: childId,
    physiological_date: date,
    timestamp,
  });
  const milkFeed = (date, minutes, ml) => {
    const useBreast = random() < feeding.breastShare;
    return {
      ...base(date, zonedIso(date, minutes, timeZone)),
      event_type: "feeding",
      ...(useBreast
        ? {
            feeding_type: "breast",
            breast_side: random() < 0.5 ? "left" : "right",
            breast_left_min: between([6, 15]),
          }
        : {
            feeding_type: "bottle",
            bottle_ml: between(ml),
            bottle_content: random() < 0.5 ? "formula" : "breast_milk",
          }),
    };
  };

  const firstDate = addDays(today, -days);
  for (let index = 0; index < days; index++) {
    const date = addDays(firstDate, index);
    for (const minutes of feeding.milk) {
      records.push(milkFeed(date, jitter(minutes), feeding.bottleMl));
    }
    for (const minutes of feeding.solids) {
      records.push({
        ...base(date, zonedIso(date, jitter(minutes), timeZone)),
        event_type: "feeding",
        feeding_type: "solid",
      });
    }
    for (const minutes of feeding.diapers) {
      const roll = random();
      records.push({
        ...base(date, zonedIso(date, jitter(minutes), timeZone)),
        event_type: "diaper",
        feeding_type: "none",
        diaper_kind: roll < 0.6 ? "wet" : roll < 0.85 ? "dirty" : "both",
      });
    }
    const night = sleepLogs.find((l) => l.type === "night" && l.physiological_date === date);
    for (const waking of night?.night_wakings ?? []) {
      if (!waking.fedMilk) continue;
      const at = new Date(waking.wokeAt).getTime() + 3 * 60_000;
      records.push({
        ...base(date, new Date(at).toISOString()),
        event_type: "feeding",
        feeding_type: "bottle",
        bottle_ml: between(feeding.nightBottleMl),
        bottle_content: "formula",
      });
    }
  }
  return records;
}

/**
 * Cała historia rodziny: logi snu + kontekst dnia.
 *
 * @param {(typeof SEED_FAMILIES)[number]} family - Rodzina
 * @param {{ childId: string; today: string; days: number; timeZone: string }} options - Opcje
 * @returns {{ sleepLogs: object[]; dayContext: object[] }} Rekordy do zapisu
 */
export function generateFamilyHistory(family, options) {
  const sleepLogs = generateProfileSleepLogs(
    { ...family.profile, name: family.child.name },
    options,
  ).map(({ id: _id, created: _created, updated: _updated, ...record }) => record);
  return {
    sleepLogs,
    dayContext: generateFamilyDayContext(family, { ...options, sleepLogs }),
  };
}
