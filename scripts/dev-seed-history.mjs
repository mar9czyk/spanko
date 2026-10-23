// biome-ignore-all lint/suspicious/noConsole: skrypt CLI
// Dogenerowuje dłuższą historię testową (14 starszych dób + wnioski AI) dla "Tymon (DEV)".
// TYLKO lokalny PocketBase. Uruchom: pnpm dev:seed:history
// Idempotentny: kasuje wyłącznie rekordy, które sam utworzył (day_context.notes = "dev-history",
// child_insights.diagnosis_code z prefiksem "DEV_", logi snu z dób 6–19 dni wstecz).
// Nie rusza dób 0–5 dni wstecz (bieżący sen, dane z `pnpm dev:seed`).
import PocketBase from "pocketbase";

const url = process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) {
  console.error(`Odmowa: ${url} nie jest lokalnym PocketBase.`);
  process.exit(1);
}
const { POCKETBASE_SUPERUSER_EMAIL: email, POCKETBASE_SUPERUSER_PASSWORD: password } = process.env;
if (!email || !password) {
  console.error("Brak POCKETBASE_SUPERUSER_EMAIL/PASSWORD w .env.development.local");
  process.exit(1);
}

const MARKER = "dev-history";
const OLDEST_DAYS_AGO = 19;
const NEWEST_DAYS_AGO = 6;

const pb = new PocketBase(url);
pb.autoCancellation(false);
await pb.collection("_superusers").authWithPassword(email, password);

const child = await pb
  .collection("children")
  .getFirstListItem(pb.filter("name = {:n}", { n: "Tymon (DEV)" }))
  .catch(() => null);
if (!child) {
  console.error('Brak dziecka "Tymon (DEV)" — najpierw uruchom: pnpm dev:seed');
  process.exit(1);
}

// Deterministyczny pseudolosowy generator, by seed dawał te same dane
let seed = 20261019;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const between = (min, max) => Math.round(min + rnd() * (max - min));

const at = (daysAgo, h, m) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d;
};
const dateStr = (daysAgo) => at(daysAgo, 12, 0).toISOString().slice(0, 10);
const plus = (date, minutes) => new Date(date.getTime() + minutes * 60_000);

// Sprzątanie poprzedniego uruchomienia
const dates = [];
for (let d = NEWEST_DAYS_AGO; d <= OLDEST_DAYS_AGO; d++) dates.push(dateStr(d));
for (const date of dates) {
  const logs = await pb.collection("sleep_logs").getFullList({
    filter: pb.filter("child_id = {:c} && physiological_date = {:d}", { c: child.id, d: date }),
  });
  for (const r of logs) await pb.collection("sleep_logs").delete(r.id);
}
for (const col of ["day_context"]) {
  const old = await pb.collection(col).getFullList({
    filter: pb.filter("child_id = {:c} && notes = {:n}", { c: child.id, n: MARKER }),
  });
  for (const r of old) await pb.collection(col).delete(r.id);
}
const oldInsights = await pb.collection("child_insights").getFullList({
  filter: pb.filter("child_id = {:c} && diagnosis_code ~ 'DEV_'", { c: child.id }),
});
for (const r of oldInsights) await pb.collection("child_insights").delete(r.id);

// Liczba nocnych pobudek: poprawa w czasie (od najstarszej doby do najnowszej)
const WAKINGS_TREND = [4, 3, 4, 3, 3, 3, 2, 3, 2, 2, 2, 1, 2, 1];
const WAKING_TIMES = [
  [23, 30],
  [2, 10],
  [4, 20],
  [1, 0],
];
const TAG_BY_DAYS_AGO = {
  17: "teething",
  16: "teething",
  12: "vaccination",
  9: "growth_spurt",
};

const created = { logs: 0, context: 0 };
const ctx = (daysAgo, when, extra) =>
  pb.collection("day_context").create({
    child_id: child.id,
    physiological_date: dateStr(daysAgo),
    timestamp: when.toISOString(),
    notes: MARKER,
    ...extra,
  });

