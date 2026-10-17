/** Drawer with everything about one booking: contact, actions, move, notes, history. */
import { doc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { COL, fill, formatDuration, formatPrice, localDateOf, pick, zonedTime, type Booking } from "../core/index.js";
import { AdminApiError, useAdmin, useBooking } from "./data.js";
import { SlotPicker } from "./SlotPicker.js";
import { ConfirmButton, Drawer, StatusBadge, Toggle, useFormat, whatsappNumber } from "./ui.js";

export function BookingPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const booking = useBooking(id);
  const { t } = useAdmin();
  return (
    <Drawer title={booking ? booking.client.name : t.loading} onClose={onClose}>
      {booking === undefined && <p className="bka-muted">{t.loading}</p>}
      {booking === null && <p className="bka-muted">—</p>}
      {booking && <Details booking={booking} />}
    </Drawer>
  );
}

function Details({ booking: b }: { booking: Booking }) {
  const { t, api, db, settings, locale, toast, phoneCountryCode } = useAdmin();
  const f = useFormat();
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false);
  const [notes, setNotes] = useState(b.notes ?? "");
  const [notify, setNotify] = useState(true);
  useEffect(() => setNotes(b.notes ?? ""), [b.id, b.notes]);

  const hasEmail = !!b.client.email;
  const active = b.status === "pending" || b.status === "confirmed";
  const past = Date.parse(b.end) < Date.now();

  /** Runs an action; returns the error code, if any. */
  async function act(fn: () => Promise<unknown>, done?: string): Promise<string | null> {
    setBusy(true);
    try {
      await fn();
      if (done) toast(done);
      return null;
    } catch (e) {
      const code = e instanceof AdminApiError ? e.code : "server";
      toast(code === "slot_taken" ? t.conflict : t.errorGeneric, "error");
      return code;
    } finally {
      setBusy(false);
    }
  }

  const status = (s: string, label: string) => act(() => api.status(b.id, s, notify && hasEmail), label);

  // Unticked boxes only happen on bookings added by the admin: not worth showing.
  const fields = settings.fields.filter((d) => b.fields[d.id] !== undefined && b.fields[d.id] !== "" && b.fields[d.id] !== false);
  const phoneHref = b.client.phone.replace(/[^\d+]/g, "");
  const where = b.service.location === "home" ? b.address?.label : undefined;

  return (
    <div className="bka-booking">
      <div className="bka-booking__top">
        <StatusBadge status={b.status} />
        {b.outOfZone && <span className="bka-tag bka-tag--warn">{fill(t.outOfZone, { km: b.distanceKm ?? "?" })}</span>}
      </div>

      <dl className="bka-dl">
        <dt>{t.service}</dt>
        <dd>{pick(b.service.name, locale, settings.defaultLocale)}</dd>
        <dt>{t.date}</dt>
        <dd>
          {f.date(b.start, { year: "numeric" })} · {f.time(b.start)}–{f.time(b.end)}
        </dd>
        <dt>{t.duration}</dt>
        <dd>
          {formatDuration(b.service.durationMin, locale)}
          {b.service.price !== undefined && ` · ${formatPrice(b.service.price, settings.currency, locale)}`}
        </dd>
        {where && (
          <>
            <dt>{t.address}</dt>
            <dd>
              {where}
              {b.distanceKm !== undefined && <span className="bka-muted"> · {b.distanceKm} km</span>}
            </dd>
          </>
        )}
        {b.client.phone && (
          <>
            <dt>{t.phone}</dt>
            <dd>{b.client.phone}</dd>
          </>
        )}
        {b.client.email && (
          <>
            <dt>{t.email}</dt>
            <dd>
              <a href={`mailto:${b.client.email}`}>{b.client.email}</a>
            </dd>
          </>
        )}
        {fields.map((d) => (
          <div key={d.id} className="bka-dl__pair">
            <dt>{pick(d.label, locale, settings.defaultLocale).replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")}</dt>
            <dd>{typeof b.fields[d.id] === "boolean" ? (b.fields[d.id] ? "✓" : "✗") : String(b.fields[d.id])}</dd>
          </div>
        ))}
        {b.message && (
          <>
            <dt>{t.message}</dt>
            <dd className="bka-pre">{b.message}</dd>
          </>
        )}
        <dt>{t.source}</dt>
        <dd>{b.source === "web" ? t.sourceWeb : t.sourceAdmin}</dd>
      </dl>

      <div className="bka-quick">
        {phoneHref && (
          <>
            <a className="bka-btn" href={`tel:${phoneHref}`}>
              {t.call}
            </a>
            <a className="bka-btn" href={`sms:${phoneHref}`}>
              {t.sms}
            </a>
            <a className="bka-btn" href={`https://wa.me/${whatsappNumber(b.client.phone, phoneCountryCode)}`} target="_blank" rel="noreferrer">
              {t.whatsapp}
            </a>
          </>
        )}
        {where && (
          <a className="bka-btn" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(where)}`} target="_blank" rel="noreferrer">
            {t.directions}
          </a>
        )}
      </div>

      {(active || b.status === "completed" || b.status === "no_show") && (
        <div className="bka-panel">
          {active && hasEmail && <Toggle label={t.notifyClient} checked={notify} onChange={setNotify} />}
          {active && !hasEmail && <p className="bka-help">{t.noEmail}</p>}
          <div className="bka-actions">
            {b.status === "pending" && (
              <>
                <button type="button" className="bka-btn bka-btn--primary" disabled={busy} onClick={() => status("confirmed", t.confirmed)}>
                  {t.approve}
                </button>
                <ConfirmButton label={t.decline} question={t.confirmDecline} disabled={busy} onConfirm={() => status("declined", t.declined)} />
              </>
            )}
            {b.status === "confirmed" && past && (
              <>
                <button type="button" className="bka-btn bka-btn--primary" disabled={busy} onClick={() => status("completed", t.completed)}>
                  {t.markCompleted}
                </button>
                <button type="button" className="bka-btn" disabled={busy} onClick={() => status("no_show", t.no_show)}>
                  {t.markNoShow}
                </button>
              </>
            )}
            {active && (
              <button type="button" className="bka-btn" disabled={busy} onClick={() => setMoving((m) => !m)} aria-expanded={moving}>
                {t.move}
              </button>
            )}
            {active && (
              <ConfirmButton
                label={t.cancelBooking}
                question={t.confirmCancel}
                className="bka-btn bka-btn--danger-outline"
                disabled={busy}
                onConfirm={() => status("cancelled", t.cancelled)}
              />
            )}
            {(b.status === "completed" || b.status === "no_show") && (
              <>
                {b.status === "no_show" && (
                  <button type="button" className="bka-btn" disabled={busy} onClick={() => status("completed", t.completed)}>
                    {t.markCompleted}
                  </button>
                )}
                {b.status === "completed" && (
                  <button type="button" className="bka-btn" disabled={busy} onClick={() => status("no_show", t.no_show)}>
                    {t.markNoShow}
                  </button>
                )}
              </>
            )}
          </div>
          {moving && (
            <MoveForm
              booking={b}
              onMove={(start, force) =>
                act(async () => {
                  await api.move(b.id, start, notify && hasEmail, force);
                  setMoving(false);
                }, t.saved)
              }
              busy={busy}
            />
          )}
        </div>
      )}

      <div className="bka-panel">
        <label className="bka-label" htmlFor={`notes-${b.id}`}>
          {t.notes}
        </label>
        <textarea id={`notes-${b.id}`} className="bka-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <p className="bka-help">{t.notesHelp}</p>
        {notes !== (b.notes ?? "") && (
          <button
            type="button"
            className="bka-btn bka-btn--primary"
            onClick={() => act(() => updateDoc(doc(db, COL.bookings, b.id), { notes, updatedAt: new Date().toISOString() }), t.saved)}
          >
            {t.saveNotes}
          </button>
        )}
      </div>

      <details className="bka-history">
        <summary>{t.history}</summary>
        <ul>
          {[...b.history].reverse().map((h, i) => (
            <li key={i}>
              <span>{t.actions[h.action] ?? h.action}</span>
              <span className="bka-muted">
                {" "}
                · {f.date(h.at, { weekday: undefined })} {f.time(h.at)} · {t.actionBy[h.by] ?? h.by}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function MoveForm({ booking, onMove, busy }: { booking: Booking; onMove: (start: string, force: boolean) => Promise<string | null>; busy: boolean }) {
  const { t, settings } = useAdmin();
  const tz = settings.timezone;
  const [date, setDate] = useState(localDateOf(Date.parse(booking.start), tz));
  const [start, setStart] = useState<string>();
  const [conflict, setConflict] = useState(false);
  useEffect(() => setConflict(false), [start]);
  const save = async (force: boolean) => start && setConflict((await onMove(start, force)) === "slot_taken");
  return (
    <div className="bka-move">
      <h3>{t.moveTitle}</h3>
      <SlotPicker serviceId={booking.serviceId} date={date} onDate={setDate} value={start} onChange={setStart} excludeId={booking.id} durationMin={booking.service.durationMin} />
      <div className="bka-actions">
        <button type="button" className="bka-btn bka-btn--primary" disabled={!start || busy} onClick={() => save(false)}>
          {t.save}
        </button>
        {conflict && (
          <button type="button" className="bka-btn" disabled={busy} onClick={() => save(true)}>
            {t.forceAnyway}
          </button>
        )}
      </div>
    </div>
  );
}

/** "2026-10-19" + "09:30" → ISO, in the business time zone. */
export function toInstant(date: string, time: string, tz: string) {
  const ms = zonedTime(date, time, tz);
  return ms === null ? undefined : new Date(ms).toISOString();
}
