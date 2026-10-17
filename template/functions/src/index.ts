import { createBookingFunctions } from "@mazerila/booking-kit/functions";

// Secret (once): firebase functions:secrets:set RESEND_API_KEY
export const { bookingApi, bookingJobs } = createBookingFunctions({
  siteUrl: "https://example.fr",
  mailFrom: "Studio <rdv@example.fr>",
  managePath: { fr: "/rdv/", en: "/en/appointment/" },
  adminPath: "/admin/",
  brand: { color: "#2e2c2f" },
});

// A site can export its other functions here too (e.g. a contact form).
