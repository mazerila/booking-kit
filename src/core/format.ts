/** Display helpers shared by the widget, the admin and the e-mails. */
import type { LocalizedText } from "./types.js";

/** Text in the wanted language, falling back to the default one, then to any. */
export function pick(text: LocalizedText | undefined, locale: string, fallback = "fr"): string {
  if (!text) return "";
  return text[locale] ?? text[fallback] ?? Object.values(text)[0] ?? "";
}

/** Replaces `{name}` placeholders. Unknown placeholders are left as-is. */
export function fill(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] !== undefined ? String(vars[k]) : m));
}

export function formatPrice(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function formatDuration(minutes: number, locale: string) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} h`;
  return locale.startsWith("fr") ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h ${m} min`;
}

export function formatDate(ms: number, timeZone: string, locale: string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...opts,
  }).format(new Date(ms));
}

export function formatTime(ms: number, timeZone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
}

/** "2026-10-17" → formatted, without time-zone shifts. */
export function formatLocalDate(date: string, locale: string, opts: Intl.DateTimeFormatOptions = {}) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    ...opts,
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** Tiny "[text](url)" link syntax for consent labels. Returns segments to render. */
export function parseLinks(text: string): ({ text: string } | { text: string; href: string })[] {
  const out: ({ text: string } | { text: string; href: string })[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    const href = m[2]!;
    // Only relative, http(s) and mailto links.
    out.push(/^(\/|https?:|mailto:|#)/.test(href) ? { text: m[1]!, href } : { text: m[1]! });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
