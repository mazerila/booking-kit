/** Firestore access for the functions: loading settings and calendar data. */
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore, type Transaction } from "firebase-admin/firestore";
import {
  ACTIVE_STATUSES,
  addDays,
  COL,
  CONFIG_DOC,
  DAY_MS,
  normalizeService,
  normalizeSettings,
  normalizeWeekly,
  zonedTime,
  type Block,
  type Booking,
  type Busy,
  type Category,
  type DayException,
  type LocalDate,
  type Service,
  type Settings,
  type WeeklyHours,
} from "../core/index.js";

let firestore: Firestore | undefined;

export function db(): Firestore {
  if (!firestore) {
    if (!getApps().length) initializeApp();
    firestore = getFirestore();
    try {
      firestore.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Already configured by the host project.
    }
  }
  return firestore;
}

export const configRef = (doc: keyof typeof CONFIG_DOC) => db().collection(COL.config).doc(CONFIG_DOC[doc]);

/** Short per-instance cache: settings rarely change and are read on every request. */
const CACHE_MS = 10_000;
let cache: { at: number; data: Promise<BusinessData> } | undefined;

export type BusinessData = {
  settings: Settings;
  weekly: WeeklyHours;
  services: Service[];
  categories: Category[];
};

export function loadBusiness(fresh = false): Promise<BusinessData> {
  const now = Date.now();
  if (!fresh && cache && now - cache.at < CACHE_MS) return cache.data;
  const data = (async () => {
    const [business, weekly, services, categories] = await Promise.all([
      configRef("business").get(),
      configRef("weekly").get(),
      db().collection(COL.services).get(),
      db().collection(COL.categories).get(),
    ]);
    return {
      settings: normalizeSettings(business.data()),
      weekly: normalizeWeekly(weekly.data()),
      services: services.docs.map((d) => normalizeService(d.id, d.data())).sort((a, b) => a.order - b.order),
      categories: categories.docs
        .map((d) => ({ order: 0, name: {}, ...d.data(), id: d.id }) as Category)
        .sort((a, b) => a.order - b.order),
    };
  })();
  cache = { at: now, data };
  data.catch(() => (cache = undefined));
  return data;
}

export function clearCache() {
  cache = undefined;
}

type Reader = Pick<Transaction, "get"> | undefined;

async function read<T>(tx: Reader, q: FirebaseFirestore.Query): Promise<FirebaseFirestore.QuerySnapshot<T>> {
  return (tx ? tx.get(q) : q.get()) as Promise<FirebaseFirestore.QuerySnapshot<T>>;
}

export async function loadExceptions(from: LocalDate, to: LocalDate, tx?: Reader) {
  const snap = await read<DayException>(
    tx,
    db().collection(COL.exceptions).where("date", ">=", from).where("date", "<=", to),
  );
  return Object.fromEntries(snap.docs.map((d) => [d.data().date, d.data()]));
}

/**
 * Everything occupying the calendar between two local dates (inclusive), with a
 * day of margin on each side so buffers at the edges are seen.
 */
export async function loadBusy(settings: Settings, from: LocalDate, to: LocalDate, tx?: Reader): Promise<Busy[]> {
  const startMs = zonedTime(addDays(from, -1), "00:00", settings.timezone) ?? Date.parse(from) - DAY_MS;
  const endMs = zonedTime(addDays(to, 2), "00:00", settings.timezone) ?? Date.parse(to) + 2 * DAY_MS;
  const lo = new Date(startMs).toISOString();
  const hi = new Date(endMs).toISOString();
  const [bookings, blocks] = await Promise.all([
    read<Booking>(tx, db().collection(COL.bookings).where("start", ">=", lo).where("start", "<", hi)),
    // Blocks can be long (holidays), so take all that start before the end and filter.
    read<Block>(tx, db().collection(COL.blocks).where("start", "<", hi)),
  ]);
  const busy: Busy[] = [];
  for (const d of bookings.docs) {
    const b = d.data();
    if (!ACTIVE_STATUSES.includes(b.status)) continue;
    busy.push({
      id: d.id,
      start: Date.parse(b.start),
      end: Date.parse(b.end),
      bufferBeforeMin: b.bufferBeforeMin ?? 0,
      bufferAfterMin: b.bufferAfterMin ?? 0,
      counts: true,
    });
  }
  for (const d of blocks.docs) {
    const b = d.data();
    if (b.end > lo) busy.push({ id: d.id, start: Date.parse(b.start), end: Date.parse(b.end) });
  }
  return busy;
}

export async function isAdminEmail(email: string | undefined) {
  if (!email) return false;
  const snap = await configRef("admins").get();
  const emails = (snap.data()?.emails ?? []) as string[];
  return emails.map((e) => e.toLowerCase()).includes(email.toLowerCase());
}
