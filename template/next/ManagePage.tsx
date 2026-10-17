"use client";
// app/(fr)/rdv/page.tsx → <ManagePage />  (the link in the e-mails: /rdv/?t=…)
import { ManageBooking } from "@mazerila/booking-kit/react";
import "@mazerila/booking-kit/styles.css";
import { bookingTheme } from "./booking.config";

export function ManagePage() {
  return <ManageBooking theme={bookingTheme} bookUrl="/reserver/" />;
}
