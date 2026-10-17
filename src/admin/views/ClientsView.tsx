/** Client list (built from bookings), with history, private notes and CSV export. */
import { doc, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { COL, type Client } from "../../core/index.js";
import { useAdmin, useClientBookings, useClients } from "../data.js";
import { Drawer, Section, useFormat } from "../ui.js";
import { BookingRow } from "./AgendaView.js";

function toCsv(clients: Client[]) {
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["name", "email", "phone", "bookings", "first_booking", "last_booking", "address", "notes"],
    ...clients.map((c) => [c.name, c.email, c.phone, c.bookingCount, c.firstBookingAt, c.lastBookingAt, c.lastAddress?.label, c.notes]),
  ];
  // BOM so Excel opens accents correctly.
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export function ClientsView() {
  const { t } = useAdmin();
  const f = useFormat();
  const clients = useClients();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    return (clients ?? [])
      .filter((c) => !s || c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s) || (digits.length > 2 && c.phone.replace(/\D/g, "").includes(digits)))
      .sort((a, b) => b.lastBookingAt.localeCompare(a.lastBookingAt));
  }, [clients, q]);

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([toCsv(list)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const current = clients?.find((c) => c.id === open);

  return (
    <div className="bka-view">
      <div className="bka-view__head">
        <h1>{t.navClients}</h1>
        <button type="button" className="bka-btn" onClick={exportCsv} disabled={!list.length}>
          {t.exportCsv}
        </button>
      </div>
      <input className="bka-input bka-search" type="search" placeholder={t.clientsSearch} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t.clientsSearch} />
      {clients === undefined ? (
        <p className="bka-muted">{t.loading}</p>
      ) : !list.length ? (
        <p className="bka-empty">{t.noClients}</p>
      ) : (
        <ul className="bka-list">
          {list.map((c) => (
            <li key={c.id} className="bka-row">
              <button type="button" className="bka-row__main" onClick={() => setOpen(c.id)}>
                <span className="bka-avatar" aria-hidden="true">
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="bka-row__body">
                  <span className="bka-row__title">{c.name}</span>
                  <span className="bka-muted">{[c.phone, c.email].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="bka-muted bka-row__side">
                  {c.bookingCount} · {f.date(c.lastBookingAt, { weekday: undefined, month: "short", year: "2-digit" })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {current && <ClientDrawer client={current} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ClientDrawer({ client, onClose }: { client: Client; onClose: () => void }) {
  const { t, db, toast, newBooking } = useAdmin();
  const bookings = useClientBookings(client.id);
  const [notes, setNotes] = useState(client.notes ?? "");
  useEffect(() => setNotes(client.notes ?? ""), [client.id, client.notes]);

  async function save() {
    try {
      await updateDoc(doc(db, COL.clients, client.id), { notes });
      toast(t.saved);
    } catch {
      toast(t.errorGeneric, "error");
    }
  }

  return (
    <Drawer title={client.name} onClose={onClose}>
      <div className="bka-booking">
        <dl className="bka-dl">
          {client.phone && (
            <>
              <dt>{t.phone}</dt>
              <dd>
                <a href={`tel:${client.phone.replace(/[^\d+]/g, "")}`}>{client.phone}</a>
              </dd>
            </>
          )}
          {client.email && (
            <>
              <dt>{t.email}</dt>
              <dd>
                <a href={`mailto:${client.email}`}>{client.email}</a>
              </dd>
            </>
          )}
          {client.lastAddress && (
            <>
              <dt>{t.address}</dt>
              <dd>{client.lastAddress.label}</dd>
            </>
          )}
        </dl>
        <button type="button" className="bka-btn bka-btn--primary" onClick={() => newBooking({ clientId: client.id })}>
          + {t.bookForClient}
        </button>
        <div className="bka-panel">
          <label className="bka-label" htmlFor={`cn-${client.id}`}>
            {t.notes}
          </label>
          <textarea id={`cn-${client.id}`} className="bka-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <p className="bka-help">{t.notesHelp}</p>
          {notes !== (client.notes ?? "") && (
            <button type="button" className="bka-btn bka-btn--primary" onClick={save}>
              {t.saveNotes}
            </button>
          )}
        </div>
        <Section title={t.clientHistory}>
          {bookings === undefined ? (
            <p className="bka-muted">{t.loading}</p>
          ) : (
            <ul className="bka-list">
              {bookings.map((b) => (
                <BookingRow key={b.id} b={b} withDate />
              ))}
            </ul>
          )}
        </Section>
      </div>
    </Drawer>
  );
}
