/**
 * End-to-end tests of the booking functions against the Firestore and Auth
 * emulators (`npm run test:emulator`). E-mails are captured by stubbing fetch.
 */
import { getAuth } from "firebase-admin/auth";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { COL, CONFIG_DOC, DEFAULT_WEEKLY, normalizeSettings, zonedTime, type Booking, type Settings } from "../src/core/index.js";
import { ApiError, changeStatus, createBooking, type Ctx } from "../src/functions/actions.js";
import { createApiHandler } from "../src/functions/api.js";
import { clearCache, db } from "../src/functions/db.js";
import { runScheduledJobs } from "../src/functions/jobs.js";

const PROJECT = process.env.GCLOUD_PROJECT ?? "demo-booking";
const TZ = "Europe/Paris";
const MON = "2026-10-19";
const at = (date: string, time: string) => new Date(zonedTime(date, time, TZ)!).toISOString();

let now = Date.parse("2026-10-12T08:00:00Z");
const sent: { to: string[]; subject: string; attachments?: unknown[] }[] = [];

const realFetch = globalThis.fetch;
vi.stubGlobal("fetch", async (url: string | URL, init?: RequestInit) => {
  if (String(url).startsWith("http://mail.test")) {
    sent.push(JSON.parse(String(init?.body)));
    return new Response("{}", { status: 200 });
  }
  return realFetch(url, init);
});

const ctx: Ctx = {
  mailer: { from: "Studio <rdv@studio.test>", apiKey: "test", url: "http://mail.test" },
  siteUrl: "https://studio.test",
  managePath: (l) => (l === "en" ? "/en/appointment/" : "/rdv/"),
  adminPath: "/admin/",
  // Melun, 2 km from the base; Paris, ~40 km.
  geocoder: async (q) =>
    q.includes("Paris") ? [{ label: "Paris", postcode: "75001", lat: 48.8566, lng: 2.3522 }] : [{ label: q, postcode: "77000", lat: 48.54, lng: 2.66 }],
  now: () => now,
};

async function seed(over: Partial<Settings> = {}) {
  await realFetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
    method: "DELETE",
  });
  const settings = normalizeSettings({
    businessName: "Studio",
    timezone: TZ,
    base: { address: "Melun", lat: 48.5421, lng: 2.6554 },
    zone: { mode: "radius", radiusKm: 20, outOfZone: "block", postcodes: [] },
    rules: { slotStepMin: 30, minNoticeMin: 60, maxAdvanceDays: 60, maxPerDay: 0, travelBufferMin: 30 },
    notifyEmails: ["owner@studio.test"],
    contact: { email: "owner@studio.test" },
    fields: [{ id: "terms", type: "checkbox", label: { fr: "J'accepte" }, required: true }],
    ...over,
  });
  const b = db().batch();
  b.set(db().collection(COL.config).doc(CONFIG_DOC.business), settings);
  b.set(db().collection(COL.config).doc(CONFIG_DOC.weekly), DEFAULT_WEEKLY);
  b.set(db().collection(COL.config).doc(CONFIG_DOC.admins), { emails: ["owner@studio.test"] });
  b.set(db().collection(COL.services).doc("face"), {
    name: { fr: "Soin visage", en: "Facial" },
    durationMin: 60,
    price: 70,
    bufferBeforeMin: 0,
    bufferAfterMin: 15,
    location: "studio",
    active: true,
    order: 1,
  });
  b.set(db().collection(COL.services).doc("body"), {
    name: { fr: "Drainage à domicile" },
    durationMin: 90,
    price: 120,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    location: "home",
    active: true,
    order: 2,
  });
  await b.commit();
  clearCache();
}

const client = { name: "Ana Martin", email: "ana@example.com", phone: "06 12 34 56 78" };
const bookInput = (start: string, over: Record<string, unknown> = {}) => ({
  serviceId: "face",
  start,
  client,
  fields: { terms: true },
  locale: "fr",
  ...over,
});

