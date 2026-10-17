/** Calendar events for appointments, shared by the widget, the e-mails and the provider's feed. */
import { formatDuration, pick } from "./format.js";
import { googleCalendarUrl, outlookCalendarUrl, type CalendarEvent } from "./ics.js";
import type { Booking, BookingStatus, LocalizedText } from "./types.js";

const labels: Record<string, { manage: string; contact: string }> = {
  fr: { manage: "Modifier ou annuler", contact: "Contact" },
  en: { manage: "Change or cancel", contact: "Contact" },
};

/** The client's view of their appointment, as a calendar event. */
export function appointmentEvent(
  b: { id: string; start: string; end: string; status?: BookingStatus; service: { name: LocalizedText; durationMin: number } },
  o: { businessName: string; locale: string; defaultLocale: string; where?: string; manageUrl?: string; phone?: string; email?: string },
): CalendarEvent {
  const L = labels[o.locale] ?? labels.en!;
  const service = pick(b.service.name, o.locale, o.defaultLocale);
  const description = [
    `${service} · ${formatDuration(b.service.durationMin, o.locale)}`,
    o.businessName,
    [o.phone, o.email].filter(Boolean).length ? `${L.contact} : ${[o.phone, o.email].filter(Boolean).join(" · ")}` : "",
    o.manageUrl ? `${L.manage} : ${o.manageUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    uid: `${b.id}@booking`,
    start: Date.parse(b.start),
    end: Date.parse(b.end),
    title: `${service} — ${o.businessName}`,
    description,
    location: o.where,
    url: o.manageUrl,
    organizer: o.email ? { name: o.businessName, email: o.email } : undefined,
    status: b.status === "cancelled" || b.status === "declined" ? "CANCELLED" : b.status === "pending" ? "TENTATIVE" : "CONFIRMED",
  };
}

/** The provider's view of a booking, for the private calendar feed. */
export function providerEvent(b: Booking, o: { locale: string; defaultLocale: string; adminUrl?: string; fieldLabels?: Record<string, string> }): CalendarEvent {
  const service = pick(b.service.name, o.locale, o.defaultLocale);
  const fields = Object.entries(b.fields)
    .filter(([, v]) => v !== "" && v !== false)
    .map(([k, v]) => `${(o.fieldLabels?.[k] ?? k).replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")} : ${v === true ? "✓" : v}`);
  return {
    uid: `${b.id}@booking`,
    start: Date.parse(b.start),
    end: Date.parse(b.end),
    title: `${b.status === "pending" ? "? " : ""}${b.client.name} — ${service}`,
    description: [b.client.phone, b.client.email, b.address?.label, ...fields, b.message, b.notes, o.adminUrl].filter(Boolean).join("\n"),
    location: b.service.location === "home" ? b.address?.label : undefined,
    status: b.status === "pending" ? "TENTATIVE" : "CONFIRMED",
    sequence: b.history.length,
    alarmMinutes: null,
  };
}

export type CalendarLinks = { google: string; outlook: string; ics?: string };

export function calendarLinks(e: CalendarEvent, icsUrl?: string): CalendarLinks {
  return { google: googleCalendarUrl(e), outlook: outlookCalendarUrl(e), ics: icsUrl };
}
