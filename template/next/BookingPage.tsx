"use client";
// app/(fr)/reserver/page.tsx → <BookingPage locale="fr" />  (and the English route with "en")
import { BookingWidget } from "@mazerila/booking-kit/react";
import "@mazerila/booking-kit/styles.css";
import { bookingTheme } from "./booking.config";

export function BookingPage({ locale, serviceId }: { locale: "fr" | "en"; serviceId?: string }) {
  return (
    <BookingWidget
      locale={locale}
      theme={bookingTheme}
      serviceId={serviceId}
      manageUrl={locale === "en" ? "/en/appointment/" : "/rdv/"}
      // onStepChange={(step) => posthog.capture("booking_step", { step })}
    />
  );
}
