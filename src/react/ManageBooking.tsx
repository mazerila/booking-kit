"use client";
/**
 * Page behind the link in the e-mails: shows the appointment and lets the
 * client cancel or reschedule it within the policy window.
 *
 *   <ManageBooking apiBase="/api/booking" />   // reads ?t= from the URL
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { fill, formatDate, formatTime, mergeThemes, type BookingStatus, type PublicBooking, type PublicConfig } from "../core/index.js";
import { BookingApiError, createApi } from "./api.js";
import { DateTimePicker } from "./DateTimePicker.js";
import { CalendarLinks, SummaryCard } from "./steps.js";
import { textsFor, type BookingTexts } from "./texts.js";
import { themeStyle, useThemeFonts, type BookingTheme } from "./theme.js";
import { Alert, ContactLine, Ctx, errorText, Spinner, useWidget } from "./ui.js";

export type ManageBookingProps = {
  apiBase?: string;
  /** Default: `t` (or `token`) from the page URL. */
  token?: string;
  /** Default: the booking's language. */
  locale?: string;
  theme?: BookingTheme;
  texts?: Record<string, Partial<BookingTexts>>;
  /** Link to book again after a cancellation. */
  bookUrl?: string;
  /** Apply the look chosen in the admin over `theme`. Default true. */
  useAdminTheme?: boolean;
  /** Load Google fonts used by the theme. Set false if the site loads them itself (or for GDPR reasons). Default true. */
  loadFonts?: boolean;
  className?: string;
};

const statusKey: Record<BookingStatus, keyof BookingTexts> = {
  pending: "statusPending",
  confirmed: "statusConfirmed",
  cancelled: "statusCancelled",
  declined: "statusDeclined",
  completed: "statusCompleted",
  no_show: "statusNoShow",
};

function tokenFromUrl() {
  if (typeof window === "undefined") return "";
  const p = new URLSearchParams(window.location.search);
  return p.get("t") ?? p.get("token") ?? "";
}

export function ManageBooking(props: ManageBookingProps) {
  const api = useMemo(() => createApi(props.apiBase ?? "/api/booking"), [props.apiBase]);
  const [token, setToken] = useState(props.token ?? "");
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The token comes from the URL on the client (works with static export).
  useEffect(() => {
    if (!props.token) setToken(tokenFromUrl());
  }, [props.token]);

  const locale = props.locale ?? booking?.locale ?? config?.defaultLocale ?? "fr";
  const t = useMemo(() => textsFor(locale, props.texts), [locale, props.texts]);
  const theme = useMemo(() => mergeThemes(props.theme, props.useAdminTheme === false ? undefined : config?.theme), [props.theme, props.useAdminTheme, config?.theme]);
  useThemeFonts(theme, props.loadFonts !== false);

  useEffect(() => {
    if (!token) {
      if (typeof window !== "undefined" && !props.token && !tokenFromUrl()) setError(errorText(t, "not_found"));
      return;
    }
    Promise.all([api.config(), api.manage(token)]).then(
      ([c, m]) => {
        setConfig(c);
        setBooking(m.booking);
      },
      (e: BookingApiError) => setError(errorText(t, e.code)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, token]);

  return (
    <div className={`bk-root${props.className ? ` ${props.className}` : ""}`} style={themeStyle(theme)} lang={locale}>
      {error && !booking ? (
        <Alert>{error}</Alert>
      ) : !config || !booking ? (
        <Spinner label={t.loading} />
      ) : (
        <Ctx.Provider value={{ api, config, locale, t }}>
          <Manage booking={booking} token={token} onChange={setBooking} bookUrl={props.bookUrl} />
        </Ctx.Provider>
      )}
    </div>
  );
}

function Manage({ booking, token, onChange, bookUrl }: { booking: PublicBooking; token: string; onChange: (b: PublicBooking) => void; bookUrl?: string }) {
  const { api, config, locale, t } = useWidget();
  const [mode, setMode] = useState<"view" | "confirmCancel" | "reschedule">("view");
  const [start, setStart] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const tz = config.timezone;

  const load = useCallback((from: string, to: string) => api.manageAvailability(token, from, to), [api, token]);

  async function run(action: () => Promise<{ booking: PublicBooking }>, done: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await action();
      onChange(r.booking);
      setNotice(done);
      setMode("view");
      setStart(undefined);
    } catch (e) {
      const code = (e as BookingApiError).code;
      setError(errorText(t, code));
      if (code === "slot_taken") {
        setStart(undefined);
        setReloadKey((k) => k + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  const active = booking.status === "pending" || booking.status === "confirmed";
  const until = Date.parse(booking.changeUntil);
  const changeUntil = { date: formatDate(until, tz, locale, { year: undefined }), time: formatTime(until, tz, locale) };

  return (
    <div className="bk-manage">
      <h2 className="bk-title">{t.manageTitle}</h2>
      <p>
        <span className={`bk-status bk-status--${booking.status}`}>{t[statusKey[booking.status]]}</span>
      </p>
      <SummaryCard service={booking.service} start={booking.start} address={booking.where} />

      {notice && <Alert kind="success">{notice}</Alert>}
      {error && <Alert>{error}</Alert>}

      {active && mode === "view" && (
        <>
          {booking.status === "confirmed" && <CalendarLinks booking={booking} token={token} manageHref={typeof window !== "undefined" ? window.location.href : undefined} />}
          {booking.canCancel || booking.canReschedule ? (
            <>
              <div className="bk-actions">
                {booking.canReschedule && (
                  <button type="button" className="bk-btn bk-btn--primary" onClick={() => (setMode("reschedule"), setNotice(null))}>
                    {t.reschedule}
                  </button>
                )}
                {booking.canCancel && (
                  <button type="button" className="bk-btn bk-btn--danger-outline" onClick={() => (setMode("confirmCancel"), setNotice(null))}>
                    {t.cancel}
                  </button>
                )}
              </div>
              <p className="bk-help">{fill(t.changeUntil, changeUntil)}</p>
            </>
          ) : (
            <>
              <p className="bk-muted">{t.noChangeOnline}</p>
              <ContactLine />
            </>
          )}
        </>
      )}

      {mode === "confirmCancel" && (
        <div className="bk-confirm" role="alertdialog" aria-label={t.cancelConfirm}>
          <p className="bk-summary__title">{t.cancelConfirm}</p>
          <div className="bk-actions">
            <button type="button" className="bk-btn bk-btn--danger" disabled={busy} onClick={() => run(() => api.cancel(token), t.cancelled)}>
              {busy ? t.sending : t.cancelYes}
            </button>
            <button type="button" className="bk-btn bk-btn--secondary" onClick={() => setMode("view")}>
              {t.cancelNo}
            </button>
          </div>
        </div>
      )}

      {mode === "reschedule" && (
        <div className="bk-reschedule">
          <h3 className="bk-subtitle">{t.rescheduleTitle}</h3>
          <DateTimePicker load={load} value={start} initial={booking.start} onChange={setStart} reloadKey={reloadKey} />
          <div className="bk-sticky bk-actions">
            <button type="button" className="bk-btn bk-btn--primary" disabled={!start || start === booking.start || busy} onClick={() => run(() => api.reschedule(token, start!), t.rescheduled)}>
              {busy ? t.sending : t.rescheduleConfirm}
            </button>
            <button type="button" className="bk-btn bk-btn--secondary" onClick={() => setMode("view")}>
              {t.back}
            </button>
          </div>
        </div>
      )}

      {!active && bookUrl && (
        <a className="bk-btn bk-btn--secondary" href={bookUrl}>
          {t.bookAnother}
        </a>
      )}
    </div>
  );
}
