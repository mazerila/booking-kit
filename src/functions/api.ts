/**
 * The HTTP API (one Cloud Function). Served same-origin through a Hosting
 * rewrite at /api/booking/**, or directly at the function URL.
 *
 * Public:  GET  /config · GET /availability · GET /geocode · POST /zone · POST /bookings
 *          GET  /manage · GET /manage/availability · GET /manage/ics
 *          POST /manage/cancel · POST /manage/reschedule
 *          GET  /feed.ics?k=… (provider's private calendar, secret key)
 * Admin:   GET  /admin/me · GET /admin/slots · POST /admin/bookings
 *          POST /admin/bookings/:id/status · POST /admin/bookings/:id/move
 *          (admins read and edit everything else directly in Firestore, guarded by the rules)
 */
import type { Request, Response } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { getAuth } from "firebase-admin/auth";
import { z } from "zod";
import {
  buildCalendar,
  buildIcs,
  checkZone,
  COL,
  DAY_MS,
  pick,
  providerEvent,
  resolveAppearance,
  type Booking,
  computeSlots,
  dateRange,
  localDateOf,
  type PublicConfig,
  type SlotMap,
} from "../core/index.js";
import {
  ApiError,
  assertClientCanChange,
  changeStatus,
  clientEvent,
  createBooking,
  findByToken,
  moveBooking,
  publicView,
  type Ctx,
} from "./actions.js";
import { configRef, db, isAdminEmail, loadBusiness, loadBusy, loadExceptions } from "./db.js";
import {
  addressSchema,
  adminBookSchema,
  bookSchema,
  moveSchema,
  rangeSchema,
  rescheduleSchema,
  statusSchema,
  tokenSchema,
} from "./schemas.js";

// Best-effort per-instance throttle.
const hits = new Map<string, number[]>();
function throttled(key: string, max: number, windowMs: number, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > max;
}

function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const r = schema.safeParse(value);
  if (!r.success) throw new ApiError(400, "invalid", { fields: r.error.issues.map((i) => i.path.join(".")) });
  return r.data;
}

const MAX_RANGE_DAYS = 62;

function checkRange(from: string, to: string) {
  if (to < from || dateRange(from, to).length > MAX_RANGE_DAYS) throw new ApiError(400, "invalid", { fields: ["to"] });
}

/** Slots as ISO strings, the wire format. */
const toWire = (slots: SlotMap) => Object.fromEntries(Object.entries(slots).map(([d, s]) => [d, s.map((ms) => new Date(ms).toISOString())]));

async function availability(ctx: Ctx, serviceId: string, from: string, to: string, opts: { excludeId?: string; admin?: boolean } = {}) {
  checkRange(from, to);
  const { settings, weekly, services } = await loadBusiness();
  const service = services.find((s) => s.id === serviceId && (s.active || opts.admin));
  if (!service) throw new ApiError(404, "not_found", { what: "service" });
  const [busy, exceptions] = await Promise.all([loadBusy(settings, from, to), loadExceptions(from, to)]);
  const slots = computeSlots({
    timezone: settings.timezone,
    weekly,
    exceptions,
    busy,
    rules: settings.rules,
    service,
    from,
    to,
    now: ctx.now(),
    excludeId: opts.excludeId,
    ignoreLimits: opts.admin,
  });
  return { timezone: settings.timezone, slots: toWire(slots) };
}

async function requireAdmin(req: Request) {
  const header = req.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new ApiError(401, "unauthorized");
  try {
    const decoded = await getAuth().verifyIdToken(token);
    if (decoded.email_verified === false || !(await isAdminEmail(decoded.email))) throw new ApiError(403, "unauthorized");
    return decoded;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(401, "unauthorized");
  }
}

export type ApiOptions = {
  /** Origins allowed to call the API cross-origin (not needed behind a Hosting rewrite). */
  allowedOrigins?: string[];
};

