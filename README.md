# booking-kit

A reusable appointment booking module for service-provider websites. Install it on each
client's site; the code is shared, and the look, texts, services and rules are set per client.

- **Booking widget**:
  - service → address check (home visits) → date and time → details → done.
  - Mobile-first, French and English, with "add to my calendar" (Google, Outlook, Apple).
- **Manage page**: the client cancels or reschedules from the link in the e-mails.
- **Admin**:
  - Agenda, calendar (day / week / month), bookings, phone bookings, clients.
  - Services, hours and days off, rules, travel area, form questions, e-mail texts.
  - **Appearance**: styles, colors and fonts with a live preview.
  - **Sync with my calendar** for the provider's phone.
  - Built-in **Help** guide in French and English.
- **Backend** (Firebase):
  - No double booking, e-mails with calendar invites, reminders, private calendar feed.
  - Security rules, one isolated project per client.

## Documentation

| For | Where |
|---|---|
| The provider (admin user) | inside the admin: **Aide / Help** (French and English) |
| Developers: setup, options, theming, API, data, deployment | [docs/developer-guide.md](docs/developer-guide.md) |
| What it does | [FEATURES.md](FEATURES.md) |
| How it works | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Run it locally | [demo/README.md](demo/README.md) |

## Quick start (new client site)

```bash
npm install github:mazerila/booking-kit#v0.3.0
npm --prefix functions install github:mazerila/booking-kit#v0.3.0
```

```tsx
<BookingWidget locale="fr" manageUrl="/rdv/" />           // booking page
<ManageBooking bookUrl="/reserver/" />                     // /rdv/
<AdminApp firebase={firebaseWebConfig} locale="fr" />      // /admin/
```

```ts
// functions/src/index.ts
export const { bookingApi, bookingJobs } = createBookingFunctions({
  siteUrl: "https://www.example.fr",
  mailFrom: "Studio <rdv@example.fr>",
});
```

Then add the Hosting rewrite, the rules and indexes (`template/`), set `RESEND_API_KEY`, seed the
business with `scripts/setup-client.ts`, and deploy. The full steps are in the
[developer guide](docs/developer-guide.md#2-setting-up-a-new-client).

## Development

```bash
npm install
npm test               # unit tests
npm run test:emulator  # API, jobs, calendars, security rules (Firebase emulators, needs Java)
npm run build
```
