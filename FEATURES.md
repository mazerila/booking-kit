# booking-kit — feature list

Reusable booking module for service-provider websites (first client: Leyaline Touch).
Goal: a solid, simple booking system — not cal.com. Everything client-specific (colors, sizes,
fields, texts, services, rules) lives in configuration, not in code.

Legend: **[v1]** must have · **[v1.1]** soon after · **[later]** optional / per client

**Status (v0.3.0):** every [v1] item is built, plus travel time between home visits, CSV export,
appearance editing, calendar sync for the provider and an in-app help guide. Not built yet:
packages / multi-session cures, add-ons, Google Calendar two-way sync, SMS, statistics,
client accounts.

---

## 1. Client side (public booking)

### Service catalog
- [v1] Services with name, description, duration, price, optional "was" price / offer badge
- [v1] Categories (e.g. Body / Face / Maternity)
- [v1] Per-service buffer time before/after
- [v1] Per-service location mode: at provider's place · at client's home · online
- [v1.1] Packages / multi-session "cures" (buy 5, book them one by one)
- [later] Add-ons (extra 15 min, option X)

### Booking flow (mobile-first, ≤ 4 steps)
- [v1] Service → date → time slot → details → confirm, with a visible step indicator and back button
- [v1] Real-time availability (only free slots shown; no double booking, even on simultaneous requests)
- [v1] Calendar shows days with/without availability at a glance; "next available" shortcut
- [v1] Summary before confirmation (service, date, duration, price, address)
- [v1] Two confirmation modes, configurable: **instant** or **request → provider approves**
- [v1] Confirmation screen + "add to calendar" (Google, Outlook, Apple .ics), also on the manage page and in the e-mails

### Home-visit support (needed for Leyaline)
- [v1] Address field with zone check (postal code list or radius in km from a base address)
- [v1] Out-of-zone message (e.g. "> 20 km: contact me" or extra travel fee)
- [v1.1] Automatic travel buffer between two home appointments

### Client form (fields chosen per site)
- [v1] Always: name, email, phone
- [v1] Configurable extra fields: text, textarea, select, checkbox, date, number — required or optional
  (e.g. pregnancy week, medical clearance checkbox, how did you hear about us, notes)
- [v1] Consent checkboxes (terms, cancellation policy, GDPR)
- [v1] General terms: default model (FR/EN) filled with the business details, editable by the
  provider, opened in a pop-up from the consent checkbox; optional terms page; version kept on each booking

### After booking
- [v1] Confirmation e-mail to client (with .ics, address, manage link)
- [v1] Reminder e-mail (e.g. 24 h before, configurable)
- [v1] Manage-booking link (no account needed): cancel or reschedule, within the policy window
  (e.g. not less than 24 h before)
- [per client] SMS reminders (Brevo / Twilio), only added when a client needs it
- [later] Post-visit e-mail asking for a Google review

### General
- [v1] Multilingual (FR/EN at start, texts in dictionaries like Leyaline)
- [v1] Accessible (keyboard, screen reader, contrast) and fast on mobile
- [v1] Time zone correct (provider's zone; shown to client)
- [later] Optional client account (history, rebook in one click)

---

## 2. Admin side (provider back-office)

### Access
- [v1] Secure login (e-mail link or Google), admin role only
- [v1] Responsive — usable on the provider's phone, not just desktop
- [later] Several staff members, each with their own schedule

### Dashboard & calendar
- [v1] Today / upcoming list with key info (client, service, address, phone — tap to call)
- [v1] Day / week / month calendar views
- [v1] Booking statuses: pending · confirmed · completed · cancelled · no-show
- [v1] Approve / decline pending requests (client is notified automatically)
- [v1] Create a booking manually (phone/WhatsApp bookings), edit, move, cancel
- [v1] E-mail notification to the provider on new / cancelled / changed booking
- [v1] Private calendar feed: bookings appear in her Google / iPhone / Outlook calendar (one-way)
- [later] Two-way Google Calendar sync (personal events block slots)

### Availability
- [v1] Weekly opening hours, several ranges per day (e.g. 9–12, 14–19)
- [v1] Exceptions: days off, holidays, one-off extra hours
- [v1] Block a time range quickly
- [v1] Booking rules: minimum notice (e.g. 12 h), max advance (e.g. 60 days),
  slot step (15/30 min), max bookings per day

### Services & clients
- [v1] Create / edit / reorder / hide services
- [v1] Client list (auto-built from bookings): contact, history, private notes
- [v1] Search and filter bookings / clients
- [v1.1] CSV export
- [v1.1] Package balance per client (3 of 5 sessions used)

### Appearance
- [v1] Style presets (website design, classic, powder pink, sage, sand, ocean, night)
- [v1] Custom colors, fonts, corners, button shape, text size, spacing, with a live preview
- [v1] Applies to the booking and manage pages, the e-mail buttons and the admin colors

### Help
- [v1] Built-in admin guide in French and English, searchable, linked from each screen

### Settings
- [v1] Business info (name, address, base location, zone, contact)
- [v1] Policies (cancellation window, confirmation mode)
- [v1] Editable e-mail texts (subject / body with placeholders)
- [later] Simple stats: bookings per month, revenue, popular services, no-show rate

---

## 3. Reusability (how it plugs into each new website)

- **One codebase, configured per site**: a config file declares services (or seed data), enabled
  features, form fields, locales, rules and texts.
- **Theming by design tokens** (CSS variables): colors, fonts, radius, spacing, button style —
  so the booking UI looks native in each site. Light/dark optional.
- **Two integration modes**
  - Next.js sites (like Leyaline): import the React components (`<BookingWidget />`, admin pages)
  - Any other site: script/iframe embed of the same widget
- **Works with static sites**: the front end calls a small backend API, so a static export
  (Firebase Hosting `out/`) still works.
- **Backend per client** (decided): each client gets their own database & functions (data isolated,
  costs ~0 € on free tiers), deployed from the same template with a setup script.
- Feature flags: turn off home visits, packages, approval mode, SMS… per site.

## 4. Explicitly out of scope
Online payments, deposits, vouchers and promo codes (payment happens on site), marketplace / directory, round-robin teams, video-call generation, complex multi-location
chains, invoicing/accounting, native mobile apps.
