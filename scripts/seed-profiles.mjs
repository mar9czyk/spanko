// Profile testowe dzieci do seeda i testów regresji silnika (czysty generator, bez PocketBase).
// Używają go: scripts/dev-seed-profiles.mjs (lokalna baza) i
// src/lib/server/__tests__/seedProfilesRegression.test.ts (oczekiwane diagnozy, limit fałszywych alarmów).

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 1440;

/**
 * Profile dzieci w wieku ~9 mies. (2 drzemki). Czasy w minutach od północy w strefie dziecka;
 * zakresy [min, max] losowane deterministycznie. `expectedCategories` muszą się włączyć,
 * `allowedCategories` mogą (wynikają z tego samego wzorca), każda inna kategoria to fałszywy alarm.
 */
export const SEED_PROFILES = [
  {
    key: "typical",
    name: "Profil: typowe dziecko (DEV)",
    ageDays: 270,
    morningWake: [390, 420],
    bedtime: [1155, 1175],
    nightLatency: [8, 15],
    naps: [
      { wakeWindow: [150, 170], duration: [60, 90] },
      { wakeWindow: [170, 190], duration: [50, 80] },
    ],
    napLatency: [5, 12],
    nightWakings: [0, 1],
    fedWakings: 0,
    wakingInterventions: ["patting"],
    expectedCategories: [],
    allowedCategories: [],
  },
  {
    key: "early_bird",
    name: "Profil: wczesny ptaszek (DEV)",
    ageDays: 270,
    morningWake: [290, 320],
    bedtime: [1110, 1125],
    nightLatency: [8, 15],
    naps: [
      { wakeWindow: [140, 160], duration: [60, 80] },
      { wakeWindow: [170, 190], duration: [50, 70] },
    ],
    napLatency: [5, 12],
    nightWakings: [0, 1],
    fedWakings: 0,
    wakingInterventions: ["patting"],
    expectedCategories: ["CAT3_EARLY_WAKING_SPLIT_NIGHT"],
    allowedCategories: [],
  },
  {
    key: "short_naps",
    name: "Profil: krótkie drzemki (DEV)",
    ageDays: 270,
    morningWake: [390, 420],
    bedtime: [1155, 1175],
    nightLatency: [8, 15],
    naps: [
      { wakeWindow: [130, 150], duration: [25, 40] },
      { wakeWindow: [140, 160], duration: [25, 40] },
      { wakeWindow: [140, 160], duration: [25, 40] },
    ],
    napLatency: [5, 12],
    nightWakings: [0, 1],
    fedWakings: 0,
    wakingInterventions: ["patting"],
    expectedCategories: ["CAT4_SHORT_NAPS_TRANSITIONS"],
    allowedCategories: [],
  },
  {
    key: "frequent_wakings",
    name: "Profil: częste pobudki (DEV)",
    ageDays: 270,
    morningWake: [390, 420],
    bedtime: [1155, 1175],
    nightLatency: [10, 20],
    naps: [
      { wakeWindow: [150, 170], duration: [60, 80] },
      { wakeWindow: [170, 190], duration: [50, 70] },
    ],
    napLatency: [5, 12],
    nightWakings: [4, 5],
    fedWakings: 2,
    wakingInterventions: ["breast", "carrying"],
    expectedCategories: ["CAT1_ASSOCIATIONS_NIGHT_WAKINGS"],
    // Dwa nocne karmienia przy każdej nocy to ten sam wzorzec (asocjacja z karmieniem)
    allowedCategories: ["CAT7_NIGHT_WEANING_FEEDING"],
  },
];

/**
 * Prosty deterministyczny generator liczb (LCG) zależny od klucza profilu.
 *
 * @param {string} key - Klucz profilu
 * @returns {() => number} Funkcja zwracająca liczby z [0, 1)
 */
function createRandom(key) {
  let seed = [...key].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 4294967296, 7);
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/**
 * Przesunięcie strefy względem UTC w minutach dla danej chwili.
 *
 * @param {number} timestampMs - Chwila
 * @param {string} timeZone - Strefa IANA
 * @returns {number} Minuty (np. 120 dla czasu letniego w Warszawie)
 */
