import { describe, expect, it } from "vitest";
import {
  buildIcs,
  checkZone,
  computeSlots,
  DEFAULT_SETTINGS,
  fieldsFor,
  fill,
  formatDuration,
  isLocalDate,
  isSlotAvailable,
  localDateOf,
  normalizeSettings,
  parseLinks,
  renderEmail,
  validateFields,
  wallTimeOf,
  weekdayOf,
  zonedTime,
  type Booking,
  type BookingRules,
  type FieldDef,
  type SlotInput,
  type WeeklyHours,
} from "../src/core/index.js";

const TZ = "Europe/Paris";
const at = (date: string, time: string) => zonedTime(date, time, TZ)!;
const times = (slots: number[] = []) => slots.map((ms) => wallTimeOf(ms, TZ));

const rules: BookingRules = { slotStepMin: 30, minNoticeMin: 0, maxAdvanceDays: 365, maxPerDay: 0, travelBufferMin: 0 };
const weekly: WeeklyHours = {
  mon: [{ start: "09:00", end: "12:00" }],
  tue: [{ start: "09:00", end: "12:00" }],
  wed: [],
  thu: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "16:00" }],
  fri: [{ start: "09:00", end: "12:00" }],
  sat: [],
  sun: [],
};
const service = { durationMin: 60, bufferBeforeMin: 0, bufferAfterMin: 0, location: "studio" as const };

// Monday 19 Oct 2026, far in the future relative to `now`.
const MON = "2026-10-19";
const base = (over: Partial<SlotInput> = {}): SlotInput => ({
  timezone: TZ,
  weekly,
  exceptions: {},
  busy: [],
  rules,
  service,
  from: MON,
  to: MON,
  now: Date.parse("2026-10-01T00:00:00Z"),
  ...over,
});

describe("time", () => {
  it("converts wall-clock times in Paris across DST", () => {
    expect(new Date(at("2026-07-01", "09:00")).toISOString()).toBe("2026-07-01T07:00:00.000Z");
    expect(new Date(at("2026-12-01", "09:00")).toISOString()).toBe("2026-12-01T08:00:00.000Z");
    // 29 March 2026: 02:00 → 03:00, so 02:30 does not exist.
    expect(zonedTime("2026-03-29", "02:30", TZ)).toBeNull();
    expect(new Date(at("2026-03-29", "03:00")).toISOString()).toBe("2026-03-29T01:00:00.000Z");
  });

  it("knows weekdays and validates dates", () => {
    expect(weekdayOf("2026-10-19")).toBe("mon");
    expect(weekdayOf("2026-10-25")).toBe("sun");
    expect(isLocalDate("2026-02-28")).toBe(true);
    expect(isLocalDate("2026-02-30")).toBe(false);
    expect(localDateOf(Date.parse("2026-10-18T22:30:00Z"), TZ)).toBe("2026-10-19");
  });
});