for (let daysAgo = OLDEST_DAYS_AGO; daysAgo >= NEWEST_DAYS_AGO; daysAgo--) {
  const index = OLDEST_DAYS_AGO - daysAgo;
  const pd = dateStr(daysAgo);
  const wakeCount = WAKINGS_TREND[index] ?? 1;
  const putDown = at(daysAgo + 1, 19, between(30, 55));
  const asleep = plus(putDown, between(8, 28));
  const wokeUp = at(daysAgo, 6, between(10, 55));

  const wakings = [];
  for (let w = 0; w < wakeCount; w++) {
    const [h, m] = WAKING_TIMES[w] ?? [3, 0];
    const wokeAt =
      h >= 18 ? at(daysAgo + 1, h, m + between(0, 20)) : at(daysAgo, h, m + between(0, 20));
    const fedMilk = w < 2;
    wakings.push({
      wokeAt: wokeAt.toISOString(),
      estimatedDurationMin: between(8, 25),
      fedMilk,
      interventions: [fedMilk ? "breast" : "patting"],
    });
  }

  await pb.collection("sleep_logs").create({
    child_id: child.id,
    physiological_date: pd,
    type: "night",
    status: "completed",
    put_down_at: putDown.toISOString(),
    fell_asleep_at: asleep.toISOString(),
    woke_up_at: wokeUp.toISOString(),
    interventions: [index < 7 ? "breast" : "patting"],
    mood: index < 5 ? "fussy" : "easy",
    night_wakings: wakings,
    is_rebound_sleep: false,
    ignore_in_calibration: daysAgo === 12,
  });
  created.logs++;

  let napStart = plus(wokeUp, between(75, 95));
  for (let n = 0; n < 3; n++) {
    const micro = rnd() < 0.15;
    const duration = micro ? between(12, 19) : between(35, 75);
    await pb.collection("sleep_logs").create({
      child_id: child.id,
      physiological_date: pd,
      type: "nap",
      status: "completed",
      put_down_at: napStart.toISOString(),
      fell_asleep_at: plus(napStart, between(4, 14)).toISOString(),
      woke_up_at: plus(napStart, duration + 8).toISOString(),
      interventions: [index < 9 ? "carrying" : "pacifier_reinsert"],
      mood: micro ? "fussy" : "easy",
      night_wakings: [],
      is_rebound_sleep: false,
      ignore_in_calibration: false,
    });
    created.logs++;
    napStart = plus(napStart, duration + between(95, 125));
  }

  // Karmienia dzienne co ~3 h oraz nocne (zgodne z pobudkami)
  for (const [h, m] of [
    [7, 15],
    [10, 5],
    [13, 10],
    [16, 0],
    [18, 40],
  ]) {
    const useBreast = rnd() < 0.3;
    await ctx(daysAgo, at(daysAgo, h, m + between(0, 20)), {
      event_type: "feeding",
      feeding_type: useBreast ? "breast" : "bottle",
      bottle_ml: useBreast ? undefined : between(100, 150),
      bottle_content: useBreast ? undefined : "formula",
      breast_side: useBreast ? (rnd() < 0.5 ? "left" : "right") : undefined,
      breast_left_min: useBreast ? between(8, 15) : undefined,
    });
    created.context++;
  }
  for (const waking of wakings.filter((w) => w.fedMilk)) {
    await ctx(daysAgo, plus(new Date(waking.wokeAt), 4), {
      event_type: "feeding",
      feeding_type: "bottle",
      bottle_ml: between(60, 120),
      bottle_content: "formula",
    });
    created.context++;
  }

  for (const [h, m] of [
    [7, 0],
    [9, 50],
    [12, 40],
    [15, 30],
    [18, 20],
  ]) {
    await ctx(daysAgo, at(daysAgo, h, m), {
      event_type: "diaper",
      feeding_type: "none",
      diaper_kind: rnd() < 0.7 ? "wet" : "both",
    });
    created.context++;
  }

  const tag = TAG_BY_DAYS_AGO[daysAgo];
  if (tag) {
    await ctx(daysAgo, at(daysAgo, 11, 0), {
      event_type: "tag",
      feeding_type: "none",
      tags: [tag],
    });
    created.context++;
  }
}

