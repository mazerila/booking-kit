/**
 * Time-zone helpers built on Intl only (no date library). All booking logic
 * works on wall-clock times in the provider's zone and converts to UTC
 * instants at the edges, so DST changes are handled by the platform.
 */
import { WEEKDAYS, type LocalDate, type WallTime, type Weekday } from "./types.js";

export const MINUTE = 60_000;
export const DAY_MS = 24 * 60 * MINUTE;

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export type WallParts = { year: number; month: number; day: number; hour: number; minute: number };

/** Wall-clock parts of an instant in a zone. */
export function wallParts(ms: number, timeZone: string): WallParts {
  const p: Record<string, number> = {};
  for (const { type, value } of partsFormatter(timeZone).formatToParts(new Date(ms))) {
    if (type !== "literal") p[type] = Number(value);
  }
  return { year: p.year!, month: p.month!, day: p.day!, hour: p.hour! % 24, minute: p.minute! };
}

/** Offset of the zone from UTC at an instant, in ms (Paris in summer: +2 h). */
function offsetAt(ms: number, timeZone: string) {
  const w = wallParts(ms, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  return asUtc - Math.floor(ms / MINUTE) * MINUTE;
}

/**
 * Instant of a wall-clock time in a zone. Returns null for times that don't
 * exist (the hour skipped when clocks go forward).
 */
export function zonedTime(date: LocalDate, time: WallTime, timeZone: string): number | null {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [h, min] = time.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, h, min);
  let ms = guess - offsetAt(guess, timeZone);
  const second = guess - offsetAt(ms, timeZone);
  if (second !== ms) ms = second;
  const back = wallParts(ms, timeZone);
  if (back.hour !== h % 24 || back.minute !== min || back.day !== d) return null;
  return ms;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function localDateOf(ms: number, timeZone: string): LocalDate {
  const w = wallParts(ms, timeZone);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

export function wallTimeOf(ms: number, timeZone: string): WallTime {
  const w = wallParts(ms, timeZone);
  return `${pad(w.hour)}:${pad(w.minute)}`;
}

/** Calendar arithmetic on local dates (time-zone independent). */
export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function weekdayOf(date: LocalDate): Weekday {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  // getUTCDay: 0 = Sunday.
  return WEEKDAYS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7]!;
}

/** Inclusive list of dates from `from` to `to`. */
export function dateRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

export function minutesOf(time: WallTime): number {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

export function timeOfMinutes(minutes: number): WallTime {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export const isLocalDate = (s: unknown): s is LocalDate =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;

export const isWallTime = (s: unknown): s is WallTime =>
  typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