describe("computeSlots", () => {
  it("lists start times so the service fits in opening hours", () => {
    expect(times(computeSlots(base())[MON])).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });

  it("handles several ranges per day and closed days", () => {
    const s = computeSlots(base({ from: "2026-10-21", to: "2026-10-22" }));
    expect(s["2026-10-21"]).toBeUndefined();
    expect(times(s["2026-10-22"])).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "14:00", "14:30", "15:00"]);
  });

  it("removes slots overlapping a booking, respecting both sides' buffers", () => {
    const busy = [{ start: at(MON, "10:00"), end: at(MON, "11:00"), bufferAfterMin: 30, counts: true }];
    expect(times(computeSlots(base({ busy }))[MON])).toEqual(["09:00"]);
    // New service needs 30 min before it: 11:00 is too close to the 11:00 end; 9:00 ends right at 10:00.
    const withBuffer = { ...service, bufferBeforeMin: 30 };
    expect(times(computeSlots(base({ busy: [{ ...busy[0]!, bufferAfterMin: 0 }], service: withBuffer }))[MON])).toEqual(["09:00"]);
  });

  it("buffers are a minimum gap, not added together", () => {
    const busy = [{ start: at(MON, "09:00"), end: at(MON, "10:00"), bufferAfterMin: 30, counts: true }];
    const svc = { ...service, bufferBeforeMin: 30 };
    expect(times(computeSlots(base({ busy, service: svc }))[MON])).toEqual(["10:30", "11:00"]);
  });

  it("adds travel time around home visits", () => {
    const busy = [{ start: at(MON, "09:00"), end: at(MON, "10:00"), counts: true }];
    const s = computeSlots(base({ busy, rules: { ...rules, travelBufferMin: 30 }, service: { ...service, location: "home" } }));
    expect(times(s[MON])).toEqual(["10:30", "11:00"]);
  });

  it("applies blocks, minimum notice and maximum advance", () => {
    const busy = [{ start: at(MON, "09:00"), end: at(MON, "10:30") }];
    expect(times(computeSlots(base({ busy }))[MON])).toEqual(["10:30", "11:00"]);
    const now = at(MON, "08:00");
    expect(times(computeSlots(base({ now, rules: { ...rules, minNoticeMin: 120 } }))[MON])).toEqual(["10:00", "10:30", "11:00"]);
    const s = computeSlots(base({ now, from: MON, to: "2026-10-30", rules: { ...rules, maxAdvanceDays: 1 } }));
    expect(Object.keys(s)).toEqual([MON, "2026-10-20"]);
  });

  it("closes a day when the daily maximum is reached (blocks don't count)", () => {
    const busy = [
      { start: at(MON, "09:00"), end: at(MON, "10:00"), counts: true, id: "a" },
      { start: at(MON, "11:00"), end: at(MON, "11:30") },
    ];
    expect(computeSlots(base({ busy, rules: { ...rules, maxPerDay: 1 } }))[MON]).toBeUndefined();
    expect(computeSlots(base({ busy, rules: { ...rules, maxPerDay: 2 } }))[MON]).toBeDefined();
    // Rescheduling booking "a" ignores it.
    expect(times(computeSlots(base({ busy, excludeId: "a", rules: { ...rules, maxPerDay: 1 } }))[MON])).toEqual([
      "09:00",
      "09:30",
      "10:00",
    ]);
  });

  it("uses day exceptions", () => {
    const exceptions = {
      [MON]: { date: MON, closed: false, ranges: [{ start: "18:00", end: "19:00" }] },
      "2026-10-20": { date: "2026-10-20", closed: true, ranges: [] },
    };
    const s = computeSlots(base({ exceptions, to: "2026-10-20" }));
    expect(times(s[MON])).toEqual(["18:00"]);
    expect(s["2026-10-20"]).toBeUndefined();
  });

  it("checks one exact start time", () => {
    const input = base();
    expect(isSlotAvailable(input, at(MON, "10:00"))).toBe(true);
    expect(isSlotAvailable(input, at(MON, "10:15"))).toBe(false);
    expect(isSlotAvailable(input, at(MON, "11:30"))).toBe(false);
  });

  it("keeps working on DST change days", () => {
    const sunday = { ...weekly, sun: [{ start: "01:00", end: "05:00" }] };
    const s = computeSlots(base({ weekly: sunday, from: "2026-03-29", to: "2026-03-29", now: Date.parse("2026-03-01T00:00:00Z") }));
    // 02:00–03:00 doesn't exist that night.
    expect(times(s["2026-03-29"])).toEqual(["01:00", "01:30", "03:00", "03:30", "04:00"]);
  });
});

describe("zone", () => {
  const zone = { ...DEFAULT_SETTINGS.zone, mode: "radius" as const, radiusKm: 20 };
  const base = { lat: 48.8566, lng: 2.3522 }; // Paris

  it("checks distance from the base", () => {
    expect(checkZone(zone, base, { label: "Versailles", lat: 48.8049, lng: 2.1204 }).inZone).toBe(true);
    const far = checkZone(zone, base, { label: "Meaux", lat: 48.9601, lng: 2.8788 });
    expect(far.inZone).toBe(false);
    expect(far.distanceKm).toBeGreaterThan(35);
    expect(checkZone(zone, base, { label: "?" }).inZone).toBeNull();
  });

  it("checks postcodes and prefixes", () => {
    const z = { ...zone, mode: "postcodes" as const, postcodes: ["77", "75011"] };
    expect(checkZone(z, {}, { label: "x", postcode: "77300" }).inZone).toBe(true);
    expect(checkZone(z, {}, { label: "12 rue X 75011 Paris" }).inZone).toBe(true);
    expect(checkZone(z, {}, { label: "x", postcode: "75012" }).inZone).toBe(false);
  });
});

