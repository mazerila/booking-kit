"use client";
/**
 * Public booking flow: service → (address, for home visits) → date & time → details → done.
 *
 *   <BookingWidget apiBase="/api/booking" locale="fr" theme={{ primary: "#2e2c2f" }} manageUrl="/rdv/" />
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mergeThemes, pick, type PublicBooking, type PublicConfig, type Service } from "../core/index.js";
import { BookingApiError, createApi, type BookingApi } from "./api.js";
import { DateTimePicker } from "./DateTimePicker.js";
import { AddressStep, DetailsStep, DoneStep, emptyDetails, ServiceStep, SummaryCard, type Details, type ZoneState } from "./steps.js";
import { textsFor, type BookingTexts } from "./texts.js";
import { themeStyle, useThemeFonts, type BookingTheme } from "./theme.js";
import { Alert, Ctx, errorText, Icon, Spinner, useWidget } from "./ui.js";

export type BookingStep = "service" | "address" | "datetime" | "details" | "done";

export type BookingWidgetProps = {
  /** Base URL of the booking API. Default "/api/booking" (Firebase Hosting rewrite). */
  apiBase?: string;
  /** UI language. Default: the business default locale. */
  locale?: string;
  theme?: BookingTheme;
  /** Text overrides per locale: `{ fr: { confirm: "Je réserve" } }`. */
  texts?: Record<string, Partial<BookingTexts>>;
  /** Start with this service selected (e.g. from a "Book" button on a service page). */
  serviceId?: string;
  /** Only offer these services / this category. */
  serviceIds?: string[];
  categoryId?: string;
  /** Page rendering <ManageBooking />; the done screen links to it with the token. */
  manageUrl?: string;
  showPrices?: boolean;
  /** Free "message" field at the end of the form. Default true. */
  askMessage?: boolean;
  /** Heading above the flow; set to null to hide it. */
  title?: string | null;
  onBooked?: (booking: PublicBooking) => void;
  /** Analytics hook. */
  onStepChange?: (step: BookingStep, service?: Service) => void;
  /** Apply the look chosen in the admin over `theme`. Default true. */
  useAdminTheme?: boolean;
  /** Load Google fonts used by the theme. Set false if the site loads them itself (or for GDPR reasons). Default true. */
  loadFonts?: boolean;
  className?: string;
};

export function BookingWidget(props: BookingWidgetProps) {
  const api = useMemo(() => createApi(props.apiBase ?? "/api/booking"), [props.apiBase]);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const locale = props.locale ?? config?.defaultLocale ?? "fr";
  const t = useMemo(() => textsFor(locale, props.texts), [locale, props.texts]);
  const theme = useMemo(() => mergeThemes(props.theme, props.useAdminTheme === false ? undefined : config?.theme), [props.theme, props.useAdminTheme, config?.theme]);
  useThemeFonts(theme, props.loadFonts !== false);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    api.config().then(
      (c) => !cancelled && setConfig(c),
      (e: BookingApiError) => !cancelled && setLoadError(errorText(t, e.code)),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, attempt]);

  return (
    <div className={`bk-root${props.className ? ` ${props.className}` : ""}`} style={themeStyle(theme)} lang={locale}>
      {loadError ? (
        <Alert>
          <p>{loadError}</p>
          <button type="button" className="bk-btn bk-btn--secondary" onClick={() => setAttempt((a) => a + 1)}>
            {t.continue}
          </button>
        </Alert>
      ) : !config ? (
        <Spinner label={t.loading} />
      ) : (
        <Ctx.Provider value={{ api, config, locale, t }}>
          <Flow {...props} api={api} />
        </Ctx.Provider>
      )}
    </div>
  );
}

