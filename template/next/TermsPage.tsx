"use client";
// Optional: app/(fr)/cgv/page.tsx → <TermsPage locale="fr" />. Same text as the pop-up in the
// booking form, edited by the provider in the admin (Settings → Terms and conditions).
import { BookingTerms } from "@mazerila/booking-kit/react";
import "@mazerila/booking-kit/styles.css";
import { bookingTheme } from "./booking.config";

export function TermsPage({ locale }: { locale: "fr" | "en" }) {
  return <BookingTerms locale={locale} theme={bookingTheme} />;
}