describe("fields", () => {
  const defs: FieldDef[] = [
    { id: "week", type: "number", label: { fr: "Semaine" }, required: true, min: 1, max: 42, categoryIds: ["maternity"] },
    { id: "how", type: "select", label: { fr: "Comment" }, required: false, options: [{ value: "google", label: { fr: "Google" } }] },
    { id: "terms", type: "checkbox", label: { fr: "J'accepte" }, required: true },
  ];

  it("filters by service category", () => {
    expect(fieldsFor(defs, { id: "x", categoryId: "body" }).map((f) => f.id)).toEqual(["how", "terms"]);
    expect(fieldsFor(defs, { id: "x", categoryId: "maternity" })).toHaveLength(3);
  });

  it("validates and cleans values", () => {
    expect(validateFields(defs, { week: "20", how: "google", terms: true, junk: "x" })).toEqual({
      values: { week: 20, how: "google", terms: true },
      invalid: [],
    });
    expect(validateFields(defs, { week: 50, how: "tv" }).invalid).toEqual(["week", "how", "terms"]);
  });
});

describe("format", () => {
  it("formats durations and placeholders", () => {
    expect(formatDuration(45, "fr")).toBe("45 min");
    expect(formatDuration(90, "fr")).toBe("1 h 30");
    expect(formatDuration(120, "en")).toBe("2 h");
    expect(fill("Hi {name}, {unknown}", { name: "Ana" })).toBe("Hi Ana, {unknown}");
  });

  it("parses safe links only", () => {
    expect(parseLinks("I accept the [terms](/cgv/) and [x](javascript:alert(1))")).toEqual([
      { text: "I accept the " },
      { text: "terms", href: "/cgv/" },
      { text: " and " },
      { text: "x" },
      { text: ")" },
    ]);
  });

  it("merges partial settings over defaults", () => {
    const s = normalizeSettings({ businessName: "X", rules: { slotStepMin: 15 } });
    expect(s.rules).toEqual({ ...DEFAULT_SETTINGS.rules, slotStepMin: 15 });
    expect(s.policies.confirmation).toBe("instant");
  });
});

describe("ics & email", () => {
  const booking: Booking = {
    id: "b1",
    serviceId: "s1",
    service: { name: { fr: "Drainage, corps", en: "Body drainage" }, durationMin: 90, price: 120, location: "home" },
    start: "2026-10-19T08:00:00.000Z",
    end: "2026-10-19T09:30:00.000Z",
    date: MON,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    status: "confirmed",
    client: { name: "Ana <b>", email: "ana@example.com", phone: "0600000000" },
    clientId: "c1",
    address: { label: "1 rue de Paris 77000 Melun" },
    fields: { terms: true },
    locale: "fr",
    source: "web",
    createdAt: "",
    updatedAt: "",
    history: [],
  };

  it("builds a valid calendar file", () => {
    const ics = buildIcs({ uid: "b1@x", start: Date.parse(booking.start), end: Date.parse(booking.end), title: "Soin; visage, corps" }, 0);
    expect(ics).toContain("DTSTART:20261019T080000Z");
    expect(ics).toContain("SUMMARY:Soin\\; visage\\, corps");
    expect(ics.endsWith("\r\n")).toBe(true);
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it("renders e-mails with overrides and escaping", () => {
    const settings = { ...DEFAULT_SETTINGS, businessName: "Studio" };
    const m = renderEmail({ kind: "confirmed", locale: "fr", settings, booking, manageUrl: "https://x/rdv/?t=1" });
    expect(m.subject).toBe("Rendez-vous confirmé — Drainage, corps, lundi 19 octobre à 10:00");
    expect(m.html).toContain("Ana &lt;b&gt;");
    expect(m.html).toContain("https://x/rdv/?t=1");
    expect(m.text).toContain("Adresse : 1 rue de Paris 77000 Melun");

    const custom = { ...settings, emailTexts: { confirmed: { fr: { subject: "C'est noté {name} !" } } } };
    expect(renderEmail({ kind: "confirmed", locale: "fr", settings: custom, booking }).subject).toBe("C'est noté Ana <b> !");
    const en = renderEmail({ kind: "reminder", locale: "en", settings, booking });
    expect(en.subject).toBe("Reminder — your appointment on Monday, October 19 at 10:00 AM");
  });
});
