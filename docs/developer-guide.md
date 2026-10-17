# booking-kit — developer guide

Everything needed to add booking-kit to a client's website, configure it, run it and maintain it.
The guide for the provider (the admin user) is built into the admin itself: the **Aide / Help**
page, in French and English (source: `src/admin/help.ts`).

**Contents**

1. [Overview](#1-overview)
2. [Setting up a new client](#2-setting-up-a-new-client)
3. [Component reference](#3-component-reference)
4. [Functions reference](#4-functions-reference)
5. [Theming](#5-theming)
6. [Texts and languages](#6-texts-and-languages)
7. [Form questions](#7-form-questions)
8. [Seed file](#8-seed-file)
9. [Calendars](#9-calendars) · [General terms](#general-terms)
10. [E-mails](#10-e-mails)
11. [Data model and security](#11-data-model-and-security)
12. [HTTP API](#12-http-api)
13. [Local development and tests](#13-local-development-and-tests)
14. [Deployment and upgrades](#14-deployment-and-upgrades)
15. [Extending](#15-extending)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Overview

```
 Client's website (static, e.g. Next.js export on Firebase Hosting)
 ├─ /reserver/   <BookingWidget />  ──┐
 ├─ /rdv/        <ManageBooking />  ──┤  fetch /api/booking/*   (Hosting rewrite)
 └─ /admin/      <AdminApp />  ───────┤──────────────────────────► Cloud Function bookingApi
                    │                 │                              │
                    │ Firebase Auth   │                              ├─ Firestore (Admin SDK)
                    └─ Firestore (live reads, rules: admins only) ◄──┤
                                                                     └─ Resend (e-mails)
                                     Cloud Scheduler ──► bookingJobs (reminders, auto-complete)
```

- **One codebase, one Firebase project per client.** Data is isolated, and each client runs on
  the free tiers.
- **The public pages never read Firestore.** They only call the API: services, free slots, and
  their own booking through a secret link.
- **The admin reads Firestore live**, protected by the rules (e-mail allow-list). Changes to the
  calendar (create, move, cancel, status) go through the API, which handles transactions and
  e-mails.
- **What lives where:**
  - Code: look defaults, texts, page paths, Firebase web config.
  - Firestore: everything the provider edits.

Package entry points:

| Import | Contents |
|---|---|
| `@mazerila/booking-kit/react` | `BookingWidget`, `ManageBooking`, `BookingTerms`, `createApi`, `BOOKING_TEXTS`, `themeStyle`, types |
| `@mazerila/booking-kit/admin` | `AdminApp`, `ADMIN_TEXTS`, `HELP`, types |
| `@mazerila/booking-kit/functions` | `createBookingFunctions`, `createApiHandler`, `runScheduledJobs`, `frenchGeocoder` |
| `@mazerila/booking-kit/core` | types, slot engine, time-zone helpers, e-mail rendering, .ics, themes |
| `@mazerila/booking-kit/styles.css` | widget + manage page styles |
| `@mazerila/booking-kit/admin.css` | admin styles |

Requirements: React 19, Node 22 for functions, `firebase` ≥ 12 (admin page),
`firebase-admin` ≥ 13 and `firebase-functions` ≥ 6 (functions).

---

## 2. Setting up a new client

Ready-to-copy files are in [`template/`](../template/).

### 2.1 Firebase project

1. **Create the project** at console.firebase.google.com. Switch it to the **Blaze** plan
   (needed for Cloud Functions; a small business stays within the free quotas).
2. **Firestore Database** → Create → production mode, region `eur3` (Europe) or
   `europe-west1`.
3. **Authentication** → Get started → Sign-in method:
   - Enable **Google**, and/or **Email/Password** with **Email link (passwordless sign-in)**
     ticked.
   - Under **Settings → Authorized domains**, add the site's domain.
4. **Project settings → Your apps → Web app** (</>) → register. Copy the `firebaseConfig`
   values (`apiKey`, `authDomain`, `projectId`). They are public identifiers, not secrets.
5. **Resend** (resend.com):
   - Add the sender domain and create the DNS records it asks for (SPF/DKIM).
   - Create an API key.

### 2.2 Files in the site

```
firebase.json            ← merge template/firebase.json (Hosting rewrite /api/booking/** → bookingApi)
firestore.rules          ← template/firestore.rules
firestore.indexes.json   ← template/firestore.indexes.json
booking.seed.json        ← template/booking.seed.json, filled in (see §8)
functions/               ← template/functions (or add to existing functions)
src/booking/             ← template/next/*.tsx + booking.config.ts
```

If the site already has a catch-all `/api/**` rewrite (Leyaline has one for its contact form),
put the `/api/booking/**` rule **before** it: Hosting uses the first match.

### 2.3 Install

```bash
npm install github:mazerila/booking-kit#v0.3.0
npm --prefix functions install github:mazerila/booking-kit#v0.3.0
```

Installing from git runs the package's `prepare` script, which builds `dist/`, so the first
install takes a little longer. While developing the module and a site together, use
`npm install ../booking-kit` instead (symlink).

### 2.4 Pages

```tsx
// booking page: app/(fr)/reserver/page.tsx
"use client";
import { BookingWidget } from "@mazerila/booking-kit/react";
import "@mazerila/booking-kit/styles.css";

export default function Page() {
  return <BookingWidget locale="fr" manageUrl="/rdv/" theme={{ fontFamily: "var(--font-body)" }} />;
}
```

```tsx
// manage page: app/(fr)/rdv/page.tsx — the link in every e-mail (/rdv/?t=…)
<ManageBooking bookUrl="/reserver/" />
```

```tsx
// admin: app/(fr)/admin/page.tsx — export `metadata = { robots: { index: false } }` from the page
import { AdminApp } from "@mazerila/booking-kit/admin";
import "@mazerila/booking-kit/admin.css";
import "@mazerila/booking-kit/styles.css"; // for the Appearance preview

<AdminApp
  firebase={firebaseWebConfig}
  locale="fr"
  siteBookingUrl="/reserver/"
  support={{ name: "Alireza", email: "you@example.com" }}
/>
```

All three are client components (`"use client"` is already in the package) and work with
`output: "export"`. The manage page reads `?t=` on the client.

### 2.5 Functions

```ts
// functions/src/index.ts
import { createBookingFunctions } from "@mazerila/booking-kit/functions";

export const { bookingApi, bookingJobs } = createBookingFunctions({
  siteUrl: "https://www.example.fr",
  mailFrom: "Studio <rdv@example.fr>",
  managePath: { fr: "/rdv/", en: "/en/appointment/" },
});

export { contact } from "./contact.js"; // the site's other functions, if any
```

```bash
firebase functions:secrets:set RESEND_API_KEY
```

### 2.6 Seed and admins

```bash
gcloud auth application-default login            # once per machine
npx tsx node_modules/@mazerila/booking-kit/scripts/setup-client.ts \
  --project my-client --seed booking.seed.json --admin owner@example.fr
```

- Existing documents are kept unless `--force`.
- `--dry-run` shows what would be written.
- Run it again with `--admin someone@example.com` to add an admin; admins can't be added from
  the UI, by design.

### 2.7 Deploy

```bash
npm run build                                    # site → out/
firebase deploy --only hosting,functions,firestore
```

**Checklist after the first deploy:**

1. Open `/admin/` and sign in with the admin e-mail.
2. Settings → Business → **Locate** the base address (needed for a distance-based zone).
3. Check hours, services and form questions.
4. Make a test booking with your own e-mail. Check the e-mail, the calendar invite and the
   manage link, then cancel it.
5. Optionally create the provider's calendar link (Settings → Sync with my calendar) on her
   phone.

---

## 3. Component reference

### `<BookingWidget />`

| Prop | Type | Default | |
|---|---|---|---|
| `apiBase` | string | `"/api/booking"` | API URL (Hosting rewrite) |
| `locale` | string | business default | UI and e-mail language of the booking |
| `theme` | `BookingTheme` | — | Look from code (§5); the admin's Appearance overrides it |
| `useAdminTheme` | boolean | `true` | `false` ignores the admin's Appearance |
| `loadFonts` | boolean | `true` | Load the Google fonts the theme uses (§5.4) |
| `texts` | `Record<locale, Partial<BookingTexts>>` | — | Text overrides (§6) |
| `serviceId` | string | — | Preselect a service (skips step 1) |
| `serviceIds` / `categoryId` | string[] / string | — | Only offer these services / this category |
| `manageUrl` | string | — | Manage page path; the done screen links to it with the token |
| `showPrices` | boolean | `true` | |
| `askMessage` | boolean | `true` | Free message field at the end of the form |
| `title` | string \| null | "Choose a service" | Heading above the service list; `null` hides it |
| `onStepChange` | `(step, service?) => void` | — | Analytics: `service`, `address`, `datetime`, `details`, `done` |
| `onBooked` | `(booking: PublicBooking) => void` | — | Analytics / conversion |
| `className` | string | — | Added to `.bk-root` |

The flow is: service → address (home visits only) → date and time → details → done. One
service, or `serviceId`, skips the first step. After an "out of area" check, a booking becomes a
request when the zone policy says so.

### `<ManageBooking />`

| Prop | Type | Default | |
|---|---|---|---|
| `apiBase` | string | `"/api/booking"` | |
| `token` | string | `?t=` (or `?token=`) of the URL | |
| `locale` | string | the booking's locale | |
| `theme`, `useAdminTheme`, `loadFonts`, `texts`, `className` | | | as above |
| `bookUrl` | string | — | "Book another appointment" after a cancellation |

### `<BookingTerms />`

The general terms as a page of the site, with the same text as the pop-up in the booking form.
Useful when the site's footer should link to `/cgv/`.

```tsx
<BookingTerms locale="fr" />   // props: apiBase, locale, theme, useAdminTheme, loadFonts, texts, showTitle, className
```

### `<AdminApp />`

| Prop | Type | Default | |
|---|---|---|---|
| `firebase` | `FirebaseOptions` | **required** | Web config of the client's project |
| `apiBase` | string | `"/api/booking"` | |
| `locale` | `"fr"` \| `"en"` | `"fr"` | Admin language (UI and Help) |
| `texts` | `Partial<AdminTexts>` | — | Overrides |
| `theme` | `{ primary, onPrimary, accent, background, surface, fontFamily, radius }` | from Appearance | Admin colors; without it, the primary/accent chosen in Appearance are used |
| `signIn` | `("google" \| "emailLink")[]` | both | Methods offered |
| `siteBookingUrl` | string | — | "View on site" button in Appearance |
| `support` | `{ name, email?, phone? }` | — | Shown on the Help page |
| `extraHelp` | `Record<locale, HelpSection[]>` | — | Client-specific help sections |
| `phoneCountryCode` | string | `"33"` | For WhatsApp links from national numbers |
| `emulators` | `{ auth?, firestore? }` | — | Local development only |

The admin uses its own named Firebase app (`booking-admin`), so it doesn't clash with a
Firebase app the site already initializes. Routes are hash-based (`#/calendar`,
`#/booking/<id>`, `#/help/sync`, …), so one static page is enough.

---

## 4. Functions reference

`createBookingFunctions(options)` returns `{ bookingApi, bookingJobs }`. Export both.

| Option | Type | Default | |
|---|---|---|---|
| `siteUrl` | string \| param | **required** | Public origin, used in e-mail links |
| `mailFrom` | string \| param | **required** | `"Studio <rdv@example.fr>"`, on a Resend-verified domain |
| `managePath` | string \| `Record<locale, string>` | `"/rdv/"` | Path of the `<ManageBooking />` page |
| `adminPath` | string | `"/admin/"` | Used in the provider's e-mails and feed |
| `apiPath` | string | `"/api/booking"` | Public path of the API (for `.ics` links in e-mails) |
| `brand` | `{ color?, logoUrl? }` | color from Appearance | E-mail logo, and a fixed color if you want one |
| `geocoder` | `"fr"` \| `"none"` \| `Geocoder` | `"fr"` | Address search (§15) |
| `region` | string | `"europe-west1"` | |
| `allowedOrigins` | string[] | — | Only for cross-origin use (no Hosting rewrite) |
| `maxInstances` | number | 5 | |
| `schedule` | string | `"every 30 minutes"` | Reminders and auto-complete |

`siteUrl` and `mailFrom` accept Firebase params (`defineString("SITE_URL")`), which lets one
codebase deploy to a staging and a production project.

**Secret:** `RESEND_API_KEY`. If it is empty or missing, e-mails are not sent; they are logged
in the functions logs and in `mailLog`. That is the normal behavior in the emulator.
`RESEND_API_URL` (env) points e-mails at a mock server.

---

## 5. Theming

### 5.1 Layers

The final look is built in this order, later layers winning:

1. **Stylesheet defaults** (neutral, dark buttons).
2. **`theme` prop**: what the developer sets for the site, typically fonts as CSS variables
   (`var(--font-body)`) and brand colors.
3. **Appearance chosen in the admin**: a preset plus custom values (`Settings.appearance`).
   The **"Website design"** preset adds nothing, so the code theme applies. Pass
   `useAdminTheme={false}` to ignore this layer.

The admin's choice also sets the e-mail button color (unless `brand.color` is set) and the
admin's own primary/accent colors (unless `AdminApp` gets a `theme`).

### 5.2 `BookingTheme`

| Key | CSS variable | Default |
|---|---|---|
| `primary` | `--bk-primary` | `#2b2b2e`: buttons, selected day/time |
| `onPrimary` | `--bk-on-primary` | computed from `primary` (black or white) |
| `accent` | `--bk-accent` | `#b5838d`: badges, focus ring, policy border |
| `background` | `--bk-bg` | transparent; when set, the widget becomes a padded card |
| `surface` | `--bk-surface` | `#ffffff`: cards, inputs |
| `text` / `muted` / `border` | `--bk-text` / `--bk-muted` / `--bk-border` | |
| `danger` / `success` | `--bk-danger` / `--bk-success` | |
| `radius` | `--bk-radius` | `12px` (cards, inputs) |
| `buttonRadius` | `--bk-button-radius` | `999px` (pills) |
| `fontFamily` / `headingFontFamily` | `--bk-font` / `--bk-heading-font` | `inherit` |
| `fontSize` | `--bk-font-size` | `1rem` |
| `density` | `--bk-space` | `comfortable`; `compact` = 0.75 |
| `maxWidth` | `--bk-max-width` | `760px` |

The same variables can be set in the site's CSS instead of props:

```css
.bk-root { --bk-primary: #2e2c2f; --bk-radius: 16px; }
/* On a colored page, the sticky "Continue" bar on phones fades into this color: */
.booking-page .bk-root { --bk-sticky-bg: #f9eeea; }
```

Every class starts with `bk-` (widget) or `bka-` (admin). Resets use `:where()`, so the site's
own rules are easy to override.

### 5.3 Presets

`THEME_PRESETS` in `src/core/theme.ts`: `site`, `classic`, `rose`, `sage`, `sand`, `ocean`,
`night`. To add a preset for every client, add an entry there. It then appears in the admin
automatically.

### 5.4 Fonts

The admin offers `FONT_CHOICES`:
- the site's font (`inherit`)
- system UI
- Georgia
- 11 Google Fonts

When the final theme uses a Google font, the widget adds its stylesheet to `<head>`. In the EU,
loading Google Fonts from Google's servers sends visitors' IP addresses to Google, which needs
consent. If that matters for a site:
- pass `loadFonts={false}` and self-host the fonts (e.g. `next/font`), using the same family
  names, or
- keep the preset fonts at "Website".

### 5.5 Layout

The widget adapts to the width of its container (container queries), not the window:
- two-column calendar and times above 600px
- name, e-mail and phone side by side above 560px
- step labels hidden below 520px

Put it in a narrow column and it behaves like on a phone.

---

## 6. Texts and languages

- Widget strings: `BOOKING_TEXTS.fr` / `.en` in `src/react/texts.ts`. Override any key per
  locale with the `texts` prop:

  ```tsx
  <BookingWidget texts={{ fr: { chooseService: "Quel soin vous ferait du bien ?", confirm: "Je réserve" } }} />
  ```

- Admin strings: `ADMIN_TEXTS` in `src/admin/texts.ts` (`texts` prop of `AdminApp`).
- E-mail texts: built-in in `src/core/email.ts`; the provider overrides subject and body per
  e-mail in the admin.
- Business content (service names, descriptions, form labels, zone message, policy text) is
  `LocalizedText`: `{ fr: "…", en: "…" }`, edited in the admin for each language listed in
  Settings → Languages.

**Adding a language** (e.g. German):
1. Add `de` dictionaries to `BOOKING_TEXTS`, `ADMIN_TEXTS`, `DEFAULT_EMAIL_TEXTS` and the
   `labels` in `email.ts` / `calendar.ts`. Add a `HELP.de` if the admin should have German
   help.
2. Add `de` to the locales in the admin.

Missing keys fall back to English.

Dates, times and prices are formatted with `Intl` in the business time zone and currency.

---

## 7. Form questions

`Settings.fields` is a list of `FieldDef`, editable in the admin (Settings → Form questions)
or in the seed file:

```json
{
  "id": "pregnancyWeek",
  "type": "number",
  "label": { "fr": "Semaine de grossesse", "en": "Pregnancy week" },
  "help": { "fr": "À partir de 14 semaines." },
  "required": true,
  "min": 14, "max": 41,
  "categoryIds": ["maternity"]
}
```

- **`type`:** `text`, `textarea`, `select` (with `options: [{ value, label }]`), `checkbox`,
  `number` (`min`, `max`), `date`, `email` or `tel`. `maxLength` is optional.
- **`serviceIds` / `categoryIds`:** only ask for these services or categories.
- **A required `checkbox` is a consent.** Labels support `[text](/url/)` links (only relative,
  http(s), mailto and `#` links are rendered). The special link `[conditions générales](#terms)`
  opens the [general terms](#general-terms) in a pop-up instead of leaving the page.
- Answers are validated on both sides (`validateFields` in `core/fields.ts`). They are stored in
  `booking.fields`, and shown in the admin, the provider's e-mails and the calendar feed.
- Name, e-mail and phone are always asked and are not part of `fields`.

---

## 8. Seed file

Read by `scripts/setup-client.ts`. All keys are optional; missing settings take the defaults
(`src/core/defaults.ts`). See `template/booking.seed.json` (minimal) and
`demo/booking.seed.json` (complete).

```jsonc
{
  "settings": {
    "businessName": "Leyaline Touch",
    "timezone": "Europe/Paris", "defaultLocale": "fr", "locales": ["fr", "en"], "currency": "EUR",
    "contact": { "email": "…", "phone": "…" },
    "base": { "address": "…", "lat": 48.54, "lng": 2.66 },     // lat/lng: or click Locate in the admin
    "zone": { "mode": "radius", "radiusKm": 20, "postcodes": [], "outOfZone": "request",
              "message": { "fr": "…" } },                       // mode: none | radius | postcodes
    "rules": { "slotStepMin": 30, "minNoticeMin": 720, "maxAdvanceDays": 60,
               "maxPerDay": 0, "travelBufferMin": 30 },
    "policies": { "confirmation": "instant", "allowClientCancel": true,
                  "allowClientReschedule": true, "changeUntilHours": 24, "text": { "fr": "…" } },
    "reminders": { "enabled": true, "hoursBefore": 24 },
    "notifyEmails": ["owner@example.fr"],
    "fields": [ /* §7 */ ],
    "appearance": { "preset": "rose", "custom": {} },
    "terms": { "title": {}, "body": {} }                         // empty = default model; or your text per locale
  },
  "weekly": { "mon": [{ "start": "09:00", "end": "12:30" }, { "start": "14:00", "end": "19:00" }], "sun": [] },
  "categories": [{ "id": "body", "name": { "fr": "Corps", "en": "Body" } }],
  "services": [{ "id": "lympheor", "name": { "fr": "…" }, "categoryId": "body", "durationMin": 90,
                 "price": 120, "wasPrice": 130, "badge": { "fr": "Offre découverte" },
                 "bufferBeforeMin": 0, "bufferAfterMin": 0, "location": "home" }],
  "admins": ["owner@example.fr"]
}
```

Order follows the arrays. Ids become the Firestore document ids; keep them stable and URL-safe,
because `serviceId` props use them.

---

## 9. Calendars

**For the client:**
- **Confirmation screen** and **manage page**: "Add to my calendar" offers **Google**,
  **Outlook** (outlook.live.com) and **Apple / other (.ics)**.
- The `.ics` button points to `GET /api/booking/manage/ics?t=…`, which is served as
  `text/calendar`. iPhones and Macs open it directly in Calendar.
- **E-mails:**
  - Confirmation, reschedule and cancellation e-mails attach an invitation (`.ics`, same UID).
    Calendar apps update or remove the event when the appointment changes.
  - Confirmation, reschedule and reminder e-mails also contain the three "add to calendar"
    links.
- The event contains the service, the business contact and the manage link.

**For the provider:**
- **Private feed.** Settings → **Sync with my calendar** creates a secret key in
  `bookingConfig/feed`. `GET /api/booking/feed.ics?k=<key>` returns pending, confirmed and
  completed appointments, from 60 days ago to 400 days ahead.
- Each event has the client's name, phone, address, answers, message and private notes, plus a
  link to the booking in the admin.
- Buttons subscribe in Google Calendar (`?cid=webcal://…`), Apple (`webcal://`) or Outlook.
  **Regenerate** replaces the key, so the old URL stops working.
- **Update speed depends on the calendar app.** Google polls subscribed calendars slowly
  (several hours). Apple and Outlook are faster. The feed asks for a 30-minute refresh.
- A local feed URL (`localhost`) can't be reached by Google, Apple or Outlook. Test it with
  `curl` or by importing the file.

Builders are in `src/core/ics.ts` (`buildIcs`, `buildCalendar`, `googleCalendarUrl`,
`outlookCalendarUrl`) and `src/core/calendar.ts` (`appointmentEvent`, `providerEvent`).

### General terms

- **Storage:** `Settings.terms = { title, body, updatedAt }`, per locale. An empty text means the
  **default model** (`DEFAULT_TERMS_BODY` in `src/core/terms.ts`, French and English).
- **What the model covers:** booking, prices with payment on site, client
  cancellation/changes (uses `policies.changeUntilHours`), provider cancellation, lateness, the
  service and health information, home visits, the 14-day withdrawal right, personal data,
  mediation, and French law.
- **What still needs filling in:** the consumer mediator (a placeholder in brackets). The admin
  warns while it is not completed. The model is a starting point, not legal advice.
- **Placeholders**, filled when displayed: `{business} {address} {email} {phone}
  {changeUntilHours} {updated}`.
- **`resolveTerms(settings)`** returns the display text per locale, served in `/config` as
  `terms: { title, body, version }`.
- **Text format:**
  - paragraphs separated by blank lines
  - `## ` headings
  - `- ` lists
  - `**bold**` and `[links](url)`
  
  Parsed by `richBlocks` / `inlineParts`, rendered by `RichBody`.
- **Where it shows:**
  - The consent checkbox links to `#terms`, which opens a `<dialog>` from the widget.
  - `<BookingTerms />` renders it as a page.
  - The admin edits it in Settings → Terms and conditions: default or own text per locale,
    "copy the model to edit", preview, back to default. If no checkbox links to `#terms`, a
    button adds it.
- **Versioning:** every booking stores `termsVersion` (the terms' `updatedAt` at booking time,
  or `"default-1"`). `updatedAt` changes when the provider saves a different title or text.
- **Other countries:** override the default by writing the text in the admin (or the seed), or
  change `DEFAULT_TERMS_BODY` for every site.

---

## 10. E-mails

| Kind | To | When |
|---|---|---|
| `confirmed` | client | instant booking, or a request approved by the provider (with `.ics` + calendar links) |
| `requested` | client | booking needs approval (request mode or out of area) |
| `declined` | client | provider declines a request |
| `cancelled` | client | cancelled by the provider (if "notify") or by the client (with `.ics` CANCEL) |
| `rescheduled` | client | moved by the provider (if "notify") or by the client |
| `reminder` | client | `hoursBefore` before, by `bookingJobs`; skipped if booked inside that window |
| `adminNew` | `notifyEmails` | every online booking (wording differs for requests) |
| `adminCancelled` / `adminRescheduled` | `notifyEmails` | the client cancelled / moved |

- **Rendering** is in `src/core/email.ts` and is pure, so it is unit-tested. The layout is a
  simple table-based HTML e-mail plus a plain-text version.
- **Overrides:** the provider overrides subject and body per kind and locale in the admin. The
  placeholders are `{name} {service} {date} {time} {duration} {price} {address} {business}`,
  plus `{previousDate} {previousTime}` for reschedules.
- **Reply-to:** client e-mails reply to `contact.email`; provider e-mails reply to the client.
- **Log:** every send attempt is written to `mailLog` (to, kind, subject, ok/error).
- **Deliverability:** verify the domain in Resend (SPF + DKIM), and send from an address on that
  domain.

---

## 11. Data model and security

| Path | Contents | Who writes |
|---|---|---|
| `bookingConfig/business` | `Settings` (see `src/core/types.ts`) | admin (UI) |
| `bookingConfig/weekly` | `WeeklyHours` | admin |
| `bookingConfig/admins` | `{ emails: [] }` | **setup script / console only** |
| `bookingConfig/feed` | `{ key }` for the calendar feed | admin |
| `services/{id}`, `categories/{id}` | | admin |
| `exceptions/{date}` | special days | admin |
| `blocks/{id}` | blocked time | admin |
| `bookings/{id}` | `Booking` (incl. `termsVersion`) | API only (admins may edit `notes`) |
| `clients/{id}` | `Client`, keyed by a hash of e-mail/phone | API (+ admin notes) |
| `bookingLocks/{date}` | transaction lock per day | API only |
| `mailLog/{id}` | e-mail attempts | API only |

- **Instants** are ISO-8601 UTC strings, so they sort and range-query as strings. **Wall-clock
  values** (`"09:00"`, `"2026-10-19"`) are in `Settings.timezone`.
- **Rules** (`template/firestore.rules`, tested in `tests/rules.emulator.test.ts`):
  - Only signed-in users with a **verified** e-mail listed in `bookingConfig/admins` can read or
    write. Anonymous visitors can't read anything.
  - Admins can't edit the admin list, and can only change `notes`/`updatedAt` on a booking.
- **No double booking:** every calendar write runs in a transaction that first reads
  `bookingLocks/{date}`, so concurrent requests for the same day are serialized. Inside it, the
  slot is re-checked with the same engine that produced the availability (`core/slots.ts`).
- **Manage links:** a random 24-byte token, stored on the booking (readable only by admins).
  Cancel and reschedule are checked against the policy window on the server.
- **Spam:** honeypot field, minimum fill time (3 s), per-IP rate limits (booking 8 per 10 min,
  address search 60 per minute, per instance).
- **Personal data (GDPR):**
  - Client data stays in the client's Firebase project.
  - The CSV export and the calendar feed contain personal data: the admin UI warns about both.
  - To delete a client, remove their `clients/` document and their bookings in the Firebase
    console. There is no UI for this yet.

**Indexes** (`template/firestore.indexes.json`): `bookings` on `(status, start)`,
`(status, end)` and `(clientId, start desc)`.

---

## 12. HTTP API

All routes are under `/api/booking` behind Hosting, or at the root of the function URL. JSON
in and out.

**Errors** look like `{ ok: false, error, details? }`. `error` is one of `invalid` (with
`details.fields`), `not_found`, `slot_taken`, `out_of_zone`, `too_late`, `not_allowed`, `rate`,
`unauthorized` or `server`.

| Route | |
|---|---|
| `GET /config` | public business info, services, categories, fields, policies, theme (cached 30 s) |
| `GET /availability?service=&from=&to=` | free start times per local date (≤ 62 days) |
| `GET /geocode?q=` | address suggestions with zone check |
| `POST /zone` | zone check of an address `{ label, postcode?, lat?, lng? }` |
| `POST /bookings` | create: `{ serviceId, start, client: { name, email, phone }, address?, fields, message?, locale, website, startedAt }` → `{ booking, token }` |
| `GET /manage?t=` | the booking as `PublicBooking` (with `canCancel`, `canReschedule`, `changeUntil`) |
| `GET /manage/availability?t=&from=&to=` | free times for rescheduling (ignores the booking itself) |
| `GET /manage/ics?t=` | `.ics` file of the booking |
| `POST /manage/cancel` | `{ token }` |
| `POST /manage/reschedule` | `{ token, start }` |
| `GET /feed.ics?k=` | provider's calendar feed |
| `GET /admin/me` | admin check |
| `GET /admin/slots?service=&from=&to=&exclude=` | free times ignoring notice/advance limits |
| `POST /admin/bookings` | create (phone booking): `{ serviceId, start, client, address?, notes?, status, notify, force }` |
| `POST /admin/bookings/:id/status` | `{ status: confirmed \| declined \| cancelled \| completed \| no_show, notify }` |
| `POST /admin/bookings/:id/move` | `{ start, notify, force }` |

Admin routes need `Authorization: Bearer <Firebase ID token>`. `force: true` skips the overlap
check. The provider decides; the UI asks first.

---

## 13. Local development and tests

```bash
npm install && npm --prefix demo install && npm --prefix demo/functions install
npm test               # unit tests: slots, time zones/DST, zones, fields, e-mails, .ics, themes, calendar
npm run test:emulator  # API, transactions, jobs, calendars and security rules (needs Java)
npm run typecheck
npm run build          # dist/
```

To run the demo (see [demo/README.md](../demo/README.md)):

```bash
npm --prefix demo/functions run build
firebase emulators:start --project demo-booking          # terminal 1
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 npx tsx scripts/setup-client.ts --project demo-booking --seed demo/booking.seed.json
npm run demo                                             # terminal 2 → http://localhost:5173
```

- The demo imports the module's sources directly (Vite aliases). The functions are bundled with
  esbuild; rebuild them after changing `src/functions` or `src/core`.
- The emulator UI is at http://127.0.0.1:4000. Sign-in links are under Authentication, and
  e-mails under Firestore → `mailLog`.
- `?lang=en` on `/admin/` shows the English admin.

**Testing a client site locally:**
- Run `firebase emulators:start` in the site (template `firebase.json` has the ports).
- Pass `emulators={{ auth: "http://127.0.0.1:9099", firestore: { host: "127.0.0.1", port: 8085 } }}`
  to `AdminApp` in development only.

---

## 14. Deployment and upgrades

- **Versioning:** tag releases (`git tag v0.2.0 && git push origin v0.2.0`). Each client pins a
  tag in two places: the site and `functions/`.
- **Upgrading a client:**
  1. Bump both dependencies to the new tag and run `npm install`.
  2. Run `npm run build`, then
     `firebase deploy --only hosting,functions,firestore:rules,firestore:indexes`.
  3. Check the release notes for new settings. Missing settings fall back to the defaults, so old
     data keeps working (`normalizeSettings`).
- **Staging:** a second Firebase project with `firebase use --add`. Give `siteUrl` and
  `mailFrom` as params so each project gets its own values.
- **Costs:** Firestore reads/writes, function invocations and Cloud Scheduler (one job, free
  tier of 3) stay within free quotas for a one-person business. Resend's free tier is 3,000
  e-mails/month.

---

## 15. Extending

- **SMS:** add a sender (Brevo, Twilio) next to `sendMail` in `src/functions/mailer.ts` and call
  it from `notify()` in `actions.ts` for the kinds you want (e.g. `reminder`). Keep it optional
  per client (an option of `createBookingFunctions` plus a secret).
- **Geocoder** for other countries: `createBookingFunctions({ geocoder: async (q, { limit, near }) => [{ label, postcode, city, lat, lng }] })`.
  With `"none"`, clients type their address and postcode, and only postcode zones can be
  checked.
- **Analytics:** `onStepChange` / `onBooked` on the widget, e.g. PostHog
  `capture("booking_step", { step })`.
- **Client-specific help:** `extraHelp={{ fr: [{ id: "tarifs", title: "…", summary: "…", blocks: ["…"] }] }}`
  on `AdminApp`.
- **Other frameworks:** the components are plain React. Vite or Remix work the same way. For a
  non-React site, mount the widget with `createRoot` in a small bundle, or put the booking page
  in an iframe.

---

## 16. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Widget shows "Connexion impossible" | `/api/booking/**` rewrite missing, or listed after a catch-all `/api/**`; function not deployed; wrong region in the rewrite |
| Admin: "n'a pas accès" after sign-in | e-mail not in `bookingConfig/admins` (run the setup script with `--admin`), or e-mail not verified |
| Admin stays on "Chargement…" | Firestore rules not deployed, or a missing index (the browser console prints a link that creates it) |
| No e-mails | `RESEND_API_KEY` not set, or sender domain not verified: check `mailLog` and the function logs |
| Every address is "out of area" | base address not located (Settings → Locate), or radius too small |
| Times off by one hour | wrong `Settings.timezone`; everything is computed in that zone |
| Sign-in link opens but asks for the e-mail again | link opened in another browser/device (the e-mail is remembered locally); type it to finish |
| Google Calendar subscription is out of date | normal Google polling delay; Apple/Outlook refresh faster |
| Style looks off on a client site | site CSS targeting `button`/`input` globally with high specificity: scope it, or raise the `--bk-*` variables on `.bk-root` |
