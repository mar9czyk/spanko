// biome-ignore-all lint/suspicious/noConsole: skrypt CLI
// Seed lokalnego PocketBase (TYLKO dev). Uruchom: pnpm dev:seed
import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import PocketBase from "pocketbase";

const ENV_FILE = ".env.development.local";
const url = process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090";
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
  console.error(`Odmowa: ${url} nie jest lokalnym PocketBase.`);
  process.exit(1);
}
const { POCKETBASE_SUPERUSER_EMAIL: suEmail, POCKETBASE_SUPERUSER_PASSWORD: suPass } = process.env;
if (!suEmail || !suPass) {
  console.error(`Brak POCKETBASE_SUPERUSER_EMAIL/PASSWORD w ${ENV_FILE}`);
  process.exit(1);
}

const accounts = {
  DEV_USER: {
    email: process.env.DEV_USER_EMAIL || "dev@spanko.test",
    admin: false,
    name: "Dev User",
  },
  DEV_ADMIN: {
    email: process.env.DEV_ADMIN_EMAIL || "dev-admin@spanko.test",
    admin: true,
    name: "Dev Admin",
  },
};
for (const [prefix, acc] of Object.entries(accounts)) {
  acc.password = process.env[`${prefix}_PASSWORD`] || randomBytes(12).toString("base64url");
  if (!process.env[`${prefix}_PASSWORD`]) {
    appendFileSync(
      ENV_FILE,
      `\n${prefix}_EMAIL=${acc.email}\n${prefix}_PASSWORD=${acc.password}\n`,
    );
    console.log(`Wygenerowano dane ${prefix} -> ${ENV_FILE}`);
  }
}

const pb = new PocketBase(url);
pb.autoCancellation(false);
await pb.collection("_superusers").authWithPassword(suEmail, suPass);

// Lokalnie włączamy logowanie hasłem (w pb_schema.json jest wyłączone — produkcja).
const usersCol = await pb.collections.getOne("users");
if (!usersCol.passwordAuth.enabled) {
  await pb.collections.update("users", {
    passwordAuth: { ...usersCol.passwordAuth, enabled: true },
  });
  console.log("Włączono passwordAuth w kolekcji users (lokalnie).");
}

const findOne = (col, filter) =>
  pb
    .collection(col)
    .getFirstListItem(filter)
    .catch(() => null);

let household = await findOne("households", pb.filter("name = {:n}", { n: "Dom testowy (DEV)" }));
household ??= await pb.collection("households").create({ name: "Dom testowy (DEV)" });

for (const acc of Object.values(accounts)) {
  const data = {
    email: acc.email,
    password: acc.password,
    passwordConfirm: acc.password,
    verified: true,
    emailVisibility: true,
    name: acc.name,
    is_admin: acc.admin,
    household_id: household.id,
    terms_accepted_at: new Date().toISOString(),
    health_consent_at: new Date().toISOString(),
    consent_version: "dev",
    ai_consent: true,
  };
  const existing = await findOne("users", pb.filter("email = {:e}", { e: acc.email }));
  if (existing) await pb.collection("users").update(existing.id, data);
  else await pb.collection("users").create(data);
}

const birth = new Date(Date.now() - 100 * 86_400_000).toISOString();
let child = await findOne(
  "children",
  pb.filter("household_id = {:h} && name = {:n}", { h: household.id, n: "Tymon (DEV)" }),
);
child ??= await pb.collection("children").create({
  household_id: household.id,
  name: "Tymon (DEV)",
  birth_date: birth,
  active_day_mode: "home",
  anti_orthosomnia_mode: false,
  timezone: "Europe/Warsaw",
});

for (const col of ["sleep_logs", "day_context"]) {
  const old = await pb
    .collection(col)
    .getFullList({ filter: pb.filter("child_id = {:c}", { c: child.id }) });
  for (const r of old) await pb.collection(col).delete(r.id);
}

