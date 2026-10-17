import { describe, expect, it } from "vitest";
import {
  appointmentEvent,
  buildCalendar,
  calendarLinks,
  DEFAULT_SETTINGS,
  googleFontsOf,
  googleFontsUrl,
  mergeThemes,
  normalizeSettings,
  outlookCalendarUrl,
  providerEvent,
  readableOn,
  renderEmail,
  resolveAppearance,
  type Booking,
} from "../src/core/index.js";

describe("theme", () => {
  it("picks readable text colors", () => {
    expect(readableOn("#2b2b2e")).toBe("#ffffff");
    expect(readableOn("#e9d8c4")).toBe("#1b1a1f");
    expect(readableOn("#fff")).toBe("#1b1a1f");
    expect(readableOn("nonsense")).toBe("#ffffff");
  });

  it("resolves presets and custom values", () => {
    expect(resolveAppearance({ preset: "site", custom: {} })).toBeUndefined();
    expect(resolveAppearance(undefined)).toBeUndefined();
    const sage = resolveAppearance({ preset: "sage", custom: { primary: "#ffcc00", radius: "" } })!;
    expect(sage.primary).toBe("#ffcc00");
    expect(sage.onPrimary).toBe("#1b1a1f");
    expect(sage.radius).toBe("14px"); // empty custom values are ignored
    expect(resolveAppearance({ preset: "site", custom: { accent: "#123456" } })).toEqual({ accent: "#123456" });
  });

  it("lets the admin override the code theme", () => {
    const t = mergeThemes({ primary: "#000000", fontFamily: "Inter" }, { primary: "#ffffff" });
    expect(t).toEqual({ primary: "#ffffff", fontFamily: "Inter", onPrimary: "#1b1a1f" });
  });

  it("finds Google fonts to load", () => {
    const t = resolveAppearance({ preset: "rose", custom: { fontFamily: "'Inter', system-ui, sans-serif" } })!;
    expect(googleFontsOf(t).sort()).toEqual(["Cormorant Garamond", "Inter"]);
    expect(googleFontsUrl(["Cormorant Garamond"])).toBe("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&display=swap");
  });

  it("normalizes stored appearance", () => {
    expect(normalizeSettings({}).appearance).toEqual({ preset: "site", custom: {} });
    expect(normalizeSettings({ appearance: { preset: "night" } }).appearance).toEqual({ preset: "night", custom: {} });
  });
});

const booking: Booking = {
  id: "b1",
  serviceId: "s1",
  service: { name: { fr: "Soin visage", en: "Facial" }, durationMin: 45, price: 70, location: "studio" },
  start: "2026-10-19T08:00:00.000Z",
  end: "2026-10-19T08:45:00.000Z",
  date: "2026-10-19",
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  status: "confirmed",
  client: { name: "Ana", email: "ana@example.com", phone: "0600000000" },
  clientId: "c1",
  fields: { terms: true, week: 20 },
  locale: "en",
  source: "web",
  notes: "Door code 1234",
  createdAt: "",
  updatedAt: "",
  history: [],
};

describe("calendar", () => {
  it("builds the client's event with the manage link", () => {
    const e = appointmentEvent(booking, { businessName: "Studio", locale: "en", defaultLocale: "fr", where: "1 Main St", manageUrl: "https://x/rdv/?t=abc", phone: "01 23" });
    expect(e.title).toBe("Facial — Studio");
    expect(e.description).toContain("Change or cancel : https://x/rdv/?t=abc");
    expect(e.status).toBe("CONFIRMED");
    expect(outlookCalendarUrl(e)).toMatch(/^https:\/\/outlook\.live\.com\/calendar\/0\/deeplink\/compose\?/);
    expect(decodeURIComponent(outlookCalendarUrl(e))).toContain("startdt=2026-10-19T08:00:00.000Z");
  });

  it("builds the provider's feed without alarms", () => {
    const e = providerEvent({ ...booking, status: "pending" }, { locale: "fr", defaultLocale: "fr", fieldLabels: { week: "Semaine", terms: "J'accepte les [CGV](/cgv/)" } });
    expect(e.title).toBe("? Ana — Soin visage");
    expect(e.description).toContain("Semaine : 20");
    expect(e.description).toContain("J'accepte les CGV : ✓");
    expect(e.description).toContain("Door code 1234");
    const ics = buildCalendar([e, { ...e, uid: "b2@booking" }], { name: "Studio", refreshMinutes: 30 }, 0);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("X-WR-CALNAME:Studio");
    expect(ics).toContain("STATUS:TENTATIVE");
    expect(ics).not.toContain("VALARM");
  });

  it("adds calendar links to confirmation e-mails only", () => {
    const settings = { ...DEFAULT_SETTINGS, businessName: "Studio" };
    const event = appointmentEvent(booking, { businessName: "Studio", locale: "en", defaultLocale: "fr" });
    const links = calendarLinks(event, "https://x/api/booking/manage/ics?t=abc");
    const confirmed = renderEmail({ kind: "confirmed", locale: "en", settings, booking, calendarLinks: links });
    expect(confirmed.html).toContain("Add to my calendar");
    expect(confirmed.html).toContain("manage/ics?t=abc");
    expect(confirmed.text).toContain("- Outlook : https://outlook.live.com/");
    const cancelled = renderEmail({ kind: "cancelled", locale: "en", settings, booking: { ...booking, status: "cancelled" }, calendarLinks: links });
    expect(cancelled.html).not.toContain("Add to my calendar");
    const admin = renderEmail({ kind: "adminNew", locale: "en", settings, booking, calendarLinks: links });
    expect(admin.html).not.toContain("Add to my calendar");
  });

  it("colors e-mail buttons readably", () => {
    const settings = { ...DEFAULT_SETTINGS, businessName: "Studio" };
    const m = renderEmail({ kind: "confirmed", locale: "en", settings, booking, manageUrl: "https://x", brand: { color: "#e9d8c4" } });
    expect(m.html).toContain("background:#e9d8c4;color:#1b1a1f");
  });
});
