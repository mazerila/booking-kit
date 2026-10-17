/**
 * E-mail rendering (pure). Built-in texts per kind and locale; the provider
 * can override subject and body per kind in the admin (`Settings.emailTexts`).
 * Bodies are plain text with {placeholders}; the layout, details table and
 * button are added around them.
 */
import { fill, formatDate, formatDuration, formatPrice, formatTime, pick } from "./format.js";
import type { CalendarLinks } from "./calendar.js";
import { readableOn } from "./theme.js";
import type { Booking, EmailKind, EmailText, Settings } from "./types.js";

export const EMAIL_PLACEHOLDERS = [
  "name",
  "service",
  "date",
  "time",
  "duration",
  "price",
  "address",
  "business",
  "previousDate",
  "previousTime",
] as const;

type Texts = Record<EmailKind, EmailText & { subject: string; body: string; button?: string }>;

const fr: Texts = {
  confirmed: {
    subject: "Rendez-vous confirmé — {service}, {date} à {time}",
    body: "Bonjour {name},\n\nVotre rendez-vous est confirmé. Vous trouverez le récapitulatif ci-dessous et l'invitation en pièce jointe pour l'ajouter à votre agenda.\n\nÀ très bientôt,\n{business}",
    button: "Gérer mon rendez-vous",
  },
  requested: {
    subject: "Demande de rendez-vous reçue — {service}, {date} à {time}",
    body: "Bonjour {name},\n\nMerci pour votre demande. Elle sera confirmée très vite : vous recevrez un e-mail dès qu'elle sera validée.\n\n{business}",
    button: "Voir ma demande",
  },
  declined: {
    subject: "Votre demande de rendez-vous du {date}",
    body: "Bonjour {name},\n\nMalheureusement, ce créneau n'est pas disponible. N'hésitez pas à choisir une autre date ou à me contacter directement.\n\n{business}",
  },
  cancelled: {
    subject: "Rendez-vous annulé — {service}, {date} à {time}",
    body: "Bonjour {name},\n\nVotre rendez-vous du {date} à {time} est annulé.\n\nAu plaisir de vous retrouver prochainement,\n{business}",
  },
  rescheduled: {
    subject: "Rendez-vous déplacé — {service}, {date} à {time}",
    body: "Bonjour {name},\n\nVotre rendez-vous a été déplacé au {date} à {time} (au lieu du {previousDate} à {previousTime}). L'invitation mise à jour est en pièce jointe.\n\n{business}",
    button: "Gérer mon rendez-vous",
  },
  reminder: {
    subject: "Rappel — votre rendez-vous {date} à {time}",
    body: "Bonjour {name},\n\nPetit rappel de votre rendez-vous {service} le {date} à {time}.\n\nÀ bientôt,\n{business}",
    button: "Gérer mon rendez-vous",
  },
  adminNew: {
    subject: "Nouveau rendez-vous — {name} · {service}, {date} à {time}",
    body: "Nouvelle réservation de {name}.",
    button: "Ouvrir l'agenda",
  },
  adminCancelled: {
    subject: "Annulation — {name} · {date} à {time}",
    body: "{name} a annulé son rendez-vous {service} du {date} à {time}.",
    button: "Ouvrir l'agenda",
  },
  adminRescheduled: {
    subject: "Rendez-vous déplacé — {name} · {date} à {time}",
    body: "{name} a déplacé son rendez-vous {service} du {previousDate} à {previousTime} au {date} à {time}.",
    button: "Ouvrir l'agenda",
  },
};

const en: Texts = {
  confirmed: {
    subject: "Appointment confirmed — {service}, {date} at {time}",
    body: "Hello {name},\n\nYour appointment is confirmed. The summary is below, and the attached invitation adds it to your calendar.\n\nSee you soon,\n{business}",
    button: "Manage my appointment",
  },
  requested: {
    subject: "Booking request received — {service}, {date} at {time}",
    body: "Hello {name},\n\nThank you for your request. You will receive an e-mail as soon as it is confirmed.\n\n{business}",
    button: "View my request",
  },
  declined: {
    subject: "Your booking request for {date}",
    body: "Hello {name},\n\nUnfortunately this time is not available. Feel free to pick another date or to contact me directly.\n\n{business}",
  },
  cancelled: {
    subject: "Appointment cancelled — {service}, {date} at {time}",
    body: "Hello {name},\n\nYour appointment on {date} at {time} is cancelled.\n\nHope to see you again soon,\n{business}",
  },
  rescheduled: {
    subject: "Appointment moved — {service}, {date} at {time}",
    body: "Hello {name},\n\nYour appointment has been moved to {date} at {time} (instead of {previousDate} at {previousTime}). The updated invitation is attached.\n\n{business}",
    button: "Manage my appointment",
  },
  reminder: {
    subject: "Reminder — your appointment on {date} at {time}",
    body: "Hello {name},\n\nA quick reminder of your {service} appointment on {date} at {time}.\n\nSee you soon,\n{business}",
    button: "Manage my appointment",
  },
  adminNew: {
    subject: "New booking — {name} · {service}, {date} at {time}",
    body: "New booking from {name}.",
    button: "Open the calendar",
  },
  adminCancelled: {
    subject: "Cancellation — {name} · {date} at {time}",
    body: "{name} cancelled their {service} appointment on {date} at {time}.",
    button: "Open the calendar",
  },
  adminRescheduled: {
    subject: "Appointment moved — {name} · {date} at {time}",
    body: "{name} moved their {service} appointment from {previousDate} at {previousTime} to {date} at {time}.",
    button: "Open the calendar",
  },
};

