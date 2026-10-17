/** Form to add a booking by hand (phone, WhatsApp, in person). */
import { useMemo, useState } from "react";
import { localDateOf, type Address, type Client } from "../core/index.js";
import { AdminApiError, useAdmin, useClients } from "./data.js";
import { SlotPicker } from "./SlotPicker.js";
import { Drawer, Field, Toggle, useFormat } from "./ui.js";

export type NewBookingPrefill = { start?: string; clientId?: string; serviceId?: string };

export function NewBooking({ prefill, onClose }: { prefill: NewBookingPrefill; onClose: () => void }) {
  const { t, services, settings, api, toast, openBooking } = useAdmin();
  const f = useFormat();
  const clients = useClients();
  const tz = settings.timezone;
  const [serviceId, setServiceId] = useState(prefill.serviceId ?? services.find((s) => s.active)?.id ?? "");
  const [date, setDate] = useState(localDateOf(prefill.start ? Date.parse(prefill.start) : Date.now(), tz));
  const [start, setStart] = useState<string | undefined>(prefill.start);
  const initialClient = clients?.find((c) => c.id === prefill.clientId);
  const [picked, setPicked] = useState<Client | undefined>();
  // Clients load asynchronously: use the prefilled one once it arrives, until changed.
  const [usePrefill, setUsePrefill] = useState(!!prefill.clientId);
  const [search, setSearch] = useState("");
  const [client, setClient] = useState({ name: "", email: "", phone: "" });
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"confirmed" | "pending">("confirmed");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);

  const current = picked ?? (usePrefill ? initialClient : undefined);
  const service = services.find((s) => s.id === serviceId);
  const who = current ? { name: current.name, email: current.email, phone: current.phone } : client;
  const addr = address || (current?.lastAddress?.label ?? "");

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2 || !clients) return [];
    const digits = q.replace(/\D/g, "");
    return clients
      .filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (digits.length > 2 && c.phone.replace(/\D/g, "").includes(digits)))
      .slice(0, 6);
  }, [search, clients]);

  async function submit(force = false) {
    if (!service || !start || who.name.trim().length < 2) return;
    setBusy(true);
    try {
      const addressObj: Address | undefined =
        service.location === "home" && addr.trim() ? (current?.lastAddress?.label === addr ? current.lastAddress : { label: addr.trim() }) : undefined;
      const r = await api.create({
        serviceId,
        start,
        client: { name: who.name.trim(), email: who.email.trim(), phone: who.phone.trim() },
        address: addressObj,
        notes: notes || undefined,
        status,
        notify: notify && !!who.email,
        force,
        locale: settings.defaultLocale,
      });
      toast(t.saved);
      onClose();
      openBooking(r.booking.id);
    } catch (e) {
      const code = e instanceof AdminApiError ? e.code : "server";
      if (code === "slot_taken") setConflict(true);
      toast(code === "slot_taken" ? t.conflict : t.errorGeneric, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={t.newBookingTitle}
      onClose={onClose}
      footer={
        <div className="bka-actions">
          <button type="button" className="bka-btn bka-btn--primary" disabled={busy || !start || !service || who.name.trim().length < 2} onClick={() => submit(false)}>
            {t.create}
          </button>
          {conflict && (
            <button type="button" className="bka-btn" disabled={busy} onClick={() => submit(true)}>
              {t.forceAnyway}
            </button>
          )}
          <button type="button" className="bka-btn" onClick={onClose}>
            {t.cancel}
          </button>
        </div>
      }
    >
      <div className="bka-form">
        <Field label={t.service}>
          {(id) => (
            <select id={id} className="bka-input" value={serviceId} onChange={(e) => (setServiceId(e.target.value), setConflict(false))}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {f.name(s.name)} · {s.durationMin} min{s.active ? "" : ` (${t.hidden})`}
                </option>
              ))}
            </select>
          )}
        </Field>

        {serviceId && (
          <SlotPicker
            serviceId={serviceId}
            date={date}
            onDate={setDate}
            value={start}
            onChange={(s) => {
              setStart(s);
              setConflict(false);
            }}
          />
        )}

        <fieldset className="bka-fieldset">
          <legend>{t.client}</legend>
          {current ? (
            <div className="bka-picked">
              <div>
                <strong>{current.name}</strong>
                <p className="bka-muted">{[current.phone, current.email].filter(Boolean).join(" · ")}</p>
              </div>
              <button type="button" className="bka-link" onClick={() => (setPicked(undefined), setUsePrefill(false), setSearch(""))}>
                {t.edit}
              </button>
            </div>
          ) : (
            <>
              <Field label={t.searchClient}>
                {(id) => <input id={id} className="bka-input" placeholder={t.searchClientPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} />}
              </Field>
              {matches.length > 0 && (
                <ul className="bka-matches">
                  {matches.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => setPicked(c)}>
                        <strong>{c.name}</strong> <span className="bka-muted">{[c.phone, c.email].filter(Boolean).join(" · ")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="bka-label">{t.newClient}</p>
              <Field label={t.name}>{(id) => <input id={id} className="bka-input" value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} />}</Field>
              <div className="bka-grid2">
                <Field label={t.phone}>
                  {(id) => <input id={id} className="bka-input" type="tel" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} />}
                </Field>
                <Field label={t.email}>
                  {(id) => <input id={id} className="bka-input" type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} />}
                </Field>
              </div>
            </>
          )}
        </fieldset>

        {service?.location === "home" && (
          <Field label={t.address}>{(id) => <input id={id} className="bka-input" value={addr} onChange={(e) => setAddress(e.target.value)} />}</Field>
        )}

        <Field label={t.statusLabel}>
          {(id) => (
            <select id={id} className="bka-input" value={status} onChange={(e) => setStatus(e.target.value as "confirmed" | "pending")}>
              <option value="confirmed">{t.confirmed}</option>
              <option value="pending">{t.pending}</option>
            </select>
          )}
        </Field>
        <Field label={t.notes} help={t.notesHelp}>
          {(id) => <textarea id={id} className="bka-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        {who.email ? <Toggle label={t.notifyClient} checked={notify} onChange={setNotify} /> : null}
      </div>
    </Drawer>
  );
}
