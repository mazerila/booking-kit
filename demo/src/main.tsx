/**
 * Demo site: three pages a client site would have.
 *   /        booking widget
 *   /rdv/    manage-booking page (link in the e-mails)
 *   /admin/  back-office
 * The header's theme switcher is the developer's theme (code); the admin's
 * Appearance page overrides it for the provider (try "Nuit").
 */
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { AdminApp } from "@mazerila/booking-kit/admin";
import { BookingWidget, ManageBooking, type BookingTheme } from "@mazerila/booking-kit/react";
import "@mazerila/booking-kit/styles.css";
import "@mazerila/booking-kit/admin.css";
import "./demo.css";

const firebase = { apiKey: "demo-key", authDomain: "demo-booking.firebaseapp.com", projectId: "demo-booking" };
const emulators = { auth: "http://127.0.0.1:9099", firestore: { host: "127.0.0.1", port: 8085 } };

const themes: Record<string, BookingTheme> = {
  // Soft, rounded: a wellness practice.
  rose: {
    primary: "#2e2c2f",
    accent: "#c98b86",
    surface: "#fffaf8",
    border: "#efdcd6",
    fontFamily: "Inter, system-ui, sans-serif",
    headingFontFamily: "'Cormorant Garamond', Georgia, serif",
    radius: "16px",
  },
  // Sharp, blue: a consultant or a garage.
  slate: {
    primary: "#1d4ed8",
    accent: "#60a5fa",
    surface: "#ffffff",
    border: "#dbe1ea",
    fontFamily: "system-ui, sans-serif",
    radius: "6px",
    buttonRadius: "6px",
    density: "compact",
  },
};

function Site() {
  const [themeName, setThemeName] = useState("rose");
  const [locale, setLocale] = useState("fr");
  const path = window.location.pathname;

  if (path.startsWith("/admin")) {
    // Language of the admin: ?lang=en, otherwise French.
    const adminLocale = new URLSearchParams(window.location.search).get("lang") === "en" ? "en" : "fr";
    return <AdminApp firebase={firebase} emulators={emulators} locale={adminLocale} siteBookingUrl="/" />;
  }

  return (
    <div className={`demo demo--${themeName}`}>
      <header className="demo__bar">
        <a href="/" className="demo__logo">
          Studio Lumière
        </a>
        <nav>
          <select value={themeName} onChange={(e) => setThemeName(e.target.value)} aria-label="Theme">
            <option value="rose">Theme: rose</option>
            <option value="slate">Theme: slate</option>
          </select>
          <select value={locale} onChange={(e) => setLocale(e.target.value)} aria-label="Language">
            <option value="fr">FR</option>
            <option value="en">EN</option>
          </select>
          <a href="/admin/">Admin</a>
        </nav>
      </header>
      <main className="demo__main">
        {path.startsWith("/rdv") ? (
          <ManageBooking theme={themes[themeName]} bookUrl="/" />
        ) : (
          <BookingWidget key={locale} locale={locale} theme={themes[themeName]} manageUrl="/rdv/" onStepChange={(s) => console.debug("[demo] step", s)} />
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Site />
  </StrictMode>,
);
