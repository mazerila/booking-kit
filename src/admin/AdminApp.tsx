"use client";
/**
 * The provider's back-office. Render it on a private page of the site:
 *
 *   <AdminApp firebase={{ apiKey: "…", authDomain: "…", projectId: "…" }} apiBase="/api/booking" locale="fr" />
 *
 * Sign-in with Google and/or an e-mail link; only e-mails listed in
 * bookingConfig/admins get in (enforced by the Firestore rules and the API).
 */
import type { FirebaseOptions } from "firebase/app";
import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { fill } from "../core/index.js";
import { BookingPanel } from "./BookingPanel.js";
import { AdminCtx, createAdminApi, initFirebase, useBusinessData, type AdminContext, type EmulatorConfig } from "./data.js";
import { NewBooking, type NewBookingPrefill } from "./NewBooking.js";
import { ADMIN_TEXTS, type AdminTexts } from "./texts.js";
import { AgendaView } from "./views/AgendaView.js";
import { AvailabilityView } from "./views/AvailabilityView.js";
import { CalendarView } from "./views/CalendarView.js";
import { ClientsView } from "./views/ClientsView.js";
import { ServicesView } from "./views/ServicesView.js";
import { SettingsView } from "./views/SettingsView.js";

export type AdminTheme = { primary?: string; onPrimary?: string; accent?: string; background?: string; surface?: string; fontFamily?: string; radius?: string };

export type AdminAppProps = {
  /** Web config of the client's Firebase project. */
  firebase: FirebaseOptions;
  apiBase?: string;
  locale?: "fr" | "en" | string;
  texts?: Partial<AdminTexts>;
  theme?: AdminTheme;
  /** Sign-in methods to offer. Default both. */
  signIn?: ("google" | "emailLink")[];
  /** Local development with the Firebase emulators. */
  emulators?: EmulatorConfig;
  /** Country code for WhatsApp links from national numbers. Default "33" (France). */
  phoneCountryCode?: string;
  className?: string;
};

type Route = "agenda" | "calendar" | "clients" | "services" | "availability" | "settings";
const ROUTES: Route[] = ["agenda", "calendar", "clients", "services", "availability", "settings"];
const EMAIL_KEY = "booking-admin-email";

function themeStyle(theme: AdminTheme = {}): CSSProperties {
  const map: Record<string, string | undefined> = {
    "--bka-primary": theme.primary,
    "--bka-on-primary": theme.onPrimary,
    "--bka-accent": theme.accent,
    "--bka-bg": theme.background,
    "--bka-surface": theme.surface,
    "--bka-font": theme.fontFamily,
    "--bka-radius": theme.radius,
  };
  return Object.fromEntries(Object.entries(map).filter(([, v]) => v)) as CSSProperties;
}

