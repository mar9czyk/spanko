// biome-ignore-all lint/suspicious/noConsole: skrypt CLI
// Dodaje do „Dom testowy (DEV)” cztery dzieci-profile (typowe, wczesny ptaszek, krótkie drzemki,
// częste pobudki) z 21 dobami logów snu i kilkoma wnioskami z reakcją rodzica.
// Te same profile sprawdza test regresji (src/lib/server/__tests__/seedProfilesRegression.test.ts),
// a panel admina „Trafność prognoz” liczy na nich błąd prognozy.
// TYLKO lokalny PocketBase. Najpierw `pnpm dev:seed`, potem: pnpm dev:seed:profiles
// Idempotentny: kasuje wyłącznie logi, wnioski i pomiary dzieci-profili.
import PocketBase from "pocketbase";
import { addDays, generateProfileSleepLogs, SEED_PROFILES } from "./seed-profiles.mjs";

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

const TIME_ZONE = "Europe/Warsaw";
const HISTORY_DAYS = 21;
// Reakcje rodziców na wnioski profili — materiał dla tabeli odrzuceń w panelu
const INSIGHT_FEEDBACK = ["accepted", "rejected", "accepted", "pending"];

const pb = new PocketBase(url);
pb.autoCancellation(false);
await pb.collection("_superusers").authWithPassword(email, password);

const household = await pb
  .collection("households")
  .getFirstListItem(pb.filter("name = {:n}", { n: "Dom testowy (DEV)" }))
  .catch(() => null);
if (!household) {
  console.error('Brak gospodarstwa "Dom testowy (DEV)" — najpierw uruchom: pnpm dev:seed');
  process.exit(1);
}

const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
const summary = [];
let insightCount = 0;

for (const profile of SEED_PROFILES) {
  const data = {
    household_id: household.id,
    name: profile.name,
    birth_date: `${addDays(today, -profile.ageDays)} 00:00:00.000Z`,
    active_day_mode: "home",
    anti_orthosomnia_mode: false,
    timezone: TIME_ZONE,
  };
  const existing = await pb
    .collection("children")
    .getFirstListItem(
      pb.filter("household_id = {:h} && name = {:n}", { h: household.id, n: profile.name }),
    )
    .catch(() => null);
  const child = existing
    ? await pb.collection("children").update(existing.id, data)
    : await pb.collection("children").create(data);

  for (const col of ["sleep_predictions", "sleep_logs", "child_insights"]) {
    const old = await pb
      .collection(col)
      .getFullList({ filter: pb.filter("child_id = {:c}", { c: child.id }) })
      .catch(() => []);
    for (const record of old) await pb.collection(col).delete(record.id);
  }

  const logs = generateProfileSleepLogs(profile, {
    childId: child.id,
    today,
    days: HISTORY_DAYS,
    timeZone: TIME_ZONE,
  });
  for (const { id: _id, created: _created, updated: _updated, ...record } of logs) {
    await pb.collection("sleep_logs").create(record);
  }

  for (const category of profile.expectedCategories) {
    await pb.collection("child_insights").create({
      child_id: child.id,
      category,
      diagnosis_code: `DEV_PROFILE_${category}`,
      status: "active",
      title: `Wniosek testowy profilu (${profile.key})`,
      explanation: "Wygenerowany przez dev-seed-profiles.",
      confidence_score: 0.8,
      parent_feedback: INSIGHT_FEEDBACK[insightCount++ % INSIGHT_FEEDBACK.length],
      valid_from: new Date().toISOString(),
    });
  }
  summary.push(`${profile.name}: ${logs.length} logów`);
}

console.log(
  `Gotowe.\n${summary.join("\n")}\nW panelu admina: Trafność prognoz → Dolicz brakujące.`,
);
