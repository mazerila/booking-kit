"use client";
// app/(fr)/admin/page.tsx → <AdminPage />, with `export const metadata = { robots: { index: false } }`
// in the page file. The admin is fully client-side, so it works with `output: "export"`.
import { AdminApp } from "@mazerila/booking-kit/admin";
import "@mazerila/booking-kit/admin.css";
// The widget styles are needed for the live preview in Appearance.
import "@mazerila/booking-kit/styles.css";
import { firebaseWebConfig } from "./booking.config";

export function AdminPage() {
  return (
    <AdminApp
      firebase={firebaseWebConfig}
      locale="fr"
      siteBookingUrl="/reserver/"
      support={{ name: "Your name", email: "you@example.com" }}
    />
  );
}
