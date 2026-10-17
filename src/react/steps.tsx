/** The steps of the booking flow. */
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import {
  buildIcs,
  EMAIL_RE,
  fieldsFor,
  fill,
  formatDate,
  formatDuration,
  formatPrice,
  formatTime,
  googleCalendarUrl,
  pick,
  PHONE_RE,
  type Address,
  type FieldDef,
  type PublicBooking,
  type Service,
} from "../core/index.js";
import type { GeocodeResult } from "./api.js";
import { Alert, ContactLine, FieldShell, Icon, RichText, useWidget } from "./ui.js";

export type ZoneState = { address: Address; inZone: boolean | null; distanceKm?: number };

function locationLabel(s: Pick<Service, "location">, t: ReturnType<typeof useWidget>["t"]) {
  return s.location === "home" ? t.atHome : s.location === "online" ? t.online : t.atStudio;
}

export function Price({ service }: { service: Pick<Service, "price" | "wasPrice"> }) {
  const { config, locale, t } = useWidget();
  if (service.price === undefined) return <span className="bk-price">{t.priceOnRequest}</span>;
  if (service.price === 0) return <span className="bk-price">{t.free}</span>;
  return (
    <span className="bk-price">
      {service.wasPrice !== undefined && service.wasPrice > service.price && (
        <s className="bk-price__was">{formatPrice(service.wasPrice, config.currency, locale)}</s>
      )}
      {formatPrice(service.price, config.currency, locale)}
    </span>
  );
}

