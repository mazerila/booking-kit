/** Admin building blocks. */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { formatTime, pick, type BookingStatus, type LocalizedText } from "../core/index.js";
import { useAdmin } from "./data.js";

export function Drawer({ title, onClose, children, footer }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useAdmin();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="bka-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bka-drawer" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} tabIndex={-1} ref={ref}>
        <header className="bka-drawer__head">
          <h2>{title}</h2>
          <button type="button" className="bka-iconbtn" onClick={onClose} aria-label={t.close}>
            ✕
          </button>
        </header>
        <div className="bka-drawer__body">{children}</div>
        {footer && <footer className="bka-drawer__foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { t } = useAdmin();
  return <span className={`bka-status bka-status--${status}`}>{t[status]}</span>;
}

export function Field({ label, help, children, wide }: { label: ReactNode; help?: ReactNode; children: (id: string) => ReactNode; wide?: boolean }) {
  const id = useId();
  return (
    <div className={`bka-field${wide ? " bka-field--wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {help && <p className="bka-help">{help}</p>}
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="bka-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** One input per site language. */
export function LocalizedInput({
  label,
  value,
  onChange,
  multiline,
  help,
  placeholder,
}: {
  label: string;
  value: LocalizedText | undefined;
  onChange: (v: LocalizedText) => void;
  multiline?: boolean;
  help?: string;
  placeholder?: LocalizedText;
}) {
  const { settings } = useAdmin();
  const locales = settings.locales;
  return (
    <fieldset className="bka-localized">
      <legend>{label}</legend>
      {locales.map((l) => (
        <div key={l} className="bka-localized__row">
          {locales.length > 1 && <span className="bka-lang">{l.toUpperCase()}</span>}
          {multiline ? (
            <textarea className="bka-input" rows={3} value={value?.[l] ?? ""} onChange={(e) => onChange({ ...value, [l]: e.target.value })} aria-label={`${label} (${l})`} />
          ) : (
            <input className="bka-input" value={value?.[l] ?? ""} placeholder={placeholder?.[l]} onChange={(e) => onChange({ ...value, [l]: e.target.value })} aria-label={`${label} (${l})`} />
          )}
        </div>
      ))}
      {help && <p className="bka-help">{help}</p>}
    </fieldset>
  );
}

/** A button that asks "Sure?" inline before running. */
export function ConfirmButton({ label, question, onConfirm, className = "bka-btn", disabled }: { label: ReactNode; question: string; onConfirm: () => void; className?: string; disabled?: boolean }) {
  const { t } = useAdmin();
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <button type="button" className={className} onClick={() => setAsking(true)} disabled={disabled}>
        {label}
      </button>
    );
  return (
    <span className="bka-confirm">
      <span>{question}</span>
      <button
        type="button"
        className="bka-btn bka-btn--danger"
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {t.yes}
      </button>
      <button type="button" className="bka-btn" onClick={() => setAsking(false)}>
        {t.no}
      </button>
    </span>
  );
}

export function Section({ title, help, actions, children }: { title: ReactNode; help?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="bka-section">
      <header className="bka-section__head">
        <div>
          <h2>{title}</h2>
          {help && <p className="bka-help">{help}</p>}
        </div>
        {actions && <div className="bka-section__actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export function useFormat() {
  const { settings, locale } = useAdmin();
  const tz = settings.timezone;
  return {
    tz,
    time: (iso: string) => formatTime(Date.parse(iso), tz, locale),
    name: (text: LocalizedText | undefined) => pick(text, locale, settings.defaultLocale),
    date: (iso: string, opts: Intl.DateTimeFormatOptions = {}) =>
      new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: "long", day: "numeric", month: "long", ...opts }).format(new Date(iso)),
  };
}

/** Phone number in international format for wa.me links; national numbers get the default country code. */
export function whatsappNumber(phone: string, countryCode = "33") {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `${countryCode}${digits.slice(1)}`;
  return digits;
}