export function createApiHandler(getCtx: () => Ctx, opts: ApiOptions = {}) {
  return async (req: Request, res: Response) => {
    const origin = req.get("origin");
    if (origin && opts.allowedOrigins?.includes(origin)) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    // "/api/booking/availability" behind Hosting, "/availability" at the function URL.
    const path = req.path.replace(/^.*\/api\/booking(?=\/|$)/, "").replace(/\/+$/, "") || "/";
    const ip = req.ip ?? "unknown";
    const q = req.query as Record<string, string | undefined>;
    const ctx = getCtx();

    try {
      const route = `${req.method} ${path}`;
      let m: RegExpMatchArray | null;

      if (route === "GET /config") {
        const { settings, services, categories } = await loadBusiness();
        const config: PublicConfig = {
          businessName: settings.businessName,
          timezone: settings.timezone,
          defaultLocale: settings.defaultLocale,
          locales: settings.locales,
          currency: settings.currency,
          contact: settings.contact,
          baseAddress: settings.base.address,
          zone: { mode: settings.zone.mode, outOfZone: settings.zone.outOfZone, message: settings.zone.message },
          rules: { maxAdvanceDays: settings.rules.maxAdvanceDays },
          policies: settings.policies,
          fields: settings.fields,
          categories,
          services: services.filter((s) => s.active),
          geocoding: !!ctx.geocoder,
          theme: resolveAppearance(settings.appearance),
        };
        res.set("Cache-Control", "public, max-age=30");
        res.json(config);
        return;
      }

      if (route === "GET /availability") {
        const { from, to } = parse(rangeSchema, q);
        res.set("Cache-Control", "no-store");
        res.json(await availability(ctx, String(q.service ?? ""), from, to));
        return;
      }

      if (route === "GET /geocode") {
        if (!ctx.geocoder) throw new ApiError(404, "not_found");
        if (throttled(`geo:${ip}`, 60, 60_000)) throw new ApiError(429, "rate");
        const query = String(q.q ?? "").trim().slice(0, 200);
        if (query.length < 3) {
          res.json({ results: [] });
          return;
        }
        const { settings } = await loadBusiness();
        const results = await ctx.geocoder(query, { limit: 5, near: settings.base }).catch((err) => {
          logger.warn("booking: geocoder failed", { err: String(err) });
          return [];
        });
        res.json({ results: results.map((a) => ({ ...a, ...checkZone(settings.zone, settings.base, a) })) });
        return;
      }

      if (route === "POST /zone") {
        const address = parse(addressSchema, req.body);
        const { settings } = await loadBusiness();
        res.json(checkZone(settings.zone, settings.base, address));
        return;
      }

      if (route === "POST /bookings") {
        if (throttled(`book:${ip}`, 8, 10 * 60_000)) throw new ApiError(429, "rate");
        const input = parse(bookSchema, req.body);
        const elapsed = input.startedAt ? ctx.now() - input.startedAt : Infinity;
        if (input.website || elapsed < 3_000) {
          // Pretend success so bots learn nothing.
          logger.info("booking: dropped as spam");
          res.json({ ok: true, booking: null });
          return;
        }
        const { booking, settings } = await createBooking(ctx, { by: "client", input });
        res.json({ ok: true, booking: publicView(booking, settings, ctx.now()), token: booking.manageToken });
        return;
      }

      if (route === "GET /manage") {
        const { token } = parse(tokenSchema, { token: q.t ?? q.token });
        const { settings } = await loadBusiness();
        const b = await findByToken(token);
        res.set("Cache-Control", "no-store");
        res.json({ booking: publicView(b, settings, ctx.now()) });
        return;
      }

      if (route === "GET /manage/availability") {
        const { token } = parse(tokenSchema, { token: q.t ?? q.token });
        const { from, to } = parse(rangeSchema, q);
        const b = await findByToken(token);
        res.set("Cache-Control", "no-store");
        res.json(await availability(ctx, b.serviceId, from, to, { excludeId: b.id }));
        return;
      }

      if (route === "GET /manage/ics") {
        const { token } = parse(tokenSchema, { token: q.t ?? q.token });
        const { settings } = await loadBusiness();
        const b = await findByToken(token);
        const ics = buildIcs({ ...clientEvent(ctx, settings, b), sequence: b.history.length }, ctx.now());
        res.set("Content-Type", "text/calendar; charset=utf-8");
        res.set("Content-Disposition", 'attachment; filename="rendez-vous.ics"');
        res.set("Cache-Control", "no-store");
        res.send(ics);
        return;
      }

      // The provider's private calendar subscription (secret key from the admin).
      if (route === "GET /feed" || route === "GET /feed.ics") {
        const key = String(q.k ?? "");
        const stored = (await configRef("feed").get()).data()?.key as string | undefined;
        if (!stored || key.length < 20 || key !== stored) throw new ApiError(404, "not_found");
        const { settings } = await loadBusiness();
        const now = ctx.now();
        const snap = await db()
          .collection(COL.bookings)
          .where("start", ">=", new Date(now - 60 * DAY_MS).toISOString())
          .where("start", "<=", new Date(now + 400 * DAY_MS).toISOString())
          .get();
        const fieldLabels = Object.fromEntries(settings.fields.map((f) => [f.id, pick(f.label, settings.defaultLocale, settings.defaultLocale)]));
        const adminBase = `${ctx.siteUrl.replace(/\/$/, "")}${ctx.adminPath}#/booking/`;
        const events = snap.docs
          .map((d) => d.data() as Booking)
          .filter((b) => b.status === "pending" || b.status === "confirmed" || b.status === "completed")
          .map((b) => providerEvent(b, { locale: settings.defaultLocale, defaultLocale: settings.defaultLocale, adminUrl: adminBase + b.id, fieldLabels }));
        res.set("Content-Type", "text/calendar; charset=utf-8");
        res.set("Cache-Control", "private, max-age=300");
        res.send(buildCalendar(events, { name: settings.businessName || "Rendez-vous", refreshMinutes: 30 }, now));
        return;
      }

      if (route === "POST /manage/cancel") {
        const { token } = parse(tokenSchema, req.body);
        const { settings } = await loadBusiness();
        const b = await findByToken(token);
        assertClientCanChange(b, settings, ctx.now(), "cancel");
        const r = await changeStatus(ctx, b.id, "cancelled", { by: "client", notify: true });
        res.json({ ok: true, booking: publicView(r.booking, r.settings, ctx.now()) });
        return;
      }

      if (route === "POST /manage/reschedule") {
        const { token, start } = parse(rescheduleSchema, req.body);
        const { settings } = await loadBusiness();
        const b = await findByToken(token);
        assertClientCanChange(b, settings, ctx.now(), "reschedule");
        const r = await moveBooking(ctx, b.id, start, { by: "client", notify: true });
        res.json({ ok: true, booking: publicView(r.booking, r.settings, ctx.now()) });
        return;
      }

      // ---- Admin ----
      if (path.startsWith("/admin/")) {
        const user = await requireAdmin(req);

        if (route === "GET /admin/me") {
          res.json({ ok: true, email: user.email });
          return;
        }

        if (route === "GET /admin/slots") {
          const { from, to } = parse(rangeSchema, q);
          res.json(await availability(ctx, String(q.service ?? ""), from, to, { admin: true, excludeId: q.exclude || undefined }));
          return;
        }

        if (route === "POST /admin/bookings") {
          const input = parse(adminBookSchema, req.body);
          const { booking } = await createBooking(ctx, { by: "admin", input });
          res.json({ ok: true, booking });
          return;
        }

        if ((m = route.match(/^POST \/admin\/bookings\/([\w-]+)\/status$/))) {
          const input = parse(statusSchema, req.body);
          const { booking } = await changeStatus(ctx, m[1]!, input.status, { by: "admin", notify: input.notify, note: input.note });
          res.json({ ok: true, booking });
          return;
        }

        if ((m = route.match(/^POST \/admin\/bookings\/([\w-]+)\/move$/))) {
          const input = parse(moveSchema, req.body);
          const { booking } = await moveBooking(ctx, m[1]!, input.start, { by: "admin", notify: input.notify, force: input.force });
          res.json({ ok: true, booking });
          return;
        }
      }

      throw new ApiError(404, "not_found");
    } catch (err) {
      if (err instanceof ApiError) {
        res.status(err.status).json({ ok: false, error: err.code, details: err.details });
        return;
      }
      logger.error("booking: unexpected error", { path, err: err instanceof Error ? err.stack : String(err) });
      res.status(500).json({ ok: false, error: "server" });
    }
  };
}
