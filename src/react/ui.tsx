/** Small building blocks of the widget. */
import { createContext, useContext, useId, type ReactNode } from "react";
import { parseLinks, type PublicConfig } from "../core/index.js";
import type { BookingApi } from "./api.js";
import type { BookingTexts } from "./texts.js";

export type WidgetContext = {
  api: BookingApi;
  config: PublicConfig;
  locale: string;
  t: BookingTexts;
};

export const Ctx = createContext<WidgetContext | null>(null);

export function useWidget() {
  const c = useContext(Ctx);
  if (!c) throw new Error("Booking components must be rendered inside <BookingWidget> or <ManageBooking>.");
  return c;
}

const paths = {
  check: "M20 6 9 17l-5-5",
  left: "m15 18-6-6 6-6",
  right: "m9 18 6-6-6-6",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  pin: "M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  video: "m22 8-6 4 6 4V8ZM14 6H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Z",
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z",
} as const;

export function Icon({ name, size = 18 }: { name: keyof typeof paths; size?: number }) {
  return (
    <svg className="bk-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="bk-loading" role="status">
      <span className="bk-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "info" | "success" | "warning"; children: ReactNode }) {
  return (
    <div className={`bk-alert bk-alert--${kind}`} role={kind === "error" ? "alert" : "status"}>
      {kind !== "success" && <Icon name="alert" />}
      {kind === "success" && <Icon name="check" />}
      <div>{children}</div>
    </div>
  );
}

/** Label text with "[link](url)" support (consents). */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {parseLinks(text).map((s, i) =>
        "href" in s ? (
          <a key={i} href={s.href} target="_blank" rel="noopener noreferrer">
            {s.text}
          </a>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

export function FieldShell({
  label,
  required,
  help,
  error,
  children,
}: {
  label: ReactNode;
  required?: boolean;
  help?: string;
  error?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const { t } = useWidget();
  const describedBy = [help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`bk-field${error ? " bk-field--error" : ""}`}>
      <label className="bk-label" htmlFor={id}>
        {label}
        {!required && <span className="bk-optional"> ({t.optional})</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {help && (
        <p className="bk-help" id={`${id}-help`}>
          {help}
        </p>
      )}
      {error && (
        <p className="bk-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function errorText(t: BookingTexts, code: string) {
  switch (code) {
    case "invalid":
      return t.errorInvalid;
    case "slot_taken":
      return t.errorSlotTaken;
    case "out_of_zone":
      return t.errorOutOfZone;
    case "rate":
      return t.errorRate;
    case "network":
      return t.errorNetwork;
    case "too_late":
    case "not_allowed":
      return t.errorTooLate;
    case "not_found":
      return t.errorNotFound;
    default:
      return t.errorServer;
  }
}

export function ContactLine() {
  const { config } = useWidget();
  const { phone, email } = config.contact;
  if (!phone && !email) return null;
  return (
    <p className="bk-contact">
      {phone && <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a>}
      {phone && email && " · "}
      {email && <a href={`mailto:${email}`}>{email}</a>}
    </p>
  );
}
