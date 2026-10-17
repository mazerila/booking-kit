/**
 * Booking operations shared by the public API, the admin API and the
 * scheduled job. Every write that changes the calendar runs in a transaction
 * that first reads the lock document of the affected day(s), so two requests
 * for the same day are serialized and can't both take the same slot.
 */
import { createHash, randomBytes } from "node:crypto";
import * as logger from "firebase-functions/logger";
import {
  ACTIVE_STATUSES,
  appointmentEvent,
  buildIcs,
  calendarLinks,
  resolveAppearance,
  checkZone,
  COL,
  collides,
  fieldsFor,
  isSlotAvailable,
  localDateOf,
  MINUTE,
  pick,
  renderEmail,
  serviceBuffers,
  validateFields,
  type Address,
  type Booking,
  type BookingStatus,
  type Client,
  type EmailKind,
  type HistoryEntry,
  type PublicBooking,
  type Service,
  type Settings,
} from "../core/index.js";
import { db, loadBusiness, loadBusy, loadExceptions } from "./db.js";
import type { Geocoder } from "./geocode.js";
import { sendMail, type MailerConfig } from "./mailer.js";
import type { AdminBookInput, BookInput } from "./schemas.js";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(code);
  }
}

export type Ctx = {
  mailer: MailerConfig;
  /** Public site origin, e.g. https://leyalinetouch.fr */
  siteUrl: string;
  /** Path of the manage page for a locale, e.g. "/rdv/" or "/en/appointment/". */
  managePath: (locale: string) => string;
  adminPath: string;
  /** Public path of the API (Hosting rewrite), for links in e-mails. Default "/api/booking". */
  apiPath?: string;
  brand?: { color?: string; logoUrl?: string };
  geocoder?: Geocoder;
  now: () => number;
};

const iso = (ms: number) => new Date(ms).toISOString();

export const clientIdOf = (c: { email?: string; phone?: string; name: string }) =>
  createHash("sha256")
    .update((c.email || c.phone?.replace(/\D/g, "") || c.name).toLowerCase())
    .digest("hex")
    .slice(0, 24);

export const newToken = () => randomBytes(24).toString("base64url");

export function manageUrl(ctx: Ctx, b: Booking) {
  if (!b.manageToken) return undefined;
  return `${ctx.siteUrl.replace(/\/$/, "")}${ctx.managePath(b.locale)}?t=${b.manageToken}`;
}

const origin = (ctx: Ctx) => ctx.siteUrl.replace(/\/$/, "");

/** Direct download of the booking's calendar file (link in e-mails). */
export function icsUrl(ctx: Ctx, b: Booking) {
  return b.manageToken ? `${origin(ctx)}${ctx.apiPath ?? "/api/booking"}/manage/ics?t=${b.manageToken}` : undefined;
}

/** The client's calendar event for a booking. */
export function clientEvent(ctx: Ctx, settings: Settings, b: Booking, locale = b.locale) {
  return appointmentEvent(b, {
    businessName: settings.businessName,
    locale,
    defaultLocale: settings.defaultLocale,
    where: publicView(b, settings, ctx.now()).where,
    manageUrl: manageUrl(ctx, b),
    phone: settings.contact.phone,
    email: settings.contact.email,
  });
}

export function publicView(b: Booking, settings: Settings, now: number): PublicBooking {
  const changeUntil = Date.parse(b.start) - settings.policies.changeUntilHours * 60 * MINUTE;
  const open = ACTIVE_STATUSES.includes(b.status) && now < changeUntil;
  return {
    id: b.id,
    serviceId: b.serviceId,
    status: b.status,
    service: b.service,
    start: b.start,
    end: b.end,
    where:
      b.service.location === "home" ? b.address?.label : b.service.location === "studio" ? settings.base.address : undefined,
    clientName: b.client.name,
    locale: b.locale,
    canCancel: open && settings.policies.allowClientCancel,
    canReschedule: open && settings.policies.allowClientReschedule,
    changeUntil: iso(changeUntil),
  };
}