function Flow(props: BookingWidgetProps & { api: BookingApi }) {
  const { config, locale, t, api } = useWidget();
  const services = useMemo(
    () =>
      config.services.filter(
        (s) => (!props.serviceIds || props.serviceIds.includes(s.id)) && (!props.categoryId || s.categoryId === props.categoryId),
      ),
    [config.services, props.serviceIds, props.categoryId],
  );
  const preset = props.serviceId ? config.services.find((s) => s.id === props.serviceId) : services.length === 1 ? services[0] : undefined;

  const [service, setService] = useState<Service | undefined>(preset);
  const [step, setStep] = useState<BookingStep>(preset ? (needsAddress(preset) ? "address" : "datetime") : "service");
  const [zone, setZone] = useState<ZoneState | null>(null);
  const [start, setStart] = useState<string>();
  const [details, setDetails] = useState<Details>(emptyDetails);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<{ booking: PublicBooking; token?: string } | null>(null);
  const startedAt = useRef(Date.now());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  const go = useCallback((next: BookingStep) => {
    setError(null);
    setStep(next);
  }, []);

  // Focus the step heading so keyboard and screen-reader users follow along, and keep it in view.
  useEffect(() => {
    props.onStepChange?.(step, service);
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
    const top = rootRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const steps: BookingStep[] = ["service", ...(service && needsAddress(service) ? (["address"] as const) : []), "datetime", "details"];
  const stepLabels: Record<BookingStep, string> = {
    service: t.stepService,
    address: t.stepAddress,
    datetime: t.stepDate,
    details: t.stepDetails,
    done: "",
  };
  const index = steps.indexOf(step);
  const pending = config.policies.confirmation === "request" || zone?.inZone === false;

  const load = useCallback((from: string, to: string) => api.availability(service!.id, from, to), [api, service]);

  async function submit(website: string) {
    if (!service || !start) return;
    setSubmitting(true);
    setError(null);
    setFieldErrors([]);
    try {
      const fields = Object.fromEntries(Object.entries(details.fields).filter(([, v]) => v !== ""));
      const r = await api.book({
        serviceId: service.id,
        start,
        client: { name: details.name.trim(), email: details.email.trim(), phone: details.phone.trim() },
        address: zone?.address,
        fields,
        message: details.message.trim() || undefined,
        locale,
        website,
        startedAt: startedAt.current,
      });
      if (r.booking) {
        setResult({ booking: r.booking, token: r.token });
        props.onBooked?.(r.booking);
        go("done");
      }
    } catch (e) {
      const err = e as BookingApiError;
      if (err.code === "slot_taken") {
        setStart(undefined);
        setReloadKey((k) => k + 1);
        go("datetime");
        setError(t.errorSlotTaken);
      } else {
        if (err.details?.fields) setFieldErrors(err.details.fields);
        setError(errorText(t, err.code));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setResult(null);
    setStart(undefined);
    setDetails((d) => ({ ...d, fields: {}, message: "" }));
    startedAt.current = Date.now();
    if (preset) go(needsAddress(preset) ? "address" : "datetime");
    else {
      setService(undefined);
      go("service");
    }
  }

  const title = props.title === undefined ? t.chooseService : props.title;
  const headings: Record<BookingStep, string> = {
    service: title ?? t.chooseService,
    address: t.addressTitle,
    datetime: t.dateTitle,
    details: t.detailsTitle,
    done: "",
  };

  return (
    <div className="bk-flow" ref={rootRef}>
      {step !== "done" && (
        <ol className="bk-steps" aria-label={t.summary}>
          {steps.map((s, i) => (
            <li key={s} className={`bk-steps__item${i === index ? " bk-steps__item--current" : ""}${i < index ? " bk-steps__item--done" : ""}`} aria-current={i === index ? "step" : undefined}>
              <span className="bk-steps__dot">{i < index ? <Icon name="check" size={13} /> : i + 1}</span>
              <span className="bk-steps__label">{stepLabels[s]}</span>
            </li>
          ))}
        </ol>
      )}

      {step !== "service" && step !== "done" && (
        <div className="bk-nav">
          <button type="button" className="bk-link bk-back" onClick={() => go(steps[Math.max(0, index - 1)]!)} disabled={index === 0}>
            <Icon name="left" size={16} /> {t.back}
          </button>
        </div>
      )}

      {step !== "done" && (step !== "service" || title) && (
        <h2 className="bk-title" ref={headingRef} tabIndex={-1}>
          {headings[step]}
        </h2>
      )}

      {service && step !== "service" && step !== "done" && (
        <SummaryCard
          service={service}
          start={step === "details" ? start : undefined}
          address={step !== "address" ? zone?.address.label : undefined}
          onEdit={{
            service: services.length > 1 || !preset ? () => go("service") : undefined,
            date: () => go("datetime"),
            address: () => go("address"),
          }}
        />
      )}

      {error && <Alert>{error}</Alert>}

      {step === "service" && (
        <ServiceStep
          services={services}
          selectedId={service?.id}
          showPrices={props.showPrices ?? true}
          onSelect={(s) => {
            if (s.id !== service?.id) setStart(undefined);
            setService(s);
            go(needsAddress(s) ? "address" : "datetime");
          }}
        />
      )}

      {step === "address" && service && (
        <>
          <AddressStep value={zone} onChange={setZone} />
          <button
            type="button"
            className="bk-btn bk-btn--primary bk-btn--block"
            disabled={!zone || (zone.inZone === false && config.zone.outOfZone === "block")}
            onClick={() => go("datetime")}
          >
            {t.continue}
          </button>
        </>
      )}

      {step === "datetime" && service && (
        <>
          <DateTimePicker key={service.id} load={load} value={start} onChange={setStart} reloadKey={reloadKey} />
          <div className="bk-sticky">
            <button type="button" className="bk-btn bk-btn--primary bk-btn--block" disabled={!start} onClick={() => go("details")}>
              {t.continue}
            </button>
          </div>
        </>
      )}

      {step === "details" && service && start && (
        <DetailsStep
          service={service}
          details={details}
          onChange={setDetails}
          askMessage={props.askMessage ?? true}
          submitting={submitting}
          serverErrors={fieldErrors}
          pending={pending}
          onSubmit={submit}
        />
      )}

      {step === "done" && result && (
        <DoneStep
          booking={result.booking}
          email={details.email}
          token={result.token}
          manageHref={props.manageUrl && result.token ? `${props.manageUrl}${props.manageUrl.includes("?") ? "&" : "?"}t=${result.token}` : undefined}
          onAgain={reset}
        />
      )}
    </div>
  );
}

const needsAddress = (s: Service) => s.location === "home";

/** Display name of a service in the current locale (handy for analytics). */
export const serviceName = (s: Service, locale: string, fallback = "fr") => pick(s.name, locale, fallback);