export function ServiceStep({
  services,
  selectedId,
  showPrices,
  onSelect,
}: {
  services: Service[];
  selectedId?: string;
  showPrices: boolean;
  onSelect: (s: Service) => void;
}) {
  const { config, locale, t } = useWidget();
  const def = config.defaultLocale;
  const usedCategories = config.categories.filter((c) => services.some((s) => s.categoryId === c.id));
  const [category, setCategory] = useState<string | null>(null);
  const shown = category ? services.filter((s) => s.categoryId === category) : services;

  return (
    <div className="bk-services">
      {usedCategories.length > 1 && (
        <div className="bk-chips" role="group">
          <button type="button" className={`bk-chip${!category ? " bk-chip--on" : ""}`} aria-pressed={!category} onClick={() => setCategory(null)}>
            {t.allServices}
          </button>
          {usedCategories.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`bk-chip${category === c.id ? " bk-chip--on" : ""}`}
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {pick(c.name, locale, def)}
            </button>
          ))}
        </div>
      )}
      <ul className="bk-service-list">
        {shown.map((s) => (
          <li key={s.id}>
            <button type="button" className={`bk-service${s.id === selectedId ? " bk-service--selected" : ""}`} onClick={() => onSelect(s)}>
              <span className="bk-service__main">
                <span className="bk-service__name">
                  {pick(s.name, locale, def)}
                  {s.badge && <span className="bk-badge">{pick(s.badge, locale, def)}</span>}
                </span>
                {s.description && <span className="bk-service__desc">{pick(s.description, locale, def)}</span>}
                <span className="bk-service__meta">
                  <span>
                    <Icon name="clock" size={15} /> {formatDuration(s.durationMin, locale)}
                  </span>
                  <span>
                    <Icon name={s.location === "home" ? "home" : s.location === "online" ? "video" : "pin"} size={15} /> {locationLabel(s, t)}
                  </span>
                </span>
              </span>
              {showPrices && <Price service={s} />}
              <Icon name="right" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AddressStep({ value, onChange }: { value: ZoneState | null; onChange: (z: ZoneState | null) => void }) {
  const { api, config, t, locale } = useWidget();
  const [query, setQuery] = useState(value?.address.label ?? "");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searched, setSearched] = useState(false);
  const [postcode, setPostcode] = useState(value?.address.postcode ?? "");
  const listId = useId();
  const seq = useRef(0);

  useEffect(() => {
    if (!config.geocoding) return;
    if (value && query === value.address.label) return;
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearched(false);
      return;
    }
    const n = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const r = await api.geocode(q);
        if (n !== seq.current) return;
        setResults(r.results);
        setOpen(true);
        setActive(-1);
        setSearched(true);
      } catch {
        if (n === seq.current) setResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, api, config.geocoding, value]);

  function choose(r: GeocodeResult) {
    setQuery(r.label);
    setOpen(false);
    onChange({ address: { label: r.label, postcode: r.postcode, city: r.city, lat: r.lat, lng: r.lng }, inZone: r.inZone, distanceKm: r.distanceKm });
  }

  // Without geocoding: free text + postcode, checked by the server for postcode zones.
  useEffect(() => {
    if (config.geocoding) return;
    const label = query.trim();
    if (label.length < 5) {
      onChange(null);
      return;
    }
    const address = { label: postcode ? `${label}${label.includes(postcode) ? "" : `, ${postcode}`}` : label, postcode: postcode || undefined };
    if (config.zone.mode !== "postcodes") {
      onChange({ address, inZone: null });
      return;
    }
    if (!/^\w{4,6}$/.test(postcode.trim())) {
      onChange(null);
      return;
    }
    const timer = setTimeout(() => {
      api.zone(address).then((z) => onChange({ address, ...z }), () => onChange({ address, inZone: null }));
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, postcode, config.geocoding]);

  const zoneMessage = config.zone.message ? pick(config.zone.message, locale, config.defaultLocale) : undefined;

  return (
    <div className="bk-address">
      {config.geocoding ? (
        <FieldShell label={t.addressLabel} required help={t.addressHelp}>
          {(p) => (
            <div className="bk-combobox">
              <input
                {...p}
                className="bk-input"
                type="text"
                role="combobox"
                aria-expanded={open && results.length > 0}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                autoComplete="street-address"
                placeholder={t.addressPlaceholder}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (value) onChange(null);
                }}
                onFocus={() => results.length && setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onKeyDown={(e) => {
                  if (!open || !results.length) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => (a + 1) % results.length);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
                  } else if (e.key === "Enter" && active >= 0) {
                    e.preventDefault();
                    choose(results[active]!);
                  } else if (e.key === "Escape") setOpen(false);
                }}
              />
              {open && results.length > 0 && (
                <ul className="bk-options" role="listbox" id={listId}>
                  {results.map((r, i) => (
                    <li
                      key={`${r.label}-${i}`}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === active}
                      className={`bk-option${i === active ? " bk-option--active" : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        choose(r);
                      }}
                    >
                      <Icon name="pin" size={15} />
                      <span>{r.label}</span>
                    </li>
                  ))}
                </ul>
              )}
              {searched && !results.length && !value && <p className="bk-help">{t.noAddressFound}</p>}
            </div>
          )}
        </FieldShell>
      ) : (
        <>
          <FieldShell label={t.addressLabel} required>
            {(p) => (
              <input {...p} className="bk-input" type="text" autoComplete="street-address" placeholder={t.addressPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
            )}
          </FieldShell>
          <FieldShell label={t.postcodeLabel} required={config.zone.mode === "postcodes"}>
            {(p) => (
              <input {...p} className="bk-input bk-input--short" type="text" inputMode="numeric" autoComplete="postal-code" value={postcode} onChange={(e) => setPostcode(e.target.value.trim())} />
            )}
          </FieldShell>
        </>
      )}

      {value?.inZone === true && config.zone.mode !== "none" && (
        <Alert kind="success">
          {t.inZone}
          {value.distanceKm !== undefined && ` · ${value.distanceKm.toLocaleString(locale)} km`}
        </Alert>
      )}
      {value?.inZone === false && (
        <Alert kind={config.zone.outOfZone === "block" ? "error" : "warning"}>
          <p>{config.zone.outOfZone === "block" ? t.outOfZoneBlock : t.outOfZoneRequest}</p>
          {zoneMessage && <p>{zoneMessage}</p>}
          {config.zone.outOfZone === "block" && <ContactLine />}
        </Alert>
      )}
    </div>
  );
}

export type Details = {
  name: string;
  email: string;
  phone: string;
  message: string;
  fields: Record<string, string | boolean>;
};

export const emptyDetails: Details = { name: "", email: "", phone: "", message: "", fields: {} };

function validate(d: Details, defs: FieldDef[], t: ReturnType<typeof useWidget>["t"]) {
  const errors: Record<string, string> = {};
  if (d.name.trim().length < 2) errors.name = t.fieldName;
  if (!EMAIL_RE.test(d.email.trim())) errors.email = t.fieldEmail;
  if (!PHONE_RE.test(d.phone.trim())) errors.phone = t.fieldPhone;
  for (const f of defs) {
    const v = d.fields[f.id];
    if (f.type === "checkbox") {
      if (f.required && v !== true) errors[`fields.${f.id}`] = t.fieldRequired;
    } else if (f.required && !String(v ?? "").trim()) errors[`fields.${f.id}`] = t.fieldRequired;
    else if (f.type === "number" && v !== undefined && v !== "") {
      const n = Number(v);
      if (!Number.isFinite(n) || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) errors[`fields.${f.id}`] = t.fieldInvalid;
    }
  }
  return errors;
}

function CustomField({ def, value, error, onChange }: { def: FieldDef; value: string | boolean | undefined; error?: string; onChange: (v: string | boolean) => void }) {
  const { locale, config, t } = useWidget();
  const label = pick(def.label, locale, config.defaultLocale);
  const help = def.help ? pick(def.help, locale, config.defaultLocale) : undefined;
  const placeholder = def.placeholder ? pick(def.placeholder, locale, config.defaultLocale) : undefined;
  const id = useId();

  if (def.type === "checkbox") {
    return (
      <div className={`bk-check${error ? " bk-field--error" : ""}`}>
        <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-e` : undefined} />
        <label htmlFor={id}>
          <RichText text={label} />
          {help && <span className="bk-help">{help}</span>}
        </label>
        {error && (
          <p className="bk-error" id={`${id}-e`}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <FieldShell label={label} required={def.required} help={help} error={error}>
      {(p) =>
        def.type === "textarea" ? (
          <textarea {...p} className="bk-input" rows={3} maxLength={def.maxLength ?? 2000} placeholder={placeholder} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
        ) : def.type === "select" ? (
          <select {...p} className="bk-input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            <option value="">{t.select}</option>
            {def.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {pick(o.label, locale, config.defaultLocale)}
              </option>
            ))}
          </select>
        ) : (
          <input
            {...p}
            className={`bk-input${def.type === "number" || def.type === "date" ? " bk-input--short" : ""}`}
            type={def.type}
            min={def.min}
            max={def.max}
            maxLength={def.maxLength}
            inputMode={def.type === "number" ? "numeric" : undefined}
            placeholder={placeholder}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
        )
      }
    </FieldShell>
  );
}

export function DetailsStep({
  service,
  details,
  onChange,
  askMessage,
  submitting,
  serverErrors,
  pending,
  onSubmit,
}: {
  service: Service;
  details: Details;
  onChange: (d: Details) => void;
  askMessage: boolean;
  submitting: boolean;
  serverErrors: string[];
  pending: boolean;
  /** Receives the honeypot value. */
  onSubmit: (website: string) => void;
}) {
  const { config, locale, t } = useWidget();
  const defs = useMemo(() => fieldsFor(config.fields, service), [config.fields, service]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tried, setTried] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!serverErrors.length) return;
    const e: Record<string, string> = {};
    for (const f of serverErrors) e[f.replace(/^client\./, "")] = f.includes("email") ? t.fieldEmail : f.includes("phone") ? t.fieldPhone : t.fieldInvalid;
    setErrors(e);
  }, [serverErrors, t]);

  const set = (patch: Partial<Details>) => {
    const next = { ...details, ...patch };
    onChange(next);
    if (tried) setErrors(validate(next, defs, t));
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    const errs = validate(details, defs, t);
    setErrors(errs);
    if (Object.keys(errs).length) {
      // Focus the first invalid control.
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    onSubmit((formRef.current?.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "");
  }

  const policy = config.policies.text ? pick(config.policies.text, locale, config.defaultLocale) : "";
  const checkboxes = defs.filter((f) => f.type === "checkbox");
  const others = defs.filter((f) => f.type !== "checkbox");

  return (
    <form className="bk-form" onSubmit={submit} noValidate ref={formRef}>
      <FieldShell label={t.name} required error={errors.name}>
        {(p) => <input {...p} className="bk-input" type="text" autoComplete="name" value={details.name} onChange={(e) => set({ name: e.target.value })} />}
      </FieldShell>
      <div className="bk-row">
        <FieldShell label={t.email} required error={errors.email}>
          {(p) => <input {...p} className="bk-input" type="email" autoComplete="email" inputMode="email" value={details.email} onChange={(e) => set({ email: e.target.value })} />}
        </FieldShell>
        <FieldShell label={t.phone} required error={errors.phone}>
          {(p) => <input {...p} className="bk-input" type="tel" autoComplete="tel" inputMode="tel" value={details.phone} onChange={(e) => set({ phone: e.target.value })} />}
        </FieldShell>
      </div>
      {others.map((f) => (
        <CustomField key={f.id} def={f} value={details.fields[f.id]} error={errors[`fields.${f.id}`]} onChange={(v) => set({ fields: { ...details.fields, [f.id]: v } })} />
      ))}
      {askMessage && (
        <FieldShell label={t.message} required={false}>
          {(p) => <textarea {...p} className="bk-input" rows={3} maxLength={2000} placeholder={t.messagePlaceholder} value={details.message} onChange={(e) => set({ message: e.target.value })} />}
        </FieldShell>
      )}
      {policy && (
        <p className="bk-policy">
          <RichText text={policy} />
        </p>
      )}
      {checkboxes.map((f) => (
        <CustomField key={f.id} def={f} value={details.fields[f.id]} error={errors[`fields.${f.id}`]} onChange={(v) => set({ fields: { ...details.fields, [f.id]: v } })} />
      ))}
      {/* Honeypot: hidden from people, tempting for bots. */}
      <div className="bk-hp" aria-hidden="true">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <button type="submit" className="bk-btn bk-btn--primary bk-btn--block" disabled={submitting}>
        {submitting ? t.sending : pending ? t.sendRequest : t.confirm}
      </button>
    </form>
  );
}

export function SummaryCard({
  service,
  start,
  address,
  onEdit,
}: {
  service: Service | PublicBooking["service"];
  start?: string;
  address?: string;
  onEdit?: { service?: () => void; date?: () => void; address?: () => void };
}) {
  const { config, locale, t } = useWidget();
  const tz = config.timezone;
  const name = pick(service.name, locale, config.defaultLocale);
  return (
    <div className="bk-summary">
      <div className="bk-summary__row">
        <div>
          <p className="bk-summary__title">{name}</p>
          <p className="bk-muted">
            {formatDuration(service.durationMin, locale)}
            {service.price !== undefined && <> · <Price service={service} /></>}
          </p>
        </div>
        {onEdit?.service && (
          <button type="button" className="bk-link" onClick={onEdit.service}>
            {t.change}
          </button>
        )}
      </div>
      {address && (
        <div className="bk-summary__row">
          <p>
            <Icon name="home" size={15} /> {address}
          </p>
          {onEdit?.address && (
            <button type="button" className="bk-link" onClick={onEdit.address}>
              {t.change}
            </button>
          )}
        </div>
      )}
      {start && (
        <div className="bk-summary__row">
          <p>
            <Icon name="calendar" size={15} /> {formatDate(Date.parse(start), tz, locale, { year: undefined })} · {formatTime(Date.parse(start), tz, locale)}
          </p>
          {onEdit?.date && (
            <button type="button" className="bk-link" onClick={onEdit.date}>
              {t.change}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function calendarEvent(booking: PublicBooking, businessName: string, locale: string, defaultLocale: string) {
  return {
    uid: `${booking.id}@booking`,
    start: Date.parse(booking.start),
    end: Date.parse(booking.end),
    title: `${pick(booking.service.name, locale, defaultLocale)} — ${businessName}`,
    location: booking.where,
  };
}

export function CalendarLinks({ booking }: { booking: PublicBooking }) {
  const { config, locale, t } = useWidget();
  const event = calendarEvent(booking, config.businessName, locale, config.defaultLocale);
  const [icsUrl, setIcsUrl] = useState<string>();
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([buildIcs(event)], { type: "text/calendar" }));
    setIcsUrl(url);
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id, booking.start]);
  return (
    <div className="bk-cal-links">
      <p className="bk-label">{t.addToCalendar}</p>
      <div className="bk-actions">
        <a className="bk-btn bk-btn--secondary" href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
          {t.googleCalendar}
        </a>
        {icsUrl && (
          <a className="bk-btn bk-btn--secondary" href={icsUrl} download="rendez-vous.ics">
            {t.icsFile}
          </a>
        )}
      </div>
    </div>
  );
}

export function DoneStep({ booking, email, manageHref, onAgain }: { booking: PublicBooking; email: string; manageHref?: string; onAgain: () => void }) {
  const { t } = useWidget();
  const pending = booking.status === "pending";
  return (
    <div className="bk-done">
      <div className="bk-done__icon" aria-hidden="true">
        <Icon name="check" size={32} />
      </div>
      <h2 className="bk-title" tabIndex={-1}>
        {pending ? t.doneRequestTitle : t.doneConfirmedTitle}
      </h2>
      <p className="bk-muted">{fill(pending ? t.doneRequestText : t.doneConfirmedText, { email })}</p>
      <SummaryCard service={booking.service} start={booking.start} address={booking.where} />
      {!pending && <CalendarLinks booking={booking} />}
      <div className="bk-actions">
        {manageHref && (
          <a className="bk-btn bk-btn--secondary" href={manageHref}>
            {t.manageBooking}
          </a>
        )}
        <button type="button" className="bk-link" onClick={onAgain}>
          {t.bookAnother}
        </button>
      </div>
    </div>
  );
}