/** E-mails for an event: to the client, and/or an alert to the provider. */
export async function notify(
  ctx: Ctx,
  settings: Settings,
  b: Booking,
  kinds: EmailKind[],
  extra: { previousStart?: string } = {},
) {
  // The look chosen in the admin colours the e-mails too, unless the code sets a brand colour.
  const brand = { ...ctx.brand, color: ctx.brand?.color ?? resolveAppearance(settings.appearance)?.primary };
  const tasks = kinds.map(async (kind) => {
    const admin = kind.startsWith("admin");
    const to = admin ? settings.notifyEmails : b.client.email ? [b.client.email] : [];
    if (!to.length) return;
    const locale = admin ? settings.defaultLocale : b.locale;
    const event = clientEvent(ctx, settings, b, locale);
    const mail = renderEmail({
      kind,
      locale,
      settings,
      booking: b,
      manageUrl: manageUrl(ctx, b),
      adminUrl: `${origin(ctx)}${ctx.adminPath}#/booking/${b.id}`,
      previousStart: extra.previousStart,
      brand,
      calendarLinks: calendarLinks(event, icsUrl(ctx, b)),
    });
    const withIcs = !admin && (kind === "confirmed" || kind === "rescheduled" || kind === "cancelled");
    await sendMail(
      ctx.mailer,
      {
        ...mail,
        to,
        replyTo: admin ? b.client.email || undefined : settings.contact.email,
        attachments: withIcs
          ? [
              {
                filename: "rendez-vous.ics",
                contentType: "text/calendar",
                content: buildIcs({ ...event, status: kind === "cancelled" ? "CANCELLED" : "CONFIRMED", sequence: b.history.length }, ctx.now()),
              },
            ]
          : undefined,
      },
      { kind, bookingId: b.id },
    );
  });
  // E-mail problems never undo a booking; they are logged in mailLog.
  const results = await Promise.allSettled(tasks);
  for (const r of results) if (r.status === "rejected") logger.error("booking: notify failed", { err: String(r.reason) });
}

async function resolveAddress(ctx: Ctx, address: Address | undefined, near: Settings["base"]): Promise<Address | undefined> {
  if (!address || (address.lat != null && address.lng != null) || !ctx.geocoder) return address;
  try {
    const [hit] = await ctx.geocoder(address.label, { limit: 1, near });
    return hit ? { ...address, lat: hit.lat, lng: hit.lng, postcode: address.postcode ?? hit.postcode, city: address.city ?? hit.city } : address;
  } catch (err) {
    logger.warn("booking: geocoding failed", { err: String(err) });
    return address;
  }
}

function findService(services: Service[], id: string, adminMode: boolean) {
  const s = services.find((x) => x.id === id);
  if (!s || (!s.active && !adminMode)) throw new ApiError(404, "not_found", { what: "service" });
  return s;
}

type CreateOptions =
  | { by: "client"; input: BookInput }
  | { by: "admin"; input: AdminBookInput };

