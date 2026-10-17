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

export function buildIcs(e: CalendarEvent, now = Date.now()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//booking-module//EN",
    "CALSCALE:GREGORIAN",
    e.status === "CANCELLED" ? "METHOD:CANCEL" : "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(e.end)}`,
    `SUMMARY:${escape(e.title)}`,
    e.description ? `DESCRIPTION:${escape(e.description)}` : "",
    e.location ? `LOCATION:${escape(e.location)}` : "",
    e.organizer?.email ? `ORGANIZER;CN=${escape(e.organizer.name)}:mailto:${e.organizer.email}` : "",
    `STATUS:${e.status ?? "CONFIRMED"}`,
    `SEQUENCE:${e.sequence ?? 0}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape(e.title)}`,
    "END:VALARM",
    "END:VEVENT",
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
