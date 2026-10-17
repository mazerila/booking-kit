/** Defaults, so a partial settings document (or a new site) always works. */
import { WEEKDAYS, type Service, type Settings, type WeeklyHours } from "./types.js";

export const DEFAULT_SETTINGS: Settings = {
  businessName: "",
  timezone: "Europe/Paris",
  defaultLocale: "fr",
  locales: ["fr", "en"],
  currency: "EUR",
  contact: {},
  base: {},
  zone: { mode: "none", postcodes: [], radiusKm: 20, outOfZone: "request" },
  rules: { slotStepMin: 30, minNoticeMin: 12 * 60, maxAdvanceDays: 60, maxPerDay: 0, travelBufferMin: 0 },
  policies: { confirmation: "instant", allowClientCancel: true, allowClientReschedule: true, changeUntilHours: 24 },
  reminders: { enabled: true, hoursBefore: 24 },
  fields: [],
  emailTexts: {},
  notifyEmails: [],
};

export const DEFAULT_WEEKLY: WeeklyHours = Object.fromEntries(
  WEEKDAYS.map((d) => [
    d,
    d === "sat" || d === "sun"
      ? []
      : [
          { start: "09:00", end: "12:00" },
          { start: "14:00", end: "18:00" },
        ],
  ]),
) as WeeklyHours;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Deep-merges a stored (possibly partial or older) settings doc over the defaults. */
export function normalizeSettings(stored: unknown): Settings {
  const s = isObj(stored) ? stored : {};
  const merge = <T extends object>(def: T, v: unknown): T => (isObj(v) ? { ...def, ...v } : def);
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    contact: merge(DEFAULT_SETTINGS.contact, s.contact),
    base: merge(DEFAULT_SETTINGS.base, s.base),
    zone: merge(DEFAULT_SETTINGS.zone, s.zone),
    rules: merge(DEFAULT_SETTINGS.rules, s.rules),
    policies: merge(DEFAULT_SETTINGS.policies, s.policies),
    reminders: merge(DEFAULT_SETTINGS.reminders, s.reminders),
    fields: Array.isArray(s.fields) ? (s.fields as Settings["fields"]) : [],
    emailTexts: isObj(s.emailTexts) ? (s.emailTexts as Settings["emailTexts"]) : {},
    notifyEmails: Array.isArray(s.notifyEmails) ? (s.notifyEmails as string[]) : [],
    locales: Array.isArray(s.locales) && s.locales.length ? (s.locales as string[]) : DEFAULT_SETTINGS.locales,
  } as Settings;
}

export function normalizeWeekly(stored: unknown): WeeklyHours {
  const s = isObj(stored) ? stored : {};
  return Object.fromEntries(WEEKDAYS.map((d) => [d, Array.isArray(s[d]) ? s[d] : []])) as WeeklyHours;
}

export function normalizeService(id: string, stored: unknown): Service {
  const s = isObj(stored) ? stored : {};
  return {
    name: {},
    durationMin: 60,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    location: "studio",
    active: true,
    order: 0,
    ...s,
    id,
  } as Service;
}