export async function createBooking(ctx: Ctx, opts: CreateOptions) {
  const { settings, weekly, services } = await loadBusiness();
  const { input, by } = opts;
  const admin = by === "admin";
  const service = findService(services, input.serviceId, admin);
  const now = ctx.now();
  const start = Date.parse(input.start);
  const end = start + service.durationMin * MINUTE;
  const date = localDateOf(start, settings.timezone);

  const defs = fieldsFor(settings.fields, service);
  const { values, invalid } = validateFields(defs, input.fields);
  // The provider may skip questions when booking by phone.
  if (invalid.length && !admin) throw new ApiError(400, "invalid", { fields: invalid.map((f) => `fields.${f}`) });

  let address: Address | undefined;
  let zone: { inZone: boolean | null; distanceKm?: number } = { inZone: true };
  if (service.location === "home") {
    if (!input.address && !admin) throw new ApiError(400, "invalid", { fields: ["address"] });
    address = await resolveAddress(ctx, input.address, settings.base);
    if (address) zone = checkZone(settings.zone, settings.base, address);
    if (zone.inZone === false && !admin && settings.zone.outOfZone === "block") {
      throw new ApiError(422, "out_of_zone", { distanceKm: zone.distanceKm });
    }
  }

  let status: BookingStatus;
  if (admin) status = (input as AdminBookInput).status;
  else status = settings.policies.confirmation === "request" || zone.inZone === false ? "pending" : "confirmed";

  const ref = db().collection(COL.bookings).doc();
  const { before, after } = serviceBuffers(service, settings.rules);
  const client = { name: input.client.name, email: input.client.email, phone: input.client.phone };
  const clientId = clientIdOf(client);
  const history: HistoryEntry[] = [{ at: iso(now), action: "created", by }];
  if (status === "confirmed") history.push({ at: iso(now), action: "confirmed", by: admin ? "admin" : "system" });

  const booking: Booking = {
    id: ref.id,
    serviceId: service.id,
    service: { name: service.name, durationMin: service.durationMin, price: service.price, location: service.location },
    start: iso(start),
    end: iso(end),
    date,
    bufferBeforeMin: before,
    bufferAfterMin: after,
    status,
    client,
    clientId,
    address,
    distanceKm: zone.distanceKm,
    outOfZone: zone.inZone === false ? true : undefined,
    fields: values,
    message: input.message || undefined,
    locale: input.locale && settings.locales.includes(input.locale) ? input.locale : settings.defaultLocale,
    source: admin ? "admin" : "web",
    notes: admin ? (input as AdminBookInput).notes : undefined,
    manageToken: client.email ? newToken() : undefined,
    createdAt: iso(now),
    updatedAt: iso(now),
    history,
  };

  await db().runTransaction(async (tx) => {
    const lockRef = db().collection(COL.locks).doc(date);
    const clientRef = db().collection(COL.clients).doc(clientId);
    await tx.get(lockRef);
    const [busy, exceptions, clientSnap] = await Promise.all([
      loadBusy(settings, date, date, tx),
      loadExceptions(date, date, tx),
      tx.get(clientRef),
    ]);

    if (admin) {
      if (!(input as AdminBookInput).force && collides(start, end, before, after, busy)) throw new ApiError(409, "slot_taken");
    } else {
      const ok = isSlotAvailable({ timezone: settings.timezone, weekly, exceptions, busy, rules: settings.rules, service, now }, start);
      if (!ok) throw new ApiError(409, "slot_taken");
    }

    const prev = clientSnap.exists ? (clientSnap.data() as Client) : undefined;
    const clientDoc: Client = {
      id: clientId,
      name: client.name,
      email: client.email || prev?.email || "",
      phone: client.phone || prev?.phone || "",
      notes: prev?.notes,
      bookingCount: (prev?.bookingCount ?? 0) + 1,
      firstBookingAt: prev?.firstBookingAt ?? iso(now),
      lastBookingAt: iso(now),
      lastAddress: address ?? prev?.lastAddress,
    };
    tx.set(lockRef, { updatedAt: iso(now) });
    tx.set(ref, booking);
    tx.set(clientRef, clientDoc);
  });

  logger.info("booking: created", { id: booking.id, by, status, date });
  const sendToClient = !admin || (input as AdminBookInput).notify;
  const kinds: EmailKind[] = [];
  if (sendToClient) kinds.push(status === "pending" ? "requested" : "confirmed");
  if (!admin) kinds.push("adminNew");
  await notify(ctx, settings, booking, kinds);
  return { booking, settings };
}

export async function getBooking(id: string) {
  const snap = await db().collection(COL.bookings).doc(id).get();
  if (!snap.exists) throw new ApiError(404, "not_found");
  return snap.data() as Booking;
}

export async function findByToken(token: string) {
  const snap = await db().collection(COL.bookings).where("manageToken", "==", token).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) throw new ApiError(404, "not_found");
  return doc.data() as Booking;
}

const STATUS_ACTION: Record<BookingStatus, HistoryEntry["action"]> = {
  pending: "edited",
  confirmed: "confirmed",
  declined: "declined",
  cancelled: "cancelled",
  completed: "completed",
  no_show: "no_show",
};

/** Which status changes make sense, from each status. */
const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "declined", "cancelled"],
  confirmed: ["cancelled", "completed", "no_show"],
  completed: ["confirmed", "no_show"],
  no_show: ["confirmed", "completed"],
  cancelled: [],
  declined: [],
};

