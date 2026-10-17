# booking-kit — architecture

Decisions so far: no online payments · SMS per client only if needed · one Firebase project per client.

## 1. Stack

Same stack as Leyaline, so it drops into existing sites:

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript everywhere | One set of types shared by UI, admin and functions |
| UI | React 19 components, plain CSS with `--bk-*` variables | Doesn't depend on the host site's Tailwind config; themable |
| Backend | Firebase Cloud Functions v2 (`europe-west1`) | Works with static export (`out/`), ~0 € on free tier |
| Database | Firestore | Real-time admin views, transactions against double booking |
| Admin auth | Firebase Auth (e-mail link or Google) + admin e-mail list | No passwords to manage |
| E-mail | Resend (already used by Leyaline) | Confirmations, reminders, admin alerts |
| Scheduled jobs | Cloud Scheduler (`onSchedule`) | Reminders, auto-complete past bookings |
| Dates | `Intl` only (small helpers in `core/time.ts`) | All logic in the provider's time zone, no date library |
| Validation | `zod` | Config file, API payloads, custom form fields |
| Tests | Vitest + Firebase Emulators | Slot engine unit tests, API, rules and jobs end to end |

## 2. One package, four entry points

This repo is a single package (for example `@mazerila/booking-kit`). Each client site installs it from a
git tag, so every client stays on a known version and upgrades one at a time.

```
src/
  core/        pure TS, no Firebase: types, config schema, slot engine, zone check, i18n texts
  react/       <BookingWidget />, <ManageBooking />: the public UI
  admin/       <AdminApp />: dashboard, calendar, availability, services, clients, settings
  functions/   Cloud Function handlers: availability, book, manage, admin actions, reminders
template/      files copied into a new client: firebase.json, firestore.rules, indexes, functions/index.ts
scripts/       setup-client.ts: creates config, seeds services/hours, sets the admin claim
demo/          small Next.js site for developing and testing the module on its own
```

Subpath exports: `@mazerila/booking-kit/react`, `/admin`, `/functions`, `/core`.

**Integration in a client site (e.g. Leyaline):**
- `booking.config.ts`: theme tokens, enabled features, form fields, locales, text overrides
- `/reserver/` page renders `<BookingWidget config={…} />`
- `/admin/` page renders `<AdminApp />` (client-side only, `noindex`)
- `/rdv/?t=…` page renders `<ManageBooking />` (cancel / reschedule)
- `functions/index.ts`: `export * from "@mazerila/booking-kit/functions"`
- [later] script/iframe embed build for sites that aren't React

## 3. Where data lives

- **Config file (in the site's code):** look and behaviour that a developer sets once: colors,
  fonts, radius, enabled features, form field definitions, locales, texts.
- **Firestore (edited in the admin):** business data the provider changes herself: services,
  hours, days off, rules, policies, e-mail texts, bookings, clients.

## 4. Data model (Firestore)

Collection names are in `COL` (`src/core/types.ts`), shared by the functions, the admin and the rules.

```
bookingConfig/business  Settings: name, timezone, contact, base location, zone, rules, policies,
                        reminders, form fields, e-mail text overrides, notify e-mails
bookingConfig/weekly    { mon: [{start:"09:00", end:"12:00"}, …], … }
bookingConfig/admins    { emails: [...] }   (only the setup script / console can change it)
categories/{id}         name{fr,en}, order
services/{id}           name, description, badge (localized), categoryId, durationMin, price, wasPrice,
                        bufferBeforeMin, bufferAfterMin, location (studio|home|online), active, order
exceptions/{date}       closed | custom ranges (holidays, extra hours), note
blocks/{id}             start, end, reason (time blocked by the admin)
bookings/{id}           service snapshot, start, end (ISO UTC), date (local), buffers, status,
                        client {name, email, phone}, clientId, address, distanceKm, outOfZone,
                        fields{}, message, locale, source (web|admin), notes, manageToken,
                        reminderSentAt, history[], createdAt, updatedAt
clients/{id}            name, email, phone, notes, bookingCount, first/lastBookingAt, lastAddress
bookingLocks/{date}     touched by every booking transaction of that day (no double booking)
mailLog/{id}            every e-mail sent or attempted
```

**Security:** the public site never reads or writes Firestore directly. All public reads and writes
go through functions. Only signed-in users whose verified e-mail is in `bookingConfig/admins` can
read or write collections, via rules.

## 5. Key mechanisms

- **Slot engine (`core/slots.ts`, pure function):** hours − exceptions − blocks − existing bookings
  (with buffers and travel time) → free start times, using minimum notice, max advance and slot step.
  Same code on the server (source of truth) and in the admin (preview).
- **No double booking:** `book` runs a Firestore transaction that reads `bookingLocks/{date}`. It
  re-checks that the interval is still free and then writes the booking. Two people booking the same slot at the
  same moment can't both succeed.
- **Manage link:** a random token goes in the e-mails (stored on the booking, which only admins
  can read, so later e-mails can link to it). Cancel or reschedule is allowed only inside the
  policy window.
- **Reminders:** a job every 30 minutes sends reminders for bookings 24 h ahead (configurable),
  marks them so none is sent twice, and marks past appointments as completed.
- **Home visits:** the zone is checked by postcode list or straight-line distance (from a geocoded
  address via the free French BAN API, with a fallback). Travel buffer is v1.1.
- **Calendar files:** `.ics` attached to e-mails and offered on the confirmation screen.

## 6. Theming

```ts
theme: {
  colors: { primary: "#2b2b2e", accent: "#d9a5a0", bg: "#fff", surface: "#faf6f4", text: "#222", muted: "#777" },
  font: { body: "var(--font-body)", heading: "var(--font-heading)" },
  radius: "12px",
  density: "comfortable",   // or "compact"
}
```
These become `--bk-*` CSS variables on the widget root, so the module's CSS never needs editing.

## 7. Build order

1. `core`: types, config schema, slot engine + tests
2. `functions`: availability, book, manage, e-mails (emulators)
3. `react`: booking widget + manage page, in `demo/`
4. `admin`: login, bookings list/calendar, availability, services, clients, settings
5. Reminders, `template/` + `setup-client` script
6. Integrate into Leyaline