// Ewoluujące wnioski (od najstarszego): superseded -> corrected_by_parent -> active/validated/hypothesis
const daysAgoIso = (n) => at(n, 8, 0).toISOString();
const insight = (data) =>
  pb.collection("child_insights").create({
    child_id: child.id,
    parent_feedback: "pending",
    confidence_score: 0.85,
    algorithm_override_json: {},
    ...data,
  });

const first = await insight({
  category: "CAT1_ASSOCIATIONS_NIGHT_WAKINGS",
  diagnosis_code: "DEV_FEED_TO_SLEEP_ASSOCIATION",
  status: "superseded",
  title: "Zasypianie przy karmieniu napędza nocne pobudki",
  explanation:
    "W 3 z 4 ostatnich nocy dziecko zasypiało przy piersi lub butelce, a potem budziło się szukając tego samego.",
  clinical_action:
    "Dziś wieczorem skończ karmienie 10–15 minut przed odłożeniem do łóżeczka, a w łóżeczku zostaw smoczek.",
  valid_from: daysAgoIso(18),
  valid_until: daysAgoIso(13),
  parent_feedback: "accepted",
});
const second = await insight({
  category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
  diagnosis_code: "DEV_OVERTIRED_BEDTIME",
  status: "corrected_by_parent",
  title: "Skróć ostatnie okno czuwania przed snem nocnym",
  explanation:
    "Dziecko zasypia dłużej niż 25 minut, co przy tym wieku zwykle oznacza przemęczenie.",
  clinical_action: "Zacznij wieczorną rutynę o 15 minut wcześniej.",
  algorithm_override_json: { wwOffsetMin: -15 },
  valid_from: daysAgoIso(13),
  valid_until: daysAgoIso(9),
  parent_feedback: "adjusted",
  parent_correction_note: "U nas lepiej działa kąpiel o 19:00, nie wcześniej.",
  previous_insight_id: first.id,
});
const third = await insight({
  category: "CAT4_SHORT_NAPS_TRANSITIONS",
  diagnosis_code: "DEV_SHORT_NAP_COMPENSATION",
  status: "active",
  title: "Po krótkiej drzemce skróć następne okno czuwania",
  explanation: "Po mikro-drzemkach dziecko szybciej się męczy i wieczorem jest marudne.",
  clinical_action:
    "Gdy drzemka trwa mniej niż 30 minut, położ dziecko o 15–20 minut wcześniej niż zwykle.",
  algorithm_override_json: { wwOffsetMin: -15 },
  confidence_score: 0.9,
  valid_from: daysAgoIso(9),
  previous_insight_id: second.id,
});
await insight({
  category: "CAT7_NIGHT_WEANING_FEEDING",
  diagnosis_code: "DEV_NIGHT_FEEDS_DECREASING",
  status: "validated",
  title: "Nocne karmienia stopniowo się skracają",
  explanation: "Liczba nocnych karmień spadła z 2 do 1 w ciągu 2 tygodni.",
  clinical_action:
    "Utrzymaj obecne tempo: przy pierwszej pobudce poczekaj 2–3 minuty, zanim zaproponujesz mleko.",
  confidence_score: 0.88,
  valid_from: daysAgoIso(7),
  parent_feedback: "accepted",
});
await insight({
  category: "CAT3_EARLY_WAKING_SPLIT_NIGHT",
  diagnosis_code: "DEV_EARLY_WAKING_HYPOTHESIS",
  status: "hypothesis",
  title: "Możliwe wczesne pobudki po 5:30",
  explanation: "W 2 z ostatnich 3 dni dziecko wstało przed 5:30.",
  clinical_action: "Na razie tylko obserwujemy: zaciemnij pokój i unikaj karmienia przed 6:00.",
  confidence_score: 0.55,
  valid_from: daysAgoIso(2),
});
await pb.collection("child_insights").update(first.id, { superseded_by_id: second.id });
await pb.collection("child_insights").update(second.id, { superseded_by_id: third.id });

console.log(
  `Gotowe: ${created.logs} logów snu, ${created.context} wpisów kontekstu (doby ${NEWEST_DAYS_AGO}–${OLDEST_DAYS_AGO} dni wstecz) oraz 5 wniosków dla ${child.name}.`,
);
