/** Request payloads, validated with zod. */
import { z } from "zod";
import { EMAIL_RE, PHONE_RE } from "../core/index.js";

const name = z.string().trim().min(2).max(100);
const email = z.string().trim().toLowerCase().max(200).regex(EMAIL_RE);
const phone = z.string().trim().regex(PHONE_RE);
const instant = z.iso.datetime({ offset: true }).transform((s) => new Date(s).toISOString());
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const addressSchema = z.object({
  label: z.string().trim().min(3).max(300),
  postcode: z.string().trim().max(12).optional(),
  city: z.string().trim().max(100).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const bookSchema = z.object({
  serviceId: z.string().min(1).max(100),
  start: instant,
  client: z.object({ name, email, phone }),
  address: addressSchema.optional(),
  fields: z.record(z.string(), z.unknown()).default({}),
  message: z.string().trim().max(2000).optional(),
  locale: z.string().max(10).default("fr"),
  /** Honeypot, hidden from humans. */
  website: z.string().optional(),
  /** When the form was opened (ms), to drop instant bot submissions. */
  startedAt: z.number().optional(),
});

export const adminBookSchema = z.object({
  serviceId: z.string().min(1).max(100),
  start: instant,
  client: z.object({
    name,
    email: z.union([email, z.literal("")]).default(""),
    phone: z.union([phone, z.literal("")]).default(""),
  }),
  address: addressSchema.optional(),
  fields: z.record(z.string(), z.unknown()).default({}),
  message: z.string().trim().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  locale: z.string().max(10).optional(),
  status: z.enum(["pending", "confirmed"]).default("confirmed"),
  notify: z.boolean().default(false),
  force: z.boolean().default(false),
});

export const statusSchema = z.object({
  status: z.enum(["confirmed", "declined", "cancelled", "completed", "no_show"]),
  notify: z.boolean().default(true),
  note: z.string().max(1000).optional(),
});

export const moveSchema = z.object({
  start: instant,
  notify: z.boolean().default(true),
  force: z.boolean().default(false),
});

export const tokenSchema = z.object({ token: z.string().min(16).max(100) });
export const rescheduleSchema = tokenSchema.extend({ start: instant });

export const rangeSchema = z.object({ from: localDate, to: localDate });

export type BookInput = z.infer<typeof bookSchema>;
export type AdminBookInput = z.infer<typeof adminBookSchema>;