export async function changeStatus(
  ctx: Ctx,
  id: string,
  status: BookingStatus,
  opts: { by: "client" | "admin" | "system"; notify: boolean; note?: string },
) {
  const { settings } = await loadBusiness();
  const now = ctx.now();
  const ref = db().collection(COL.bookings).doc(id);
  let updated!: Booking;
  let previous!: BookingStatus;
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError(404, "not_found");
    const b = snap.data() as Booking;
    previous = b.status;
    if (!TRANSITIONS[b.status].includes(status)) throw new ApiError(409, "not_allowed", { from: b.status, to: status });
    updated = {
      ...b,
      status,
      updatedAt: iso(now),
      history: [...b.history, { at: iso(now), action: STATUS_ACTION[status], by: opts.by, note: opts.note }],
    };
    tx.set(ref, updated);
  });

  const kinds: EmailKind[] = [];
  if (opts.notify) {
    if (status === "confirmed" && previous === "pending") kinds.push("confirmed");
    if (status === "declined") kinds.push("declined");
    if (status === "cancelled") kinds.push("cancelled");
  }
  if (opts.by === "client" && status === "cancelled") kinds.push("adminCancelled");
  await notify(ctx, settings, updated, kinds);
  return { booking: updated, settings };
}

export async function moveBooking(
  ctx: Ctx,
  id: string,
  newStartIso: string,
  opts: { by: "client" | "admin"; notify: boolean; force?: boolean },
) {
  const { settings, weekly, services } = await loadBusiness();
  const now = ctx.now();
  const current = await getBooking(id);
  if (!ACTIVE_STATUSES.includes(current.status)) throw new ApiError(409, "not_allowed");

  const start = Date.parse(newStartIso);
  const end = start + current.service.durationMin * MINUTE;
  const oldDate = current.date;
  const newDate = localDateOf(start, settings.timezone);
  const ref = db().collection(COL.bookings).doc(id);
  const service = services.find((s) => s.id === current.serviceId) ?? {
    durationMin: current.service.durationMin,
    bufferBeforeMin: current.bufferBeforeMin,
    bufferAfterMin: current.bufferAfterMin,
    location: current.service.location,
  };

  let updated!: Booking;
  await db().runTransaction(async (tx) => {
    const locks = [...new Set([oldDate, newDate])].sort().map((d) => db().collection(COL.locks).doc(d));
    for (const l of locks) await tx.get(l);
    const snap = await tx.get(ref);
    const b = snap.data() as Booking;
    if (!ACTIVE_STATUSES.includes(b.status)) throw new ApiError(409, "not_allowed");
    const [busy, exceptions] = await Promise.all([loadBusy(settings, newDate, newDate, tx), loadExceptions(newDate, newDate, tx)]);
    const others = busy.filter((x) => x.id !== id);

    if (opts.by === "admin") {
      if (!opts.force && collides(start, end, b.bufferBeforeMin, b.bufferAfterMin, others)) throw new ApiError(409, "slot_taken");
    } else {
      const ok = isSlotAvailable(
        {
          timezone: settings.timezone,
          weekly,
          exceptions,
          busy,
          rules: settings.rules,
          service: { ...service, durationMin: b.service.durationMin },
          now,
          excludeId: id,
        },
        start,
      );
      if (!ok) throw new ApiError(409, "slot_taken");
    }

    updated = {
      ...b,
      start: iso(start),
      end: iso(end),
      date: newDate,
      reminderSentAt: undefined,
      updatedAt: iso(now),
      history: [...b.history, { at: iso(now), action: "rescheduled", by: opts.by, note: `${b.start} → ${iso(start)}` }],
    };
    for (const l of locks) tx.set(l, { updatedAt: iso(now) });
    tx.set(ref, updated);
  });

  const kinds: EmailKind[] = [];
  if (opts.notify) kinds.push("rescheduled");
  if (opts.by === "client") kinds.push("adminRescheduled");
  await notify(ctx, settings, updated, kinds, { previousStart: current.start });
  return { booking: updated, settings };
}

/** Client self-service: checks the policy window before cancelling or moving. */
export function assertClientCanChange(b: Booking, settings: Settings, now: number, what: "cancel" | "reschedule") {
  const view = publicView(b, settings, now);
  if (!ACTIVE_STATUSES.includes(b.status)) throw new ApiError(409, "not_allowed");
  if (what === "cancel" ? !settings.policies.allowClientCancel : !settings.policies.allowClientReschedule) {
    throw new ApiError(403, "not_allowed");
  }
  if (!(what === "cancel" ? view.canCancel : view.canReschedule)) throw new ApiError(409, "too_late");
}
