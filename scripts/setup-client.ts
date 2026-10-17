/**
 * Seeds a client's Firestore from a seed file: business settings, weekly hours,
 * categories, services and admin e-mails.
 *
 *   npx tsx scripts/setup-client.ts --project my-client --seed booking.seed.json
 *
 * Credentials: `gcloud auth application-default login` (or GOOGLE_APPLICATION_CREDENTIALS).
 * Against the emulator: set FIRESTORE_EMULATOR_HOST=127.0.0.1:8085.
 *
 * Existing documents are kept unless --force is given; admin e-mails are always merged in.
 * Options: --admin someone@example.com (adds an admin), --force, --dry-run
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { COL, CONFIG_DOC, DEFAULT_WEEKLY, normalizeSettings, normalizeWeekly, type Category, type Service, type Settings, type WeeklyHours } from "../src/core/index.js";

type Seed = {
  settings?: Partial<Settings>;
  weekly?: WeeklyHours;
  categories?: (Omit<Category, "order"> & { order?: number })[];
  services?: (Partial<Service> & { id: string })[];
  admins?: string[];
};

const { values } = parseArgs({
  options: {
    project: { type: "string" },
    seed: { type: "string" },
    admin: { type: "string", multiple: true },
    force: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});

const projectId = values.project ?? process.env.GCLOUD_PROJECT;
if (!projectId) {
  console.error("Missing --project <firebase-project-id>");
  process.exit(1);
}

const seed: Seed = values.seed ? JSON.parse(readFileSync(values.seed, "utf8")) : {};
const admins = [...(seed.admins ?? []), ...(values.admin ?? [])].map((e) => e.trim().toLowerCase()).filter(Boolean);
const dry = values["dry-run"];

initializeApp({ projectId });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

async function put(path: string, data: object, label: string) {
  const ref = db.doc(path);
  const exists = (await ref.get()).exists;
  if (exists && !values.force) {
    console.log(`  = ${label} (exists, kept — use --force to overwrite)`);
    return;
  }
  if (!dry) await ref.set(data);
  console.log(`  ${exists ? "↻" : "+"} ${label}`);
}

console.log(`Setting up booking data in "${projectId}"${process.env.FIRESTORE_EMULATOR_HOST ? " (emulator)" : ""}${dry ? " [dry run]" : ""}`);

await put(`${COL.config}/${CONFIG_DOC.business}`, JSON.parse(JSON.stringify(normalizeSettings(seed.settings ?? {}))), "settings");
await put(`${COL.config}/${CONFIG_DOC.weekly}`, normalizeWeekly(seed.weekly ?? DEFAULT_WEEKLY), "weekly hours");

for (const [i, c] of (seed.categories ?? []).entries()) {
  const { id, ...data } = c;
  await put(`${COL.categories}/${id}`, { order: i, ...data }, `category ${id}`);
}

for (const [i, s] of (seed.services ?? []).entries()) {
  const { id, ...data } = s;
  await put(
    `${COL.services}/${id}`,
    { durationMin: 60, bufferBeforeMin: 0, bufferAfterMin: 0, location: "studio", active: true, order: i, ...data },
    `service ${id}`,
  );
}

if (admins.length) {
  if (!dry) await db.doc(`${COL.config}/${CONFIG_DOC.admins}`).set({ emails: FieldValue.arrayUnion(...admins) }, { merge: true });
  console.log(`  + admins: ${admins.join(", ")}`);
} else {
  const current = await db.doc(`${COL.config}/${CONFIG_DOC.admins}`).get();
  if (!current.exists) console.warn("  ! no admin e-mail yet: pass --admin you@example.com");
}

console.log("Done.");
process.exit(0);