const book = (start: string, over: Record<string, unknown> = {}) =>
  createBooking(ctx, { by: "client", input: bookInput(start, over) as never });

/** Calls the HTTP handler with a fake request. */
async function call(method: string, path: string, opts: { body?: unknown; query?: Record<string, string>; token?: string } = {}) {
  const handler = createApiHandler(() => ctx);
  const req = {
    method,
    path: `/api/booking${path}`,
    query: opts.query ?? {},
    body: opts.body,
    ip: `10.0.0.${Math.floor(Math.random() * 250)}`,
    get: (h: string) => (h.toLowerCase() === "authorization" && opts.token ? `Bearer ${opts.token}` : undefined),
  };
  let status = 200;
  let json: any;
  const res = {
    status(s: number) {
      status = s;
      return res;
    },
    json(j: unknown) {
      json = j;
      return res;
    },
    set() {
      return res;
    },
    end() {
      return res;
    },
  };
  await handler(req as never, res as never);
  return { status, json };
}

beforeEach(async () => {
  now = Date.parse("2026-10-12T08:00:00Z");
  sent.length = 0;
  await seed();
});

afterAll(() => vi.unstubAllGlobals());

describe("booking", () => {
  it("creates a confirmed booking, a client and the e-mails", async () => {
    const { booking } = await book(at(MON, "10:00"));
    expect(booking.status).toBe("confirmed");
    expect(booking.end).toBe(at(MON, "11:00"));
    expect(booking.manageToken).toBeTruthy();

    const clientDoc = await db().collection(COL.clients).doc(booking.clientId).get();
    expect(clientDoc.data()).toMatchObject({ name: "Ana Martin", bookingCount: 1 });

    expect(sent.map((m) => m.to[0])).toEqual(expect.arrayContaining(["ana@example.com", "owner@studio.test"]));
    const toClient = sent.find((m) => m.to[0] === "ana@example.com")!;
    expect(toClient.subject).toContain("Rendez-vous confirmé");
    expect(toClient.attachments).toHaveLength(1);
  });

  it("refuses a taken or overlapping slot, and closed times", async () => {
    await book(at(MON, "10:00"));
    await expect(book(at(MON, "10:00"))).rejects.toMatchObject({ code: "slot_taken" });
    // 15 min buffer after the first one.
    await expect(book(at(MON, "11:00"))).rejects.toMatchObject({ code: "slot_taken" });
    // Closed at lunch, and 11:30 + 60 min would end after closing.
    await expect(book(at(MON, "12:30"))).rejects.toMatchObject({ code: "slot_taken" });
    await expect(book(at(MON, "11:30"))).rejects.toMatchObject({ code: "slot_taken" });
    await expect(book(at(MON, "14:00"))).resolves.toBeTruthy();
  });

  it("lets only one of two simultaneous requests take a slot", async () => {
    const results = await Promise.allSettled([book(at(MON, "15:00")), book(at(MON, "15:00"), { client: { ...client, email: "bob@example.com" } })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(ApiError);
    expect(failed.reason.code).toBe("slot_taken");
  });

  it("validates required fields", async () => {
    await expect(book(at(MON, "10:00"), { fields: {} })).rejects.toMatchObject({ code: "invalid", details: { fields: ["fields.terms"] } });
  });

  it("checks the zone for home visits", async () => {
    await expect(book(at(MON, "14:00"), { serviceId: "body", address: { label: "1 rue X, Paris" } })).rejects.toMatchObject({
      code: "out_of_zone",
    });
    const { booking } = await book(at(MON, "14:00"), { serviceId: "body", address: { label: "2 rue Y, Melun" } });
    expect(booking.status).toBe("confirmed");
    expect(booking.distanceKm).toBeLessThan(5);
    // Travel buffer (30 min) applies around home visits.
    expect(booking.bufferBeforeMin).toBe(30);

    await seed({ zone: { mode: "radius", radiusKm: 20, outOfZone: "request", postcodes: [] } });
    const far = await book(at(MON, "14:00"), { serviceId: "body", address: { label: "1 rue X, Paris" } });
    expect(far.booking).toMatchObject({ status: "pending", outOfZone: true });
  });

  it("request mode: pending, then approved with an e-mail", async () => {
    await seed({ policies: { confirmation: "request", allowClientCancel: true, allowClientReschedule: true, changeUntilHours: 24 } });
    const { booking } = await book(at(MON, "10:00"));
    expect(booking.status).toBe("pending");
    expect(sent.find((m) => m.to[0] === "ana@example.com")!.subject).toContain("Demande de rendez-vous reçue");
    sent.length = 0;
    const r = await changeStatus(ctx, booking.id, "confirmed", { by: "admin", notify: true });
    expect(r.booking.status).toBe("confirmed");
    expect(sent[0]!.subject).toContain("Rendez-vous confirmé");
    await expect(changeStatus(ctx, booking.id, "declined", { by: "admin", notify: true })).rejects.toMatchObject({ code: "not_allowed" });
  });
});

describe("HTTP API", () => {
  it("serves config and availability", async () => {
    const config = await call("GET", "/config");
    expect(config.json.services.map((s: { id: string }) => s.id)).toEqual(["face", "body"]);
    expect(config.json).not.toHaveProperty("notifyEmails");

    await book(at(MON, "10:00"));
    const av = await call("GET", "/availability", { query: { service: "face", from: MON, to: MON } });
    expect(av.status).toBe(200);
    const times = av.json.slots[MON].map((s: string) => new Intl.DateTimeFormat("fr", { timeZone: TZ, timeStyle: "short" }).format(new Date(s)));
    // 9:00 would leave no 15 min gap before 10:00; 10:00–11:15 is taken; 11:30 wouldn't end by 12:00.
    expect(times).toEqual(["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]);

    expect((await call("GET", "/availability", { query: { service: "face", from: MON, to: "2027-06-01" } })).status).toBe(400);
  });

  it("books, then the client cancels and reschedules with the link", async () => {
    const r = await call("POST", "/bookings", { body: { ...bookInput(at(MON, "10:00")), startedAt: now - 60_000 } });
    expect(r.status).toBe(200);
    const token = r.json.token as string;
    expect(r.json.booking).toMatchObject({ status: "confirmed", canCancel: true, where: "Melun" });

    const view = await call("GET", "/manage", { query: { t: token } });
    expect(view.json.booking.clientName).toBe("Ana Martin");

    // The client's own slot is offered again when rescheduling.
    const av = await call("GET", "/manage/availability", { query: { t: token, from: MON, to: MON } });
    expect(av.json.slots[MON]).toContain(at(MON, "10:00"));

    sent.length = 0;
    const moved = await call("POST", "/manage/reschedule", { body: { token, start: at(MON, "16:00") } });
    expect(moved.json.booking.start).toBe(at(MON, "16:00"));
    expect(sent.map((m) => [m.to[0], m.subject]).sort()).toEqual([
      ["ana@example.com", "Rendez-vous déplacé — Soin visage, lundi 19 octobre à 16:00"],
      ["owner@studio.test", "Rendez-vous déplacé — Ana Martin · lundi 19 octobre à 16:00"],
    ]);
    // The old slot is free again.
    expect((await book(at(MON, "10:00"), { client: { ...client, email: "bob@example.com" } })).booking.status).toBe("confirmed");

    // Too late: less than 24 h before.
    now = Date.parse(at(MON, "08:00"));
    expect((await call("POST", "/manage/cancel", { body: { token } })).json.error).toBe("too_late");
    now = Date.parse("2026-10-12T08:00:00Z");
    const cancelled = await call("POST", "/manage/cancel", { body: { token } });
    expect(cancelled.json.booking).toMatchObject({ status: "cancelled", canCancel: false });
  });

  it("drops spam silently and validates payloads", async () => {
    const spam = await call("POST", "/bookings", { body: { ...bookInput(at(MON, "10:00")), website: "x" } });
    expect(spam.json).toEqual({ ok: true, booking: null });
    expect((await db().collection(COL.bookings).get()).size).toBe(0);

    const bad = await call("POST", "/bookings", { body: { ...bookInput(at(MON, "10:00")), client: { ...client, email: "nope" } } });
    expect(bad.status).toBe(400);
    expect(bad.json.details.fields).toContain("client.email");
  });

  it("protects admin routes", async () => {
    expect((await call("GET", "/admin/me")).status).toBe(401);

    const auth = getAuth();
    for (const email of ["owner@studio.test", "intruder@studio.test"]) {
      await auth.createUser({ email, password: "secret123", emailVerified: true }).catch(() => undefined);
    }
    const signIn = async (email: string) => {
      const r = await realFetch(
        `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "secret123", returnSecureToken: true }) },
      );
      return ((await r.json()) as { idToken: string }).idToken;
    };
    expect((await call("GET", "/admin/me", { token: await signIn("intruder@studio.test") })).status).toBe(403);

    const token = await signIn("owner@studio.test");
    expect((await call("GET", "/admin/me", { token })).json).toMatchObject({ ok: true, email: "owner@studio.test" });

    // Admin books by phone on a Saturday (outside opening hours), without e-mail.
    const sat = "2026-10-24";
    const created = await call("POST", "/admin/bookings", {
      token,
      body: { serviceId: "face", start: at(sat, "10:00"), client: { name: "Phone Client", phone: "0600000000" } },
    });
    expect(created.json.booking).toMatchObject({ status: "confirmed", source: "admin" });
    const conflict = await call("POST", "/admin/bookings", {
      token,
      body: { serviceId: "face", start: at(sat, "10:30"), client: { name: "Other" } },
    });
    expect(conflict.json.error).toBe("slot_taken");
    const forced = await call("POST", "/admin/bookings", {
      token,
      body: { serviceId: "face", start: at(sat, "10:30"), client: { name: "Other" }, force: true },
    });
    expect(forced.status).toBe(200);

    const id = created.json.booking.id;
    const moved = await call("POST", `/admin/bookings/${id}/move`, { token, body: { start: at(sat, "14:00") } });
    expect(moved.json.booking.start).toBe(at(sat, "14:00"));
    const done = await call("POST", `/admin/bookings/${id}/status`, { token, body: { status: "completed" } });
    expect(done.json.booking.status).toBe("completed");
    const slots = await call("GET", "/admin/slots", { token, query: { service: "face", from: sat, to: sat } });
    expect(slots.json.slots[sat]).toBeUndefined(); // Saturday is closed in the weekly hours…
  });
});

describe("scheduled jobs", () => {
  it("sends each reminder once and completes past appointments", async () => {
    const { booking } = await book(at(MON, "10:00"));
    const { booking: past } = await book(at("2026-10-13", "10:00"));
    sent.length = 0;

    now = Date.parse(at("2026-10-18", "12:00"));
    expect(await runScheduledJobs(ctx)).toEqual({ reminded: 1, completed: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toContain("Rappel");
    expect(await runScheduledJobs(ctx)).toEqual({ reminded: 0, completed: 0 });

    const p = (await db().collection(COL.bookings).doc(past.id).get()).data() as Booking;
    expect(p.status).toBe("completed");
    const b = (await db().collection(COL.bookings).doc(booking.id).get()).data() as Booking;
    expect(b.reminderSentAt).toBeTruthy();
  });

  it("skips the reminder when booked inside the reminder window", async () => {
    now = Date.parse(at("2026-10-18", "18:00"));
    await book(at(MON, "10:00"));
    sent.length = 0;
    expect((await runScheduledJobs(ctx)).reminded).toBe(0);
    expect(sent).toHaveLength(0);
  });
});
