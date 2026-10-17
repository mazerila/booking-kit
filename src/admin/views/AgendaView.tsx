/** Home screen: requests to review, today, and the next two weeks. */
import { useMemo, useState, type ReactNode } from "react";
import { addDays, localDateOf, zonedTime, type Booking } from "../../core/index.js";
import { HelpLink } from "./HelpView.js";
import { useAdmin, useBookings, usePendingBookings } from "../data.js";
import { Section, StatusBadge, useFormat } from "../ui.js";

export function BookingRow({ b, actions, withDate }: { b: Booking; actions?: ReactNode; withDate?: boolean }) {
  const { openBooking } = useAdmin();
  const f = useFormat();
  const muted = b.status === "cancelled" || b.status === "declined";
  return (
    <li className={`bka-row${muted ? " bka-row--muted" : ""}`}>
      <button type="button" className="bka-row__main" onClick={() => openBooking(b.id)}>
        <span className="bka-row__time">
          {withDate && <span className="bka-row__date">{f.date(b.start, { weekday: "short", month: "short" })}</span>}
          {f.time(b.start)}
          <span className="bka-muted">{f.time(b.end)}</span>
        </span>
        <span className="bka-row__body">
          <span className="bka-row__title">{b.client.name}</span>
          <span className="bka-muted">
            {f.name(b.service.name)}
            {b.service.location === "home" && b.address?.city ? ` · ${b.address.city}` : ""}
          </span>
        </span>
        <StatusBadge status={b.status} />
      </button>
      {actions && <div className="bka-row__actions">{actions}</div>}
    </li>
  );
}

export function AgendaView() {
  const { t, settings, api, toast, newBooking } = useAdmin();
  const f = useFormat();
  const tz = settings.timezone;
  const today = localDateOf(Date.now(), tz);
  const range = useMemo(() => {
    const from = new Date(zonedTime(today, "00:00", tz) ?? Date.now()).toISOString();
    const to = new Date(zonedTime(addDays(today, 15), "00:00", tz) ?? Date.now()).toISOString();
    return { from, to };
  }, [today, tz]);
  const bookings = useBookings(range.from, range.to);
  const pending = usePendingBookings();
  const [busy, setBusy] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, Booking[]>();
    for (const b of bookings ?? []) {
      if (b.status === "cancelled" || b.status === "declined") continue;
      const d = localDateOf(Date.parse(b.start), tz);
      m.set(d, [...(m.get(d) ?? []), b]);
    }
    return m;
  }, [bookings, tz]);

  async function decide(b: Booking, status: "confirmed" | "declined") {
    setBusy(b.id);
    try {
      await api.status(b.id, status, !!b.client.email);
      toast(status === "confirmed" ? t.confirmed : t.declined);
    } catch {
      toast(t.errorGeneric, "error");
    } finally {
      setBusy(null);
    }
  }

  const todayList = byDay.get(today) ?? [];
  const later = [...byDay.entries()].filter(([d]) => d > today).sort(([a], [b]) => a.localeCompare(b));
  const dayLabel = (d: string) =>
    d === addDays(today, 1) ? t.tomorrow : f.date(new Date(zonedTime(d, "12:00", tz) ?? 0).toISOString());

  return (
    <div className="bka-view">
      <div className="bka-view__head">
        <div className="bka-titlerow">
          <h1>{t.navAgenda}</h1>
          <HelpLink section="agenda" />
        </div>
        <button type="button" className="bka-btn bka-btn--primary" onClick={() => newBooking()}>
          + {t.newBooking}
        </button>
      </div>

      {!!pending?.length && (
        <Section title={`${t.pendingTitle} (${pending.length})`}>
          <ul className="bka-list">
            {pending.map((b) => (
              <BookingRow
                  key={b.id}
                  withDate
                  b={b}
                  actions={
                    <>
                      <button type="button" className="bka-btn bka-btn--primary bka-btn--sm" disabled={busy === b.id} onClick={() => decide(b, "confirmed")}>
                        {t.approve}
                      </button>
                      <button type="button" className="bka-btn bka-btn--sm" disabled={busy === b.id} onClick={() => decide(b, "declined")}>
                        {t.decline}
                      </button>
                    </>
                  }
                />
            ))}
          </ul>
        </Section>
      )}

      <Section title={`${t.today} · ${f.date(new Date().toISOString())}`}>
        {bookings === null ? (
          <p className="bka-muted">{t.loading}</p>
        ) : todayList.length ? (
          <ul className="bka-list">
            {todayList.map((b) => (
              <BookingRow key={b.id} b={b} />
            ))}
          </ul>
        ) : (
          <p className="bka-empty">{t.nothingToday}</p>
        )}
      </Section>

      <Section title={t.upcoming}>
        {bookings !== null && !later.length && <p className="bka-empty">{t.nothingUpcoming}</p>}
        {later.map(([d, list]) => (
          <div key={d} className="bka-day-group">
            <p className="bka-daylabel">{dayLabel(d)}</p>
            <ul className="bka-list">
              {list.map((b) => (
                <BookingRow key={b.id} b={b} />
              ))}
            </ul>
          </div>
        ))}
      </Section>
    </div>
  );
}
