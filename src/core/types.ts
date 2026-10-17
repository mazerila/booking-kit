/**
 * Shared data model. These shapes are stored in Firestore, returned by the API
 * and used by the widget and the admin, so every layer agrees on them.
 *
 * Times: instants are ISO-8601 UTC strings ("2026-10-17T08:30:00.000Z"), which
 * sort lexicographically and can be range-queried as strings. Wall-clock values
 * ("09:00", "2026-10-17") are always in the provider's time zone (`Settings.timezone`).
 */

import type { Appearance, BookingTheme } from "./theme.js";

/** Text in several languages, keyed by locale: `{ fr: "Soin visage", en: "Facial" }`. */
export type LocalizedText = Record<string, string>;

/** "HH:mm" wall-clock time. */
export type WallTime = string;
/** "yyyy-mm-dd" local date. */
export type LocalDate = string;

export type TimeRange = { start: WallTime; end: WallTime };

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export type WeeklyHours = Record<Weekday, TimeRange[]>;

/** One day that differs from the weekly hours: closed, or open with other ranges. */
export type DayException = {
  date: LocalDate;
  closed: boolean;
  ranges: TimeRange[];
  note?: string;
};

/** A time range the provider blocked by hand (errand, personal appointment…). */
export type Block = {
  id: string;
  start: string;
  end: string;
  reason?: string;
};

export type LocationMode = "studio" | "home" | "online";

export type Category = {
  id: string;
  name: LocalizedText;
  order: number;
};

export type Service = {
  id: string;
  name: LocalizedText;
  description?: LocalizedText;
  categoryId?: string;
  durationMin: number;
  /** In the settings currency; omit for "price on request". */
  price?: number;
  /** Former price, shown struck through. */
  wasPrice?: number;
  /** Small badge such as "Offre découverte". */
  badge?: LocalizedText;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  location: LocationMode;
  active: boolean;
  order: number;
};

export type FieldType = "text" | "textarea" | "select" | "checkbox" | "date" | "number" | "email" | "tel";

/**
 * An extra question in the booking form, chosen per site.
 * A required checkbox is a consent ("I accept the [terms](/cgv/)").
 */
export type FieldDef = {
  id: string;
  type: FieldType;
  label: LocalizedText;
  help?: LocalizedText;
  placeholder?: LocalizedText;
  required: boolean;
  options?: { value: string; label: LocalizedText }[];
  /** Only ask for these services (e.g. pregnancy week for maternity treatments). */
  serviceIds?: string[];
  /** Only ask for services in these categories. */
  categoryIds?: string[];
  min?: number;
  max?: number;
  maxLength?: number;
};

export type ZoneSettings = {
  /** none: no check · postcodes: list of allowed postcodes · radius: distance from the base address. */
  mode: "none" | "postcodes" | "radius";
  postcodes: string[];
  radiusKm: number;
  /** block: out-of-zone clients cannot book · request: they can, as a request the provider approves. */
  outOfZone: "block" | "request";
  message?: LocalizedText;
};

export type BookingRules = {
  /** Granularity of proposed start times. */
  slotStepMin: number;
  /** Minimum time between now and an appointment. */
  minNoticeMin: number;
  /** How many days ahead clients can book. */
  maxAdvanceDays: number;
  /** Maximum appointments per day, 0 = unlimited. */
  maxPerDay: number;
  /** Extra gap before and after home visits, for travelling. */
  travelBufferMin: number;
};

export type Policies = {
  /** instant: booking is confirmed at once · request: the provider approves each booking. */
  confirmation: "instant" | "request";
  allowClientCancel: boolean;
  allowClientReschedule: boolean;
  /** Clients can cancel or reschedule until this many hours before the appointment. */
  changeUntilHours: number;
  /** Shown before confirming, e.g. the cancellation policy. */
  text?: LocalizedText;
};

export type EmailKind =
  | "confirmed"
  | "requested"
  | "declined"
  | "cancelled"
  | "rescheduled"
  | "reminder"
  | "adminNew"
  | "adminCancelled"
  | "adminRescheduled";

export type EmailText = { subject?: string; body?: string };

