/** Business settings: contact, zone, policies, reminders, form questions, e-mail texts. */
import { doc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { COL, CONFIG_DOC, defaultEmailText, isValidTimeZone, type EmailKind, type FieldDef, type FieldType, type Settings } from "../../core/index.js";
import { useAdmin } from "../data.js";
import { ConfirmButton, Field, LocalizedInput, Section, Toggle, useFormat } from "../ui.js";

const list = (s: string) =>
  s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

const CLIENT_EMAILS: EmailKind[] = ["confirmed", "requested", "declined", "cancelled", "rescheduled", "reminder"];
const FIELD_TYPES: FieldType[] = ["text", "textarea", "select", "checkbox", "number", "date", "email", "tel"];

export function SettingsView() {
  const { t, settings, db, toast, api } = useAdmin();
  const [s, setS] = useState<Settings>(settings);
  const [dirty, setDirty] = useState(false);
  const [locating, setLocating] = useState(false);
  // Text versions of list fields, so typing commas works naturally.
  const [notify, setNotify] = useState(settings.notifyEmails.join(", "));
  const [postcodes, setPostcodes] = useState(settings.zone.postcodes.join(", "));
  const [locales, setLocales] = useState(settings.locales.join(", "));

  useEffect(() => {
    if (dirty) return;
    setS(settings);
    setNotify(settings.notifyEmails.join(", "));
    setPostcodes(settings.zone.postcodes.join(", "));
    setLocales(settings.locales.join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const set = (patch: Partial<Settings>) => {
    setS((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  async function locate() {
    if (!s.base.address) return;
    setLocating(true);
    const r = await api.geocode(s.base.address);
    setLocating(false);
    const hit = r.results[0];
    if (hit) set({ base: { address: hit.label, lat: hit.lat, lng: hit.lng } });
    else toast(t.notLocated, "error");
  }

  async function save() {
    const tz = s.timezone.trim();
    if (!isValidTimeZone(tz)) return toast(`${t.timezone} ?`, "error");
    const langs = list(locales);
    const next: Settings = {
      ...s,
      timezone: tz,
      notifyEmails: list(notify).map((e) => e.toLowerCase()),
      zone: { ...s.zone, postcodes: list(postcodes) },
      locales: langs.length ? langs : ["fr"],
      defaultLocale: langs.includes(s.defaultLocale) ? s.defaultLocale : (langs[0] ?? "fr"),
    };
    try {
      // JSON round-trip drops undefined values, which Firestore rejects.
      await setDoc(doc(db, COL.config, CONFIG_DOC.business), JSON.parse(JSON.stringify(next)));
      setDirty(false);
      toast(t.saved);
    } catch {
      toast(t.errorGeneric, "error");
    }
  }

  return (
    <div className="bka-view">
      <div className="bka-view__head">
        <h1>{t.navSettings}</h1>
      </div>

      <Section title={t.business}>
        <div className="bka-grid2">
          <Field label={t.businessName}>{(id) => <input id={id} className="bka-input" value={s.businessName} onChange={(e) => set({ businessName: e.target.value })} />}</Field>
          <Field label={t.contactPhone}>
            {(id) => <input id={id} className="bka-input" type="tel" value={s.contact.phone ?? ""} onChange={(e) => set({ contact: { ...s.contact, phone: e.target.value } })} />}
          </Field>
          <Field label={t.contactEmail}>
            {(id) => <input id={id} className="bka-input" type="email" value={s.contact.email ?? ""} onChange={(e) => set({ contact: { ...s.contact, email: e.target.value } })} />}
          </Field>
        </div>
        <Field label={t.baseAddress} help={s.base.lat != null ? `✓ ${t.located}` : s.zone.mode === "radius" ? t.notLocated : undefined}>
          {(id) => (
            <div className="bka-inline">
              <input id={id} className="bka-input" value={s.base.address ?? ""} onChange={(e) => set({ base: { address: e.target.value } })} />
              <button type="button" className="bka-btn" onClick={locate} disabled={locating || !s.base.address}>
                {t.locate}
              </button>
            </div>
          )}
        </Field>
      </Section>

      <Section title={t.zone}>
        <Field label={t.zoneMode}>
          {(id) => (
            <select id={id} className="bka-input" value={s.zone.mode} onChange={(e) => set({ zone: { ...s.zone, mode: e.target.value as Settings["zone"]["mode"] } })}>
              <option value="none">{t.zoneNone}</option>
              <option value="radius">{t.zoneRadius}</option>
              <option value="postcodes">{t.zonePostcodes}</option>
            </select>
          )}
        </Field>
        {s.zone.mode === "radius" && (
          <Field label={t.radiusKm}>
            {(id) => <input id={id} className="bka-input bka-input--short" type="number" min={1} value={s.zone.radiusKm} onChange={(e) => set({ zone: { ...s.zone, radiusKm: Number(e.target.value) || 1 } })} />}
          </Field>
        )}
        {s.zone.mode === "postcodes" && (
          <Field label={t.postcodes}>
            {(id) => (
              <textarea
                id={id}
                className="bka-input"
                rows={2}
                value={postcodes}
                onChange={(e) => {
                  setPostcodes(e.target.value);
                  setDirty(true);
                }}
              />
            )}
          </Field>
        )}
        {s.zone.mode !== "none" && (
          <>
            <Field label={t.outOfZone_}>
              {(id) => (
                <select id={id} className="bka-input" value={s.zone.outOfZone} onChange={(e) => set({ zone: { ...s.zone, outOfZone: e.target.value as "block" | "request" } })}>
                  <option value="request">{t.outOfZoneRequest}</option>
                  <option value="block">{t.outOfZoneBlock}</option>
                </select>
              )}
            </Field>
            <LocalizedInput label={t.zoneMessage} value={s.zone.message} onChange={(message) => set({ zone: { ...s.zone, message } })} />
          </>
        )}
      </Section>

      <Section title={t.policies}>
        <Field label={t.confirmation}>
          {(id) => (
            <select id={id} className="bka-input" value={s.policies.confirmation} onChange={(e) => set({ policies: { ...s.policies, confirmation: e.target.value as "instant" | "request" } })}>
              <option value="instant">{t.confirmInstant}</option>
              <option value="request">{t.confirmRequest}</option>
            </select>
          )}
        </Field>
        <Toggle label={t.allowCancel} checked={s.policies.allowClientCancel} onChange={(v) => set({ policies: { ...s.policies, allowClientCancel: v } })} />
        <Toggle label={t.allowReschedule} checked={s.policies.allowClientReschedule} onChange={(v) => set({ policies: { ...s.policies, allowClientReschedule: v } })} />
        <Field label={t.changeUntil}>
          {(id) => (
            <input id={id} className="bka-input bka-input--short" type="number" min={0} value={s.policies.changeUntilHours} onChange={(e) => set({ policies: { ...s.policies, changeUntilHours: Number(e.target.value) || 0 } })} />
          )}
        </Field>
        <LocalizedInput label={t.policyText} value={s.policies.text} multiline onChange={(text) => set({ policies: { ...s.policies, text } })} />
      </Section>

      <Section title={t.reminders}>
        <Toggle label={t.remindersEnabled} checked={s.reminders.enabled} onChange={(v) => set({ reminders: { ...s.reminders, enabled: v } })} />
        {s.reminders.enabled && (
          <Field label={t.hoursBefore}>
            {(id) => (
              <input id={id} className="bka-input bka-input--short" type="number" min={1} max={168} value={s.reminders.hoursBefore} onChange={(e) => set({ reminders: { ...s.reminders, hoursBefore: Number(e.target.value) || 24 } })} />
            )}
          </Field>
        )}
      </Section>

      <Section title={t.notifications}>
        <Field label={t.notifyEmails}>
          {(id) => (
            <input
              id={id}
              className="bka-input"
              value={notify}
              onChange={(e) => {
                setNotify(e.target.value);
                setDirty(true);
              }}
            />
          )}
        </Field>
      </Section>

      <Section title={t.formFields} help={t.formFieldsHelp}>
        <FieldsEditor fields={s.fields} onChange={(fields) => set({ fields })} />
      </Section>

      <Section title={t.emailTexts} help={t.emailTextsHelp}>
        <EmailTextsEditor value={s} onChange={(emailTexts) => set({ emailTexts })} />
      </Section>

      <Section title={t.regional}>
        <div className="bka-grid2">
          <Field label={t.timezone}>{(id) => <input id={id} className="bka-input" value={s.timezone} onChange={(e) => set({ timezone: e.target.value })} />}</Field>
          <Field label={t.currency}>
            {(id) => <input id={id} className="bka-input bka-input--short" value={s.currency} maxLength={3} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} />}
          </Field>
          <Field label={t.locales}>
            {(id) => (
              <input
                id={id}
                className="bka-input"
                value={locales}
                onChange={(e) => {
                  setLocales(e.target.value);
                  setDirty(true);
                }}
              />
            )}
          </Field>
          <Field label={t.defaultLocale}>{(id) => <input id={id} className="bka-input bka-input--short" value={s.defaultLocale} onChange={(e) => set({ defaultLocale: e.target.value.trim() })} />}</Field>
        </div>
      </Section>

      {dirty && (
        <div className="bka-savebar">
          <button type="button" className="bka-btn bka-btn--primary" onClick={save}>
            {t.saveSettings}
          </button>
          <button
            type="button"
            className="bka-btn"
            onClick={() => {
              setDirty(false);
              setS(settings);
              setNotify(settings.notifyEmails.join(", "));
              setPostcodes(settings.zone.postcodes.join(", "));
              setLocales(settings.locales.join(", "));
            }}
          >
            {t.cancel}
          </button>
        </div>
      )}
    </div>
  );
}

function FieldsEditor({ fields, onChange }: { fields: FieldDef[]; onChange: (f: FieldDef[]) => void }) {
  const { t, services, categories } = useAdmin();
  const fmt = useFormat();
  const update = (i: number, patch: Partial<FieldDef>) => onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  return (
    <div className="bka-fields">
      {fields.map((f, i) => (
        <details key={i} className="bka-fielditem" open={!Object.values(f.label).some(Boolean)}>
          <summary>
            <span>
              <strong>{fmt.name(f.label).replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") || "—"}</strong>
              <span className="bka-muted">
                {" "}
                · {t.types[f.type]}
                {f.required ? ` · ${t.required}` : ""}
              </span>
            </span>
            <span className="bka-row__actions">
              <button type="button" className="bka-iconbtn" aria-label={t.moveUp} onClick={(e) => (e.preventDefault(), move(i, -1))}>
                ↑
              </button>
              <button type="button" className="bka-iconbtn" aria-label={t.moveDown} onClick={(e) => (e.preventDefault(), move(i, 1))}>
                ↓
              </button>
            </span>
          </summary>
          <div className="bka-form">
            <div className="bka-grid2">
              <Field label={t.fieldType}>
                {(id) => (
                  <select id={id} className="bka-input" value={f.type} onChange={(e) => update(i, { type: e.target.value as FieldType })}>
                    {FIELD_TYPES.map((ty) => (
                      <option key={ty} value={ty}>
                        {t.types[ty]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t.fieldId}>
                {(id) => <input id={id} className="bka-input" value={f.id} onChange={(e) => update(i, { id: e.target.value.replace(/[^\w-]/g, "") })} />}
              </Field>
            </div>
            <LocalizedInput label={t.fieldLabel} value={f.label} onChange={(label) => update(i, { label })} help={f.type === "checkbox" ? "[texte](/lien/)" : undefined} />
            <LocalizedInput label={t.fieldHelp} value={f.help} onChange={(help) => update(i, { help })} />
            {f.type === "select" && (
              <Field label={t.options}>
                {(id) => (
                  <textarea
                    id={id}
                    className="bka-input"
                    rows={4}
                    defaultValue={(f.options ?? []).map((o) => `${o.value} | ${fmt.name(o.label)}`).join("\n")}
                    onBlur={(e) =>
                      update(i, {
                        options: e.target.value
                          .split("\n")
                          .map((l) => l.split("|").map((x) => x.trim()))
                          .filter(([v]) => v)
                          .map(([v, l]) => ({ value: v!, label: Object.fromEntries(Object.keys(f.label).length ? Object.keys(f.label).map((k) => [k, l || v!]) : [["fr", l || v!]]) })),
                      })
                    }
                  />
                )}
              </Field>
            )}
            {f.type === "number" && (
              <div className="bka-grid2">
                <Field label="Min">{(id) => <input id={id} className="bka-input" type="number" value={f.min ?? ""} onChange={(e) => update(i, { min: e.target.value === "" ? undefined : Number(e.target.value) })} />}</Field>
                <Field label="Max">{(id) => <input id={id} className="bka-input" type="number" value={f.max ?? ""} onChange={(e) => update(i, { max: e.target.value === "" ? undefined : Number(e.target.value) })} />}</Field>
              </div>
            )}
            <Field label={t.onlyFor}>
              {(id) => (
                <select
                  id={id}
                  className="bka-input"
                  multiple
                  size={Math.min(6, services.length + categories.length + 1)}
                  value={[...(f.categoryIds ?? []).map((c) => `c:${c}`), ...(f.serviceIds ?? []).map((s) => `s:${s}`)]}
                  onChange={(e) => {
                    const vals = [...e.target.selectedOptions].map((o) => o.value);
                    const categoryIds = vals.filter((v) => v.startsWith("c:")).map((v) => v.slice(2));
                    const serviceIds = vals.filter((v) => v.startsWith("s:")).map((v) => v.slice(2));
                    update(i, { categoryIds: categoryIds.length ? categoryIds : undefined, serviceIds: serviceIds.length ? serviceIds : undefined });
                  }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={`c:${c.id}`}>
                      ▸ {fmt.name(c.name)}
                    </option>
                  ))}
                  {services.map((s) => (
                    <option key={s.id} value={`s:${s.id}`}>
                      {fmt.name(s.name)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <p className="bka-help">{!f.categoryIds && !f.serviceIds ? t.allServices : ""}</p>
            <Toggle label={t.required} checked={f.required} onChange={(required) => update(i, { required })} />
            <ConfirmButton label={t.delete} question={t.confirmDelete} className="bka-btn bka-btn--danger-outline" onConfirm={() => onChange(fields.filter((_, j) => j !== i))} />
          </div>
        </details>
      ))}
      <button type="button" className="bka-btn" onClick={() => onChange([...fields, { id: `field${fields.length + 1}`, type: "text", label: {}, required: false }])}>
        + {t.addField}
      </button>
    </div>
  );
}

function EmailTextsEditor({ value: s, onChange }: { value: Settings; onChange: (v: Settings["emailTexts"]) => void }) {
  const { t } = useAdmin();
  const set = (kind: EmailKind, locale: string, key: "subject" | "body", v: string) =>
    onChange({ ...s.emailTexts, [kind]: { ...s.emailTexts[kind], [locale]: { ...s.emailTexts[kind]?.[locale], [key]: v } } });
  return (
    <div className="bka-fields">
      {CLIENT_EMAILS.map((kind) => (
        <details key={kind} className="bka-fielditem">
          <summary>
            <strong>{t.emailKinds[kind]}</strong>
          </summary>
          <div className="bka-form">
            {s.locales.map((l) => {
              const def = defaultEmailText(kind, l);
              const cur = s.emailTexts[kind]?.[l];
              return (
                <fieldset key={l} className="bka-localized">
                  {s.locales.length > 1 && <legend>{l.toUpperCase()}</legend>}
                  <Field label={t.subject}>{(id) => <input id={id} className="bka-input" placeholder={def.subject} value={cur?.subject ?? ""} onChange={(e) => set(kind, l, "subject", e.target.value)} />}</Field>
                  <Field label={t.body}>
                    {(id) => <textarea id={id} className="bka-input" rows={6} placeholder={def.body} value={cur?.body ?? ""} onChange={(e) => set(kind, l, "body", e.target.value)} />}
                  </Field>
                </fieldset>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}
