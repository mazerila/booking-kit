/**
 * Slot engine: which start times can a client book? Pure function, used by the
 * server (source of truth, re-checked inside the booking transaction) and by
 * the admin (preview when creating or moving a booking).
 */
import { addDays, dateRange, localDateOf, MINUTE, minutesOf, timeOfMinutes, weekdayOf, zonedTime } from "./time.js";
import type { BookingRules, DayException, LocalDate, Service, TimeRange, WeeklyHours } from "./types.js";

/** Something that occupies the calendar: a booking (with its buffers) or a block. */
export type Busy = {
  start: number;
  end: number;
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
  /** Counts toward `maxPerDay` (bookings do, blocks don't). */
  counts?: boolean;
  /** Booking id, so a booking being rescheduled can ignore itself. */
  id?: string;
};

export type SlotInput = {
  timezone: string;
  weekly: WeeklyHours;
  exceptions: Record<LocalDate, DayException>;
  busy: Busy[];
  rules: BookingRules;
  service: Pick<Service, "durationMin" | "bufferBeforeMin" | "bufferAfterMin" | "location">;
  from: LocalDate;
  to: LocalDate;
  now: number;
  /** Ignore this booking id (rescheduling). */
  excludeId?: string;
  /** Admin: ignore minimum notice and maximum advance. */
  ignoreLimits?: boolean;
};

/** Start instants (ms) per local date. Dates with no free time are omitted. */
export type SlotMap = Record<LocalDate, number[]>;

export function openingRanges(date: LocalDate, weekly: WeeklyHours, exceptions: Record<LocalDate, DayException>): TimeRange[] {
  const ex = exceptions[date];
  if (ex) return ex.closed ? [] : ex.ranges;
  return weekly[weekdayOf(date)] ?? [];
}

/** Buffers the service needs around itself, travel included. */
export function serviceBuffers(service: SlotInput["service"], rules: Pick<BookingRules, "travelBufferMin">) {
  const travel = service.location === "home" ? rules.travelBufferMin : 0;
  return { before: service.bufferBeforeMin + travel, after: service.bufferAfterMin + travel };
}

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

/**
 * Does an appointment [start, end) with these buffers collide with anything?
 * A buffer is a minimum gap: two appointments must be at least
 * max(previous.after, next.before) apart, and buffers may overlap each other.
 */
export function collides(start: number, end: number, before: number, after: number, busy: Busy[], excludeId?: string) {
  const s = start - before * MINUTE;
  const e = end + after * MINUTE;
  return busy.some((b) => {
    if (excludeId && b.id === excludeId) return false;
    if (overlaps(s, e, b.start, b.end)) return true;
    return overlaps(start, end, b.start - (b.bufferBeforeMin ?? 0) * MINUTE, b.end + (b.bufferAfterMin ?? 0) * MINUTE);
  });
}

export function computeSlots(input: SlotInput): SlotMap {
  const { timezone, weekly, exceptions, busy, rules, service, now, excludeId } = input;
  const { before, after } = serviceBuffers(service, rules);
  const duration = service.durationMin * MINUTE;
  const step = Math.max(5, rules.slotStepMin);
  const earliest = input.ignoreLimits ? -Infinity : now + rules.minNoticeMin * MINUTE;
  const lastDate = input.ignoreLimits ? input.to : minDate(input.to, addDays(localDateOf(now, timezone), rules.maxAdvanceDays));

  const perDay = new Map<LocalDate, number>();
  if (rules.maxPerDay > 0) {
    for (const b of busy) {
      if (!b.counts || (excludeId && b.id === excludeId)) continue;
      const d = localDateOf(b.start, timezone);
      perDay.set(d, (perDay.get(d) ?? 0) + 1);
    }
  }

  const out: SlotMap = {};
  for (const date of dateRange(input.from, lastDate)) {
    if (rules.maxPerDay > 0 && (perDay.get(date) ?? 0) >= rules.maxPerDay) continue;
    const starts: number[] = [];
    for (const range of openingRanges(date, weekly, exceptions)) {
      const open = minutesOf(range.start);
      const close = range.end === "00:00" ? 24 * 60 : minutesOf(range.end);
      // Slots are aligned on the step from the opening time: 9:00, 9:30…
      for (let m = open; m + service.durationMin <= close; m += step) {
        const start = zonedTime(date, timeOfMinutes(m), timezone);
        if (start === null || start < earliest) continue;
        const end = start + duration;
        if (!collides(start, end, before, after, busy, excludeId)) starts.push(start);
      }
    }
    if (starts.length) out[date] = [...new Set(starts)].sort((a, b) => a - b);
  }
  return out;
}

/** Is this exact start time bookable? Used to re-check a client's choice. */
export function isSlotAvailable(input: Omit<SlotInput, "from" | "to">, start: number): boolean {
  const date = localDateOf(start, input.timezone);
  const slots = computeSlots({ ...input, from: date, to: date });
  return (slots[date] ?? []).includes(start);
}

const minDate = (a: LocalDate, b: LocalDate) => (a < b ? a : b);