export type Settings = {
  businessName: string;
  timezone: string;
  defaultLocale: string;
  locales: string[];
  currency: string;
  contact: { email?: string; phone?: string; address?: string };
  /** Base address: where studio appointments happen and where travel distances start. */
  base: { address?: string; lat?: number; lng?: number };
  zone: ZoneSettings;
  rules: BookingRules;
  policies: Policies;
  reminders: { enabled: boolean; hoursBefore: number };
  fields: FieldDef[];
  /** Overrides of the built-in e-mail texts, per kind and locale. */
  emailTexts: Partial<Record<EmailKind, Record<string, EmailText>>>;
  /** Who receives new-booking alerts. */
  notifyEmails: string[];
  /** Look chosen in the admin (preset + custom values). */
  appearance: Appearance;
};

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "declined" | "no_show";

/** Statuses that occupy the calendar. */
export const ACTIVE_STATUSES: BookingStatus[] = ["pending", "confirmed"];

export type Address = {
  label: string;
  postcode?: string;
  city?: string;
  lat?: number;
  lng?: number;
};

export type ClientInfo = { name: string; email: string; phone: string };

export type FieldValue = string | number | boolean;

export type HistoryEntry = {
  at: string;
  action: "created" | "confirmed" | "declined" | "cancelled" | "rescheduled" | "completed" | "no_show" | "edited";
  by: "client" | "admin" | "system";
  note?: string;
};

export type Booking = {
  id: string;
  serviceId: string;
  /** Copy of the service at booking time, so later edits don't rewrite history. */
  service: { name: LocalizedText; durationMin: number; price?: number; location: LocationMode };
  start: string;
  end: string;
  /** Local date of `start`, for day queries. */
  date: LocalDate;
  /** Busy time around the appointment (buffers + travel), used for availability. */
  bufferBeforeMin: number;
  bufferAfterMin: number;
  status: BookingStatus;
  client: ClientInfo;
  clientId: string;
  address?: Address;
  distanceKm?: number;
  outOfZone?: boolean;
  fields: Record<string, FieldValue>;
  message?: string;
  locale: string;
  source: "web" | "admin";
  /** Private admin notes, never shown to the client. */
  notes?: string;
  /** Secret of the client's manage link (bookings are readable by admins only). */
  manageToken?: string;
  reminderSentAt?: string;
  createdAt: string;
  updatedAt: string;
  history: HistoryEntry[];
};

export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes?: string;
  bookingCount: number;
  firstBookingAt: string;
  lastBookingAt: string;
  lastAddress?: Address;
};

/** Firestore collection and document names, shared by the functions, the admin and the rules. */
export const COL = {
  config: "bookingConfig",
  services: "services",
  categories: "categories",
  exceptions: "exceptions",
  blocks: "blocks",
  bookings: "bookings",
  clients: "clients",
  locks: "bookingLocks",
  mail: "mailLog",
} as const;

/** Documents of `bookingConfig`. */
export const CONFIG_DOC = { business: "business", weekly: "weekly", admins: "admins", feed: "feed" } as const;

/** What the public API exposes about the business (no private data). */
export type PublicConfig = {
  businessName: string;
  timezone: string;
  defaultLocale: string;
  locales: string[];
  currency: string;
  contact: Settings["contact"];
  baseAddress?: string;
  zone: Pick<ZoneSettings, "mode" | "outOfZone" | "message">;
  rules: Pick<BookingRules, "maxAdvanceDays">;
  policies: Policies;
  fields: FieldDef[];
  categories: Category[];
  services: Service[];
  /** Whether the server can geocode addresses (address autocomplete). */
  geocoding: boolean;
  /** Theme chosen in the admin; undefined = follow the website's design. */
  theme?: BookingTheme;
};

/** What a client sees of their booking (manage page, confirmation). */
export type PublicBooking = {
  id: string;
  serviceId: string;
  status: BookingStatus;
  service: Booking["service"];
  start: string;
  end: string;
  /** Where it happens: the client's address, the studio address, or nothing for online. */
  where?: string;
  clientName: string;
  locale: string;
  canCancel: boolean;
  canReschedule: boolean;
  /** Last moment the client can change the booking. */
  changeUntil: string;
};

/** API error codes, translated by the widget. */
export type ApiErrorCode =
  | "invalid"
  | "not_found"
  | "slot_taken"
  | "out_of_zone"
  | "too_late"
  | "not_allowed"
  | "rate"
  | "unauthorized"
  | "server";
