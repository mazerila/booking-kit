/**
 * Cloud Functions of the booking module. In the client site's functions/src/index.ts:
 *
 *   import { createBookingFunctions } from "@mazerila/booking-kit/functions";
 *   export const { bookingApi, bookingJobs } = createBookingFunctions({
 *     siteUrl: "https://example.fr",
 *     mailFrom: "Studio <rdv@example.fr>",
 *     managePath: { fr: "/rdv/", en: "/en/appointment/" },
 *   });
 *
 * Secret: firebase functions:secrets:set RESEND_API_KEY
 */
import { onRequest } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/scheduler";
import type { Ctx } from "./actions.js";
import { createApiHandler } from "./api.js";
import { frenchGeocoder, type Geocoder } from "./geocode.js";
import { runScheduledJobs } from "./jobs.js";

/** A plain string or a Firebase param (`defineString("SITE_URL")`). */
type StringLike = string | { value(): string };
const read = (v: StringLike) => (typeof v === "string" ? v : v.value());

export type BookingFunctionsOptions = {
  /** Public origin of the site, used in e-mail links. */
  siteUrl: StringLike;
  /** Sender on a Resend-verified domain: "Studio <rdv@example.fr>". */
  mailFrom: StringLike;
  /** Path of the page rendering <ManageBooking />, per locale or for all. Default "/rdv/". */
  managePath?: string | Record<string, string>;
  /** Path of the page rendering <AdminApp />. Default "/admin/". */
  adminPath?: string;
  /** Public path of this API (the Hosting rewrite). Default "/api/booking". */
  apiPath?: string;
  /** Logo of the e-mails, and a fixed colour (default: the primary colour chosen in the admin). */
  brand?: { color?: string; logoUrl?: string };
  /** "fr" (French address base, default), "none", or your own geocoder. */
  geocoder?: "fr" | "none" | Geocoder;
  region?: string;
  /** Origins allowed to call the API directly (cross-origin). Not needed behind a Hosting rewrite. */
  allowedOrigins?: string[];
  maxInstances?: number;
  /** How often reminders and auto-completion run. Default every 30 minutes. */
  schedule?: string;
};

export function createBookingFunctions(opts: BookingFunctionsOptions) {
  const region = opts.region ?? "europe-west1";
  const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
  const geocoder = opts.geocoder === "none" ? undefined : typeof opts.geocoder === "function" ? opts.geocoder : frenchGeocoder;
  const managePath = (locale: string) =>
    typeof opts.managePath === "string" ? opts.managePath : (opts.managePath?.[locale] ?? Object.values(opts.managePath ?? {})[0] ?? "/rdv/");

  const getCtx = (): Ctx => ({
    mailer: {
      from: read(opts.mailFrom),
      apiKey: (() => {
        try {
          return RESEND_API_KEY.value();
        } catch {
          return "";
        }
      })(),
      url: process.env.RESEND_API_URL,
    },
    siteUrl: read(opts.siteUrl),
    managePath,
    adminPath: opts.adminPath ?? "/admin/",
    apiPath: opts.apiPath ?? "/api/booking",
    brand: opts.brand,
    geocoder,
    now: () => Date.now(),
  });

  const bookingApi = onRequest(
    {
      region,
      secrets: [RESEND_API_KEY],
      maxInstances: opts.maxInstances ?? 5,
      memory: "256MiB",
      timeoutSeconds: 30,
      invoker: "public",
    },
    createApiHandler(getCtx, { allowedOrigins: opts.allowedOrigins }),
  );

  const bookingJobs = onSchedule(
    { region, schedule: opts.schedule ?? "every 30 minutes", secrets: [RESEND_API_KEY], timeoutSeconds: 300, memory: "256MiB" },
    async () => {
      await runScheduledJobs(getCtx());
    },
  );

  return { bookingApi, bookingJobs };
}

export { createApiHandler } from "./api.js";
export { runScheduledJobs } from "./jobs.js";
export { frenchGeocoder, type Geocoder } from "./geocode.js";
export type { Ctx } from "./actions.js";