function timeZoneOffsetMinutes(timestampMs, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(timestampMs));
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - timestampMs) / MS_PER_MINUTE);
}

/**
 * Zamienia czas ścienny w strefie dziecka na ISO (UTC).
 *
 * @param {string} date - Data `YYYY-MM-DD`
 * @param {number} minutes - Minuty od północy tej daty (mogą przekraczać 1440)
 * @param {string} timeZone - Strefa IANA
 * @returns {string} Czas ISO
 */
export function zonedIso(date, minutes, timeZone) {
  const [year, month, day] = date.split("-").map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, day, 0, minutes);
  let timestamp = wallAsUtc - timeZoneOffsetMinutes(wallAsUtc, timeZone) * MS_PER_MINUTE;
  timestamp = wallAsUtc - timeZoneOffsetMinutes(timestamp, timeZone) * MS_PER_MINUTE;
  return new Date(timestamp).toISOString();
}

/**
 * Dodaje dni do daty `YYYY-MM-DD`.
 *
 * @param {string} date - Data
 * @param {number} days - Liczba dni (może być ujemna)
 * @returns {string} Nowa data
 */
export function addDays(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Generuje zakończone logi snu profilu: `days` pełnych dób fizjologicznych kończących się
 * poranną pobudką w dniu `today` (bez drzemek z `today`).
 *
 * @param {(typeof SEED_PROFILES)[number]} profile - Profil
 * @param {{ childId: string; today: string; days: number; timeZone: string }} options - Opcje
 * @returns {object[]} Rekordy w kształcie `sleep_logs` (z polami id/created/updated do testów)
 */
export function generateProfileSleepLogs(profile, { childId, today, days, timeZone }) {
  const random = createRandom(profile.key);
  const between = ([min, max]) => Math.round(min + random() * (max - min));
  const logs = [];
  const push = (record) => {
    const id = `${profile.key.replace(/_/g, "")}${String(logs.length).padStart(4, "0")}`;
    logs.push({ id, created: record.put_down_at, updated: record.woke_up_at, ...record });
  };
  const base = { child_id: childId, status: "completed", is_rebound_sleep: false };

  const firstDate = addDays(today, -days);
  let morningWake = between(profile.morningWake);
  for (let index = 0; index < days; index++) {
    const date = addDays(firstDate, index);
    let clock = morningWake;
    for (const nap of profile.naps) {
      const putDown = clock + between(nap.wakeWindow);
      const asleep = putDown + between(profile.napLatency);
      const woke = asleep + between(nap.duration);
      push({
        ...base,
        physiological_date: date,
        type: "nap",
        put_down_at: zonedIso(date, putDown, timeZone),
        fell_asleep_at: zonedIso(date, asleep, timeZone),
        woke_up_at: zonedIso(date, woke, timeZone),
        interventions: ["patting"],
        mood: "easy",
        night_wakings: [],
        ignore_in_calibration: false,
      });
      clock = woke;
    }

    const putDown = between(profile.bedtime);
    const asleep = putDown + between(profile.nightLatency);
    morningWake = between(profile.morningWake);
    const woke = MINUTES_PER_DAY + morningWake;
    const wakingCount = between(profile.nightWakings);
    const step = (woke - asleep) / (wakingCount + 1);
    const nightWakings = Array.from({ length: wakingCount }, (_, wakingIndex) => {
      const at = Math.round(asleep + step * (wakingIndex + 1));
      const duration = between([8, 20]);
      return {
        wokeAt: zonedIso(date, at, timeZone),
        fellAsleepAt: zonedIso(date, at + duration, timeZone),
        estimatedDurationMin: duration,
        fedMilk: wakingIndex < profile.fedWakings,
        interventions: [
          profile.wakingInterventions[wakingIndex % profile.wakingInterventions.length],
        ],
      };
    });
    push({
      ...base,
      physiological_date: date,
      type: "night",
      put_down_at: zonedIso(date, putDown, timeZone),
      fell_asleep_at: zonedIso(date, asleep, timeZone),
      woke_up_at: zonedIso(date, woke, timeZone),
      interventions: ["patting"],
      mood: "easy",
      night_wakings: nightWakings,
      ignore_in_calibration: false,
    });
  }
  return logs;
}
