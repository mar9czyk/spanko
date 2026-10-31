// biome-ignore-all lint/suspicious/noConsole: skrypt CLI
// Tworzy 3 testowe rodziny (osobne gospodarstwa, konta rodziców, dziecko, 21 dób historii snu,
// karmień i pieluch): noworodek ~2 mies., niemowlę ~7 mies. (dwoje rodziców w jednym gospodarstwie),
// maluch ~14 mies. z jedną drzemką. Logowanie: przyciski DEV na /login.
// TYLKO lokalny PocketBase. Uruchom: pnpm dev:seed:families (nie wymaga wcześniejszego dev:seed).
// Idempotentny: konta i dzieci są aktualizowane, a ich historia (sen, kontekst dnia, prognozy)
// zastępowana świeżą — inne dane w bazie zostają nietknięte.
import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import PocketBase from "pocketbase";
import { generateFamilyHistory, SEED_FAMILIES } from "./seed-families.mjs";
import { addDays } from "./seed-profiles.mjs";

const ENV_FILE = ".env.development.local";
const url = process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) {
  console.error(`Odmowa: ${url} nie jest lokalnym PocketBase.`);
  process.exit(1);
}
const { POCKETBASE_SUPERUSER_EMAIL: suEmail, POCKETBASE_SUPERUSER_PASSWORD: suPass } = process.env;
if (!suEmail || !suPass) {
  console.error(`Brak POCKETBASE_SUPERUSER_EMAIL/PASSWORD w ${ENV_FILE}`);
  process.exit(1);
}

const TIME_ZONE = "Europe/Warsaw";
const HISTORY_DAYS = 21;

for (const parent of SEED_FAMILIES.flatMap((family) => family.parents)) {
  parent.email = process.env[`${parent.envPrefix}_EMAIL`] || parent.email;
  parent.password = process.env[`${parent.envPrefix}_PASSWORD`];
  if (!parent.password) {
    parent.password = randomBytes(12).toString("base64url");
    appendFileSync(
      ENV_FILE,
      `\n${parent.envPrefix}_EMAIL=${parent.email}\n${parent.envPrefix}_PASSWORD=${parent.password}\n`,
    );
    console.log(`Wygenerowano dane ${parent.envPrefix} -> ${ENV_FILE}`);
  }
}

const pb = new PocketBase(url);
pb.autoCancellation(false);
await pb.collection("_superusers").authWithPassword(suEmail, suPass);

// Import pb_schema.json wyłącza logowanie hasłem — lokalnie włączamy je z powrotem.
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

const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
const summary = [];

for (const family of SEED_FAMILIES) {
  let household = await findOne("households", pb.filter("name = {:n}", { n: family.household }));
  household ??= await pb.collection("households").create({ name: family.household });

  for (const parent of family.parents) {
    const data = {
      email: parent.email,
      password: parent.password,
      passwordConfirm: parent.password,
      verified: true,
      emailVisibility: true,
      name: parent.name,
      is_admin: false,
      household_id: household.id,
      terms_accepted_at: new Date().toISOString(),
      health_consent_at: new Date().toISOString(),
      consent_version: "dev",
      ai_consent: true,
    };
    const existing = await findOne("users", pb.filter("email = {:e}", { e: parent.email }));
    if (existing) await pb.collection("users").update(existing.id, data);
    else await pb.collection("users").create(data);
  }

  const childData = {
    household_id: household.id,
    name: family.child.name,
    birth_date: `${addDays(today, -family.child.ageDays)} 00:00:00.000Z`,
    active_day_mode: "home",
    anti_orthosomnia_mode: false,
    timezone: TIME_ZONE,
  };
  const existingChild = await findOne(
    "children",
    pb.filter("household_id = {:h} && name = {:n}", { h: household.id, n: family.child.name }),
  );
  const child = existingChild
    ? await pb.collection("children").update(existingChild.id, childData)
    : await pb.collection("children").create(childData);

  for (const col of ["sleep_predictions", "sleep_logs", "day_context"]) {
    const old = await pb
      .collection(col)
      .getFullList({ filter: pb.filter("child_id = {:c}", { c: child.id }) })
      .catch(() => []);
    for (const record of old) await pb.collection(col).delete(record.id);
  }

  const { sleepLogs, dayContext } = generateFamilyHistory(family, {
    childId: child.id,
    today,
    days: HISTORY_DAYS,
    timeZone: TIME_ZONE,
  });
  for (const record of sleepLogs) await pb.collection("sleep_logs").create(record);
  for (const record of dayContext) await pb.collection("day_context").create(record);

  summary.push(
    `${family.household}: ${family.child.name}, ${sleepLogs.length} logów snu, ${dayContext.length} wpisów kontekstu; konta: ${family.parents.map((p) => p.email).join(", ")}`,
  );
}

console.log(`Gotowe.\n${summary.join("\n")}\nZaloguj się przyciskami DEV na /login.`);
