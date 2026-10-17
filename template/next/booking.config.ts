/**
 * Shared settings of the booking pages. The theme here is the site's default look; the
 * provider can override it in the admin (Appearance), unless `useAdminTheme={false}`.
 */
import type { BookingTheme } from "@mazerila/booking-kit/react";

export const bookingTheme: BookingTheme = {
  primary: "#2e2c2f",
  accent: "#c98b86",
  surface: "#fffaf8",
  border: "#efdcd6",
  fontFamily: "var(--font-body)",
  headingFontFamily: "var(--font-heading)",
  radius: "16px",
};

// Firebase console → Project settings → Your apps → Web app (public values).
export const firebaseWebConfig = {
  apiKey: "…",
  authDomain: "my-client.firebaseapp.com",
  projectId: "my-client",
};
