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
console.log(
  `Gotowe. Dziecko: ${child.name}. Użytkownicy: ${Object.values(accounts)
    .map((a) => a.email)
    .join(", ")}`,
);