const at = (daysAgo, h, m) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const dateStr = (daysAgo) => at(daysAgo, 12, 0).slice(0, 10);
// Dzień fizjologiczny zamyka poranna pobudka; nocny sen z daysAgo+1 -> daysAgo należy do dnia daysAgo.
for (let daysAgo = 5; daysAgo >= 1; daysAgo--) {
  const pd = dateStr(daysAgo);
  const naps = [
    [9, 15, 45],
    [12, 30, 60],
    [15, 45, 40],
  ];
  await pb.collection("sleep_logs").create({
    child_id: child.id,
    physiological_date: pd,
    type: "night",
    status: "completed",
    put_down_at: at(daysAgo + 1, 19, 45),
    fell_asleep_at: at(daysAgo + 1, 20, 0),
    woke_up_at: at(daysAgo, 6, 30),
    mood: "easy",
    night_wakings: [],
    is_rebound_sleep: false,
    ignore_in_calibration: false,
  });
  for (const [h, m, dur] of naps) {
    const start = new Date(at(daysAgo, h, m));
    await pb.collection("sleep_logs").create({
      child_id: child.id,
      physiological_date: pd,
      type: "nap",
      status: "completed",
      put_down_at: start.toISOString(),
      fell_asleep_at: new Date(start.getTime() + 8 * 60_000).toISOString(),
      woke_up_at: new Date(start.getTime() + dur * 60_000).toISOString(),
      mood: "easy",
    });
  }
  for (const [h, type] of [
    [7, "breast"],
    [11, "bottle"],
    [17, "breast"],
  ]) {
    await pb.collection("day_context").create({
      child_id: child.id,
      physiological_date: pd,
      timestamp: at(daysAgo, h, 0),
      feeding_type: type,
      ...(type === "bottle" ? { bottle_ml: 120 } : { breast_side: "both" }),
    });
  }
}
// Drugie, starsze dziecko (~14 mies., 1 drzemka) — do testów panelu admina i wielu dzieci w gospodarstwie.
// Tworzone po Tymonie, więc aplikacja (aktywne = najstarsze dziecko) nadal pokazuje Tymona.
const OLDER_CHILD_NAME = "Hania (DEV)";
const olderBirth = new Date(Date.now() - 425 * 86_400_000).toISOString();
let older = await findOne(
  "children",
  pb.filter("household_id = {:h} && name = {:n}", { h: household.id, n: OLDER_CHILD_NAME }),
);
older ??= await pb.collection("children").create({
  household_id: household.id,
  name: OLDER_CHILD_NAME,
  birth_date: olderBirth,
  active_day_mode: "home",
  anti_orthosomnia_mode: false,
  timezone: "Europe/Warsaw",
});

for (const col of ["sleep_logs", "day_context"]) {
  const old = await pb
    .collection(col)
    .getFullList({ filter: pb.filter("child_id = {:c}", { c: older.id }) });
  for (const r of old) await pb.collection(col).delete(r.id);
}

// Hania ma 7 dób z częstymi nocnymi pobudkami i usypianiem z dużą pomocą (pierś/noszenie) —
// to uruchamia realną diagnozę (CAT1/CAT7), więc „Przeanalizuj sen z AI” ma co pokazać.
for (let daysAgo = 7; daysAgo >= 1; daysAgo--) {
  const pd = dateStr(daysAgo);
  await pb.collection("sleep_logs").create({
    child_id: older.id,
    physiological_date: pd,
    type: "night",
    status: "completed",
    put_down_at: at(daysAgo + 1, 19, 15),
    fell_asleep_at: at(daysAgo + 1, 19, 30),
    woke_up_at: at(daysAgo, 6, 45),
    mood: "easy",
    interventions: ["breast"],
    night_wakings: [
      [22, 40],
      [1, 15],
      [3, 30],
      [5, 10],
    ].map(([h, m], i) => {
      const wokeAt = new Date(at(h >= 18 ? daysAgo + 1 : daysAgo, h, m + daysAgo));
      return {
        wokeAt: wokeAt.toISOString(),
        fellAsleepAt: new Date(wokeAt.getTime() + 15 * 60_000).toISOString(),
        estimatedDurationMin: 15,
        fedMilk: i < 2,
        interventions: [i < 2 ? "breast" : "carrying"],
      };
    }),
    is_rebound_sleep: false,
    ignore_in_calibration: false,
  });
  const napStart = new Date(at(daysAgo, 12, 30));
  await pb.collection("sleep_logs").create({
    child_id: older.id,
    physiological_date: pd,
    type: "nap",
    status: "completed",
    put_down_at: napStart.toISOString(),
    fell_asleep_at: new Date(napStart.getTime() + 10 * 60_000).toISOString(),
    woke_up_at: new Date(napStart.getTime() + 120 * 60_000).toISOString(),
    mood: "easy",
  });
  for (const [h, type] of [
    [8, "solid"],
    [12, "solid"],
    [17, "solid"],
    [19, "bottle"],
  ]) {
    await pb.collection("day_context").create({
      child_id: older.id,
      physiological_date: pd,
      timestamp: at(daysAgo, h, 0),
      feeding_type: type,
      ...(type === "bottle" ? { bottle_ml: 150 } : {}),
    });
  }
}

// Wniosek dla Hani (prefiks DEV_, idempotentnie) — czeka na reakcję rodzica
for (const r of await pb.collection("child_insights").getFullList({
  filter: pb.filter("child_id = {:c} && diagnosis_code ~ 'DEV_'", { c: older.id }),
})) {
  await pb.collection("child_insights").delete(r.id);
}
await pb.collection("child_insights").create({
  child_id: older.id,
  category: "CAT1_ASSOCIATIONS_NIGHT_WAKINGS",
  diagnosis_code: "DEV_HANIA_NIGHT_WAKINGS",
  status: "active",
  title: "Częste pobudki i usypianie z dużą pomocą",
  explanation:
    "W 7 ostatnich nocach budziła się 4 razy i za każdym razem zasypiała przy piersi lub na rękach.",
  clinical_action:
    "Stopniowo zmniejszaj pomoc przy zasypianiu: odkładaj Hanię senną, ale jeszcze nieśpiącą.",
  confidence_score: 0.85,
  parent_feedback: "pending",
  algorithm_override_json: {},
  valid_from: new Date().toISOString(),
});

console.log(
  `Gotowe. Dzieci: ${child.name}, ${older.name}. Użytkownicy: ${Object.values(accounts)
    .map((a) => a.email)
    .join(", ")}`,
);