export const DEFAULT_EMAIL_TEXTS: Record<string, Texts> = { fr, en };

/** Pending requests use the "request" wording in the admin alert. */
const adminNewPending = {
  fr: { subject: "Demande de rendez-vous — {name} · {service}, {date} à {time}", body: "Nouvelle demande de {name}, à confirmer ou refuser." },
  en: { subject: "Booking request — {name} · {service}, {date} at {time}", body: "New request from {name}, to approve or decline." },
} as Record<string, { subject: string; body: string }>;

const labels = {
  fr: {
    service: "Soin",
    date: "Date",
    time: "Heure",
    duration: "Durée",
    price: "Tarif",
    address: "Adresse",
    client: "Client·e",
    email: "E-mail",
    phone: "Téléphone",
    message: "Message",
    status: "Statut",
    pending: "À confirmer",
    outOfZone: "Hors zone",
    addToCalendar: "Ajouter à mon agenda",
    ics: "Apple / autre (.ics)",
  },
  en: {
    service: "Service",
    date: "Date",
    time: "Time",
    duration: "Duration",
    price: "Price",
    address: "Address",
    client: "Client",
    email: "E-mail",
    phone: "Phone",
    message: "Message",
    status: "Status",
    pending: "To approve",
    outOfZone: "Out of area",
    addToCalendar: "Add to my calendar",
    ics: "Apple / other (.ics)",
  },
} as Record<string, Record<string, string>>;

export type EmailContext = {
  kind: EmailKind;
  locale: string;
  settings: Pick<Settings, "businessName" | "timezone" | "currency" | "contact" | "emailTexts" | "defaultLocale" | "fields" | "base">;
  booking: Booking;
  /** Client's link to cancel / reschedule (client e-mails). */
  manageUrl?: string;
  /** Link to the admin (admin e-mails). */
  adminUrl?: string;
  /** Previous start, for "rescheduled" e-mails. */
  previousStart?: string;
  brand?: { color?: string; logoUrl?: string };
  /** "Add to calendar" links (client e-mails about a confirmed appointment). */
  calendarLinks?: CalendarLinks;
};

export type RenderedEmail = { subject: string; text: string; html: string };

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function emailVars(ctx: EmailContext) {
  const { booking: b, settings: s, locale } = ctx;
  const start = Date.parse(b.start);
  const prev = ctx.previousStart ? Date.parse(ctx.previousStart) : undefined;
  return {
    name: b.client.name,
    service: pick(b.service.name, locale, s.defaultLocale),
    date: formatDate(start, s.timezone, locale, { year: undefined }),
    time: formatTime(start, s.timezone, locale),
    duration: formatDuration(b.service.durationMin, locale),
    price: b.service.price !== undefined ? formatPrice(b.service.price, s.currency, locale) : undefined,
    address: b.service.location === "home" ? b.address?.label : b.service.location === "studio" ? s.base.address : undefined,
    business: s.businessName,
    previousDate: prev !== undefined ? formatDate(prev, s.timezone, locale, { year: undefined }) : undefined,
    previousTime: prev !== undefined ? formatTime(prev, s.timezone, locale) : undefined,
  };
}

/** Built-in subject/body for a kind, before the provider's overrides. */
export function defaultEmailText(kind: EmailKind, locale: string, pending = false) {
  const base = (DEFAULT_EMAIL_TEXTS[locale] ?? fr)[kind];
  if (kind === "adminNew" && pending) return { ...base, ...(adminNewPending[locale] ?? adminNewPending.fr) };
  return base;
}

