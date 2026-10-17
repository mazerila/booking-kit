import { createBookingFunctions } from "@mazerila/booking-kit/functions";

// Secret (once): firebase functions:secrets:set RESEND_API_KEY
export const { bookingApi, bookingJobs } = createBookingFunctions({
  siteUrl: "https://example.fr",
  mailFrom: "Studio <rdv@example.fr>",
  managePath: { fr: "/rdv/", en: "/en/appointment/" },
  adminPath: "/admin/",
  // brand: { logoUrl: "https://…/logo.png" },   // colour follows the admin's Appearance
});

// A site can export its other functions here too (e.g. a contact form).
