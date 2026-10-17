/** "Add to calendar": .ics file content and a Google Calendar link. */

export type CalendarEvent = {
  uid: string;
  start: number;
  end: number;
  title: string;
  description?: string;
  location?: string;
  /** Organizer, shown by some calendar apps. */
  organizer?: { name: string; email?: string };
  /** CANCELLED removes the event from calendars that imported it. */
  status?: "CONFIRMED" | "TENTATIVE" | "CANCELLED";
  sequence?: number;
  /** Link shown by calendar apps (e.g. the manage page). */
  url?: string;
  /** Reminder before the event, in minutes. Default 120; null for none. */
  alarmMinutes?: number | null;
};

const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);

/** Lines longer than 75 octets are folded, as RFC 5545 requires. */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 75) {
    let cut = 74;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

function eventLines(e: CalendarEvent, now: number): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(e.end)}`,
    `SUMMARY:${escape(e.title)}`,
    e.description ? `DESCRIPTION:${escape(e.description)}` : "",
    e.location ? `LOCATION:${escape(e.location)}` : "",
    e.url ? `URL:${e.url}` : "",
    e.organizer?.email ? `ORGANIZER;CN=${escape(e.organizer.name)}:mailto:${e.organizer.email}` : "",
    `STATUS:${e.status ?? "CONFIRMED"}`,
    `SEQUENCE:${e.sequence ?? 0}`,
    ...(e.alarmMinutes === null
      ? []
      : ["BEGIN:VALARM", `TRIGGER:-PT${e.alarmMinutes ?? 120}M`, "ACTION:DISPLAY", `DESCRIPTION:${escape(e.title)}`, "END:VALARM"]),
    "END:VEVENT",
  ].filter(Boolean);
}

/** A calendar file with one event (invitation, "add to calendar"). */
export function buildIcs(e: CalendarEvent, now = Date.now()): string {
  return buildCalendar([e], { method: e.status === "CANCELLED" ? "CANCEL" : "PUBLISH" }, now);
}

/** A calendar with several events, e.g. the provider's subscription feed. */
export function buildCalendar(events: CalendarEvent[], opts: { name?: string; method?: "PUBLISH" | "CANCEL"; refreshMinutes?: number } = {}, now = Date.now()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//booking-kit//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${opts.method ?? "PUBLISH"}`,
    opts.name ? `X-WR-CALNAME:${escape(opts.name)}` : "",
    opts.refreshMinutes ? `REFRESH-INTERVAL;VALUE=DURATION:PT${opts.refreshMinutes}M` : "",
    opts.refreshMinutes ? `X-PUBLISHED-TTL:PT${opts.refreshMinutes}M` : "",
    ...events.flatMap((e) => eventLines(e, now)),
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(e.start)}/${stamp(e.end)}`,
  });
  if (e.description) p.set("details", e.description);
  if (e.location) p.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${p}`;
}

/** Outlook on the web; `office` targets work/school (Microsoft 365) accounts. */
export function outlookCalendarUrl(e: CalendarEvent, office = false): string {
  const p = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: new Date(e.start).toISOString(),
    enddt: new Date(e.end).toISOString(),
  });
  if (e.description) p.set("body", e.description);
  if (e.location) p.set("location", e.location);
  return `https://outlook.${office ? "office" : "live"}.com/calendar/0/deeplink/compose?${p}`;
}