export function renderEmail(ctx: EmailContext): RenderedEmail {
  const { kind, locale, booking: b, settings: s } = ctx;
  const isAdmin = kind.startsWith("admin");
  const base = defaultEmailText(kind, locale, b.status === "pending");
  const override = isAdmin ? undefined : s.emailTexts[kind]?.[locale];
  const vars = emailVars(ctx);
  const subject = fill(override?.subject?.trim() || base.subject, vars);
  const body = fill(override?.body?.trim() || base.body, vars);
  const L = labels[locale] ?? labels.fr!;

  const rows: [string, string][] = [
    [L.service!, vars.service],
    [L.date!, vars.date],
    [L.time!, vars.time],
    [L.duration!, vars.duration],
  ];
  if (vars.price) rows.push([L.price!, vars.price]);
  if (vars.address) rows.push([L.address!, vars.address]);
  if (isAdmin) {
    rows.unshift([L.client!, b.client.name]);
    rows.push([L.email!, b.client.email], [L.phone!, b.client.phone]);
    if (b.outOfZone) rows.push([L.outOfZone!, b.distanceKm !== undefined ? `${b.distanceKm} km` : "—"]);
    for (const f of s.fields) {
      const v = b.fields[f.id];
      if (v === undefined || v === "") continue;
      rows.push([pick(f.label, locale, s.defaultLocale), typeof v === "boolean" ? (v ? "✓" : "✗") : String(v)]);
    }
    if (b.message) rows.push([L.message!, b.message]);
    if (b.status === "pending") rows.push([L.status!, L.pending!]);
  }

  const link = isAdmin ? ctx.adminUrl : ctx.manageUrl;
  const showButton = !!link && !!base.button && kind !== "cancelled" && kind !== "declined";
  const color = ctx.brand?.color ?? "#2b2b2e";
  const onColor = readableOn(color);
  const cal = !isAdmin && b.status === "confirmed" && ["confirmed", "rescheduled", "reminder"].includes(kind) ? ctx.calendarLinks : undefined;
  const calItems = cal
    ? ([
        ["Google", cal.google],
        ["Outlook", cal.outlook],
        ...(cal.ics ? [[L.ics!, cal.ics]] : []),
      ] as [string, string][])
    : [];

  const text = [
    body,
    "",
    ...rows.map(([k, v]) => `${k} : ${v}`),
    ...(showButton ? ["", `${base.button} : ${link}`] : []),
    ...(calItems.length ? ["", `${L.addToCalendar} :`, ...calItems.map(([k, v]) => `- ${k} : ${v}`)] : []),
    "",
    [s.businessName, s.contact.phone, s.contact.email].filter(Boolean).join(" · "),
  ].join("\n");

  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const html = `<!doctype html>
<html lang="${escapeHtml(locale)}"><body style="margin:0;background:#f6f4f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#222">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    ${ctx.brand?.logoUrl ? `<img src="${escapeHtml(ctx.brand.logoUrl)}" alt="${escapeHtml(s.businessName)}" style="max-height:56px;margin:0 0 24px">` : `<p style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:${color};margin:0 0 24px">${escapeHtml(s.businessName)}</p>`}
    <div style="background:#fff;border-radius:12px;padding:28px 24px;font-size:15px;line-height:1.6">
      ${paragraphs}
      <table style="width:100%;border-collapse:collapse;margin:8px 0 4px;font-size:14px">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:8px 0;color:#777;width:38%;vertical-align:top;border-top:1px solid #eee">${escapeHtml(k)}</td><td style="padding:8px 0;border-top:1px solid #eee;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`,
          )
          .join("")}
      </table>
      ${showButton ? `<p style="margin:24px 0 0"><a href="${escapeHtml(link!)}" style="display:inline-block;background:${color};color:${onColor};text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${escapeHtml(base.button!)}</a></p>` : ""}
      ${
        calItems.length
          ? `<p style="margin:20px 0 0;font-size:13px;color:#777">${escapeHtml(L.addToCalendar!)} : ${calItems
              .map(([k, v]) => `<a href="${escapeHtml(v)}" style="color:#222;font-weight:600">${escapeHtml(k)}</a>`)
              .join(" · ")}</p>`
          : ""
      }
    </div>
    <p style="font-size:12px;color:#888;margin:20px 4px 0;line-height:1.6">${[s.businessName, s.contact.phone, s.contact.email]
      .filter(Boolean)
      .map((x) => escapeHtml(x!))
      .join(" · ")}</p>
  </div>
</body></html>`;

  return { subject, text, html };
}
