# booking-kit

A reusable booking system for service-provider websites. It has a client booking widget, a
"manage my appointment" page, an admin back-office and a Firebase backend. Each client site
installs the same package and gets its own Firebase project. Colors, texts, form questions and
rules change per site, and the code stays the same.

- What it does: [FEATURES.md](FEATURES.md)
- How it works: [ARCHITECTURE.md](ARCHITECTURE.md)
- Try it locally: [demo/README.md](demo/README.md)

## Package layout

| Import | What | Runs in |
|---|---|---|
| `@mazerila/booking-kit/react` | `<BookingWidget />`, `<ManageBooking />` | browser (React 19) |
| `@mazerila/booking-kit/admin` | `<AdminApp />` | browser (React 19 + Firebase web SDK) |
| `@mazerila/booking-kit/functions` | `createBookingFunctions()` → `bookingApi`, `bookingJobs` | Cloud Functions (Node 22) |
| `@mazerila/booking-kit/core` | types, slot engine, e-mail rendering… | anywhere |
| `@mazerila/booking-kit/styles.css`, `/admin.css` | stylesheets | browser |

## Adding the module to a new client site

The examples assume a Next.js site with static export on Firebase Hosting, like Leyaline.
Ready-to-copy files are in [`template/`](template/).

### 1. Firebase project

1. Create a Firebase project (Blaze plan, needed for Functions; normal use stays in the free quotas).
2. Enable **Firestore** (region `eur3` or `europe-west1`) and **Authentication** → Sign-in
   methods: **Google** and/or **Email link**. Add the site domain to *Authorized domains*.
3. Create a **Web app** and copy its config into `booking.config.ts`.
4. Copy `template/firestore.rules` and `template/firestore.indexes.json` into the site, and
   merge `template/firebase.json` into its own (the `/api/booking/**` rewrite matters).

### 2. Install

```bash
npm install github:mazerila/booking-kit#v0.1.0               # in the site
npm --prefix functions install github:mazerila/booking-kit#v0.1.0
```

Pin a tag so each client upgrades on its own schedule. For local development against a
checkout, use `npm install ../booking-kit`.

### 3. Pages

```tsx
// Booking page
<BookingWidget locale="fr" theme={bookingTheme} manageUrl="/rdv/" />
// From a service page: preselect it
<BookingWidget locale="fr" theme={bookingTheme} serviceId="drainage-body" manageUrl="/rdv/" />

// /rdv/ — the link in the e-mails
<ManageBooking theme={bookingTheme} bookUrl="/reserver/" />

// /admin/ — keep it out of search engines
<AdminApp firebase={firebaseWebConfig} locale="fr" />
```

Import `@mazerila/booking-kit/styles.css` (and `admin.css` on the admin page). See
`template/next/` for complete components.

### 4. Functions

```ts
// functions/src/index.ts
import { createBookingFunctions } from "@mazerila/booking-kit/functions";

export const { bookingApi, bookingJobs } = createBookingFunctions({
  siteUrl: "https://leyalinetouch.fr",
  mailFrom: "Leyaline Touch <rdv@leyalinetouch.fr>",
  managePath: { fr: "/rdv/", en: "/en/appointment/" },
  brand: { color: "#2e2c2f" },
});
```

```bash
firebase functions:secrets:set RESEND_API_KEY      # resend.com, sender domain verified
```

The functions can live next to other functions the site already has (e.g. a contact form).

### 5. Business data

Copy `template/booking.seed.json` and fill in the business, hours, services and admin
e-mail. Then:

```bash
gcloud auth application-default login
npx tsx node_modules/@mazerila/booking-kit/scripts/setup-client.ts --project my-client --seed booking.seed.json
```

Existing data is kept unless `--force` is given. The script can be run again to add an admin:
`--admin someone@example.com`. Everything else is then edited by the provider in the admin.

### 6. Deploy

```bash
npm run build && firebase deploy --only hosting,functions,firestore
```

## Customizing per site

**Look.** Pass `theme` to the widget (`primary`, `accent`, `surface`, `border`, `text`,
`muted`, `radius`, `buttonRadius`, `fontFamily`, `headingFontFamily`, `fontSize`,
`density: "compact"`). You can also set the `--bk-*` CSS variables on `.bk-root` from the
site's CSS. On a colored page, set `--bk-sticky-bg` to the page color. The layout follows the
width of its container, so it works in a narrow column too. The admin takes a smaller `theme`
(`--bka-*` variables).

**Texts.** Override any UI string per language:
`texts={{ fr: { confirm: "Je réserve", chooseService: "Quel soin ?" } }}`. The full list
of keys is `BOOKING_TEXTS.fr` in `src/react/texts.ts`. The provider edits e-mail texts in
the admin (Réglages → Textes des e-mails).

**Form questions.** Set them in the admin (Réglages → Questions du formulaire) or in the
seed file under `settings.fields`. The types are text, textarea, select, checkbox, number,
date, email and tel. A question can be required, and can apply only to some services or
categories. A required checkbox works as a consent, and `[label](/url/)` turns part of its
label into a link.

**Which services.** `serviceIds={[…]}` or `categoryId="…"` limits a widget to some services.
For example, a maternity page can show only the maternity treatments.

**Behavior** (in the admin):
- instant confirmation or requests to approve
- client cancel/reschedule window
- reminder timing
- service area: none, radius in km from the base address, or postcode list; out-of-area
  bookings are refused or become requests
- travel time around home visits
- minimum notice, booking horizon, slot interval, maximum per day

**Analytics.** `onStepChange(step, service)` and `onBooked(booking)` on the widget.

## Development

```bash
npm install
npm test               # unit tests (slot engine, zones, fields, e-mails, .ics)
npm run test:emulator  # functions + security rules against the Firestore/Auth emulators (needs Java)
npm run typecheck
npm run build          # → dist/
```

To run the demo, see [demo/README.md](demo/README.md).

## Notes

- **Time zones.** All rules use the business time zone. Clients in another zone see a note.
  Daylight-saving changes are handled.
- **Double booking.** Every booking runs in a Firestore transaction that locks the day, so two
  people can't take the same slot.
- **Privacy.** The public site never reads Firestore. It only gets services, free slots and
  its own booking through its private link. Client data is readable only by admins
  (`firestore.rules`, tested). Spam protection is a honeypot field, a minimum fill time and a
  per-IP rate limit.
- **E-mails.** Sent with Resend. Without a key they are only logged, in the functions logs and
  in the `mailLog` collection. Confirmations and changes include a calendar file (.ics).
- **SMS.** Not included: add it per client when needed (Brevo/Twilio in `notify()`).
- **Address search.** Uses the free French national address base. For other countries, pass
  your own `geocoder` to `createBookingFunctions`, or `geocoder: "none"` to ask for a
  postcode instead.