function parseHash(): { route: Route; booking?: string } {
  const h = typeof window === "undefined" ? "" : window.location.hash.replace(/^#\/?/, "");
  const [first, second] = h.split("/");
  if (first === "booking" && second) return { route: "agenda", booking: second };
  return { route: ROUTES.includes(first as Route) ? (first as Route) : "agenda" };
}

export function AdminApp(props: AdminAppProps) {
  const locale = props.locale ?? "fr";
  const t = useMemo(() => ({ ...(ADMIN_TEXTS[locale] ?? ADMIN_TEXTS.fr!), ...props.texts }), [locale, props.texts]);
  const { auth, db } = useMemo(() => initFirebase(props.firebase, props.emulators), [props.firebase, props.emulators]);
  const api = useMemo(() => createAdminApi(props.apiBase ?? "/api/booking", auth), [props.apiBase, auth]);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [allowed, setAllowed] = useState<boolean | undefined>(undefined);

  useEffect(() => onAuthStateChanged(auth, setUser), [auth]);

  // Ask the API whether this account is an admin (same list as the rules).
  useEffect(() => {
    if (!user) {
      setAllowed(undefined);
      return;
    }
    let cancelled = false;
    api.me().then(
      () => !cancelled && setAllowed(true),
      () => !cancelled && setAllowed(false),
    );
    return () => {
      cancelled = true;
    };
  }, [user, api]);

  const data = useBusinessData(db, !!allowed);

  return (
    <div className={`bka-root${props.className ? ` ${props.className}` : ""}`} style={themeStyle(props.theme)} lang={locale}>
      {user === undefined || (user && allowed === undefined) ? (
        <p className="bka-center bka-muted">{t.loading}</p>
      ) : !user ? (
        <SignIn t={t} auth={auth} methods={props.signIn ?? ["google", "emailLink"]} />
      ) : !allowed ? (
        <div className="bka-signin">
          <p>{fill(t.notAdmin, { email: user.email ?? "" })}</p>
          <button type="button" className="bka-btn" onClick={() => signOut(auth)}>
            {t.signOut}
          </button>
        </div>
      ) : !data.settings || !data.weekly || !data.services || !data.categories ? (
        <p className="bka-center bka-muted">{t.loading}</p>
      ) : (
        <Shell
          base={{
            db,
            auth,
            api,
            t,
            locale,
            settings: data.settings,
            weekly: data.weekly,
            services: data.services,
            categories: data.categories,
            phoneCountryCode: props.phoneCountryCode ?? "33",
          }}
          user={user}
        />
      )}
    </div>
  );
}

function SignIn({ t, auth, methods }: { t: AdminTexts; auth: ReturnType<typeof initFirebase>["auth"]; methods: ("google" | "emailLink")[] }) {
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(EMAIL_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(() => typeof window !== "undefined" && isSignInWithEmailLink(auth, window.location.href));

  async function completeLink(addr: string) {
    try {
      await signInWithEmailLink(auth, addr, window.location.href);
      try {
        localStorage.removeItem(EMAIL_KEY);
      } catch {
        // Storage unavailable: nothing to clean.
      }
      window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    } catch {
      setError(t.errorGeneric);
      setCompleting(false);
    }
  }

  // Coming back from the e-mail link on the same device: finish automatically.
  useEffect(() => {
    if (completing && email) void completeLink(email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (completing) return completeLink(email.trim());
    try {
      await sendSignInLinkToEmail(auth, email.trim(), { url: window.location.href.split("#")[0]!, handleCodeInApp: true });
      try {
        localStorage.setItem(EMAIL_KEY, email.trim());
      } catch {
        // The user will be asked to confirm their e-mail.
      }
      setSent(true);
    } catch {
      setError(t.errorGeneric);
    }
  }

  return (
    <div className="bka-signin">
      <h1>{t.signInTitle}</h1>
      <p className="bka-muted">{completing ? t.confirmEmail : t.signInIntro}</p>
      {error && <p className="bka-error">{error}</p>}
      {!completing && methods.includes("google") && (
        <button
          type="button"
          className="bka-btn bka-btn--primary bka-btn--block"
          onClick={() => signInWithPopup(auth, new GoogleAuthProvider()).catch((e: { code?: string }) => e.code !== "auth/popup-closed-by-user" && setError(t.errorGeneric))}
        >
          {t.signInGoogle}
        </button>
      )}
      {(methods.includes("emailLink") || completing) &&
        (sent ? (
          <p className="bka-success">{fill(t.linkSent, { email })}</p>
        ) : (
          <form onSubmit={sendLink} className="bka-form">
            <label className="bka-label" htmlFor="bka-email">
              {t.emailLabel}
            </label>
            <input id="bka-email" className="bka-input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" className="bka-btn bka-btn--block">
              {completing ? t.signIn : t.signInEmail}
            </button>
          </form>
        ))}
    </div>
  );
}

type Toast = { id: number; message: string; kind: "success" | "error" };

function Shell({ base, user }: { base: Omit<AdminContext, "openBooking" | "newBooking" | "toast">; user: User }) {
  const { t, auth, settings } = base;
  const [{ route, booking }, setNav] = useState(parseHash);
  const [prefill, setPrefill] = useState<NewBookingPrefill | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    const onHash = () => setNav(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const toast = useCallback((message: string, kind: "success" | "error" = "success") => {
    const id = ++nextId.current;
    setToasts((ts) => [...ts, { id, message, kind }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3000);
  }, []);

  const openBooking = useCallback((id: string) => setNav((n) => ({ ...n, booking: id })), []);
  const closeBooking = useCallback(() => {
    setNav((n) => ({ route: n.route }));
    if (window.location.hash.startsWith("#/booking/")) window.history.replaceState(null, "", "#/agenda");
  }, []);
  const ctx: AdminContext = { ...base, openBooking, newBooking: (p = {}) => setPrefill(p), toast };

  const labels: Record<Route, string> = {
    agenda: t.navAgenda,
    calendar: t.navCalendar,
    clients: t.navClients,
    services: t.navServices,
    availability: t.navAvailability,
    settings: t.navSettings,
  };
  const icons: Record<Route, string> = {
    agenda: "M4 6h16M4 12h16M4 18h10",
    calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
    clients: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
    services: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8ZM7 7h.01",
    availability: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
  };

  return (
    <AdminCtx.Provider value={ctx}>
      <div className="bka-shell">
        <aside className="bka-side">
          <div className="bka-brand">
            <strong>{settings.businessName || t.appTitle}</strong>
            <span className="bka-muted">{user.email}</span>
          </div>
          <nav className="bka-nav" aria-label={t.appTitle}>
            {ROUTES.map((r) => (
              <a key={r} href={`#/${r}`} className={`bka-nav__item${route === r ? " bka-nav__item--on" : ""}`} aria-current={route === r ? "page" : undefined}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={icons[r]} />
                </svg>
                <span>{labels[r]}</span>
              </a>
            ))}
          </nav>
          <button type="button" className="bka-link bka-signout" onClick={() => signOut(auth)}>
            {t.signOut}
          </button>
        </aside>
        <main className="bka-main">
          {route === "agenda" && <AgendaView />}
          {route === "calendar" && <CalendarView />}
          {route === "clients" && <ClientsView />}
          {route === "services" && <ServicesView />}
          {route === "availability" && <AvailabilityView />}
          {route === "settings" && <SettingsView />}
        </main>
      </div>
      {prefill && <NewBooking prefill={prefill} onClose={() => setPrefill(null)} />}
      {booking && <BookingPanel id={booking} onClose={closeBooking} />}
      <div className="bka-toasts" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={`bka-toast bka-toast--${x.kind}`} role={x.kind === "error" ? "alert" : "status"}>
            {x.message}
          </div>
        ))}
      </div>
    </AdminCtx.Provider>
  );
}
