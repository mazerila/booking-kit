/** Services and categories: create, edit, order, hide. */
import { addDoc, collection, deleteDoc, doc, setDoc, writeBatch } from "firebase/firestore";
import { useState } from "react";
import { COL, formatDuration, formatPrice, type Category, type LocationMode, type Service } from "../../core/index.js";
import { HelpLink } from "./HelpView.js";
import { useAdmin } from "../data.js";
import { ConfirmButton, Drawer, Field, LocalizedInput, Section, Toggle, useFormat } from "../ui.js";

const blank = (order: number): Omit<Service, "id"> => ({
  name: {},
  description: {},
  durationMin: 60,
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  location: "studio",
  active: true,
  order,
});

/** Firestore rejects undefined values; empty optional numbers are removed. */
function clean<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && !(typeof v === "number" && Number.isNaN(v)))) as T;
}

export function ServicesView() {
  const { t, services, categories, db, toast, settings, locale } = useAdmin();
  const f = useFormat();
  const [editing, setEditing] = useState<(Omit<Service, "id"> & { id?: string }) | null>(null);
  const [catName, setCatName] = useState<Record<string, string>>({});

  async function reorder(list: Service[], i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j]!, next[i]!];
    const batch = writeBatch(db);
    next.forEach((s, k) => batch.update(doc(db, COL.services, s.id), { order: k }));
    await batch.commit().catch(() => toast(t.errorGeneric, "error"));
  }

  async function save() {
    if (!editing) return;
    const { id, ...data } = editing;
    try {
      if (id) await setDoc(doc(db, COL.services, id), clean(data));
      else await addDoc(collection(db, COL.services), clean(data));
      toast(t.saved);
      setEditing(null);
    } catch {
      toast(t.errorGeneric, "error");
    }
  }

  async function addCategory() {
    if (!Object.values(catName).some((v) => v.trim())) return;
    await addDoc(collection(db, COL.categories), { name: catName, order: categories.length }).catch(() => toast(t.errorGeneric, "error"));
    setCatName({});
  }

  const groups: { cat?: Category; list: Service[] }[] = [
    ...categories.map((c) => ({ cat: c, list: services.filter((s) => s.categoryId === c.id) })),
    { cat: undefined, list: services.filter((s) => !s.categoryId || !categories.some((c) => c.id === s.categoryId)) },
  ].filter((g) => g.list.length || g.cat);

  return (
    <div className="bka-view">
      <div className="bka-view__head">
        <div className="bka-titlerow">
          <h1>{t.navServices}</h1>
          <HelpLink section="services" />
        </div>
        <button type="button" className="bka-btn bka-btn--primary" onClick={() => setEditing(blank(services.length))}>
          + {t.addService}
        </button>
      </div>
      <p className="bka-help">{t.servicesIntro}</p>

      {groups.map((g) => (
        <Section key={g.cat?.id ?? "none"} title={g.cat ? f.name(g.cat.name) : t.noCategory}>
          <ul className="bka-list">
            {g.list.map((s, i) => (
              <li key={s.id} className={`bka-row${s.active ? "" : " bka-row--muted"}`}>
                <button type="button" className="bka-row__main" onClick={() => setEditing({ ...s })}>
                  <span className="bka-row__body">
                    <span className="bka-row__title">
                      {f.name(s.name) || "—"} {!s.active && <span className="bka-tag">{t.hidden}</span>}
                    </span>
                    <span className="bka-muted">
                      {formatDuration(s.durationMin, locale)}
                      {s.price !== undefined && ` · ${formatPrice(s.price, settings.currency, locale)}`} ·{" "}
                      {s.location === "home" ? t.locHome : s.location === "online" ? t.locOnline : t.locStudio}
                    </span>
                  </span>
                </button>
                <div className="bka-row__actions">
                  <button type="button" className="bka-iconbtn" onClick={() => reorder(g.list, i, -1)} disabled={i === 0} aria-label={t.moveUp}>
                    ↑
                  </button>
                  <button type="button" className="bka-iconbtn" onClick={() => reorder(g.list, i, 1)} disabled={i === g.list.length - 1} aria-label={t.moveDown}>
                    ↓
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      <Section title={t.categories}>
        <ul className="bka-list">
          {categories.map((c) => (
            <li key={c.id} className="bka-row">
              <span className="bka-row__main bka-row__main--static">
                <span className="bka-row__title">{f.name(c.name)}</span>
              </span>
              <div className="bka-row__actions">
                <ConfirmButton
                  label={t.delete}
                  question={t.confirmDelete}
                  className="bka-btn bka-btn--sm"
                  onConfirm={() => deleteDoc(doc(db, COL.categories, c.id)).catch(() => toast(t.errorGeneric, "error"))}
                />
              </div>
            </li>
          ))}
        </ul>
        <div className="bka-inline-form">
          <LocalizedInput label={t.addCategory} value={catName} onChange={setCatName} />
          <button type="button" className="bka-btn" onClick={addCategory}>
            {t.add}
          </button>
        </div>
      </Section>

      {editing && (
        <Drawer
          title={editing.id ? f.name(editing.name) || t.edit : t.addService}
          onClose={() => setEditing(null)}
          footer={
            <div className="bka-actions">
              <button type="button" className="bka-btn bka-btn--primary" onClick={save} disabled={!Object.values(editing.name).some((v) => v?.trim())}>
                {t.save}
              </button>
              <button type="button" className="bka-btn" onClick={() => setEditing(null)}>
                {t.cancel}
              </button>
              {editing.id && (
                <ConfirmButton
                  label={t.delete}
                  question={t.confirmDelete}
                  className="bka-btn bka-btn--danger-outline"
                  onConfirm={async () => {
                    await deleteDoc(doc(db, COL.services, editing.id!)).catch(() => toast(t.errorGeneric, "error"));
                    setEditing(null);
                  }}
                />
              )}
            </div>
          }
        >
          <ServiceForm value={editing} onChange={setEditing} />
        </Drawer>
      )}
    </div>
  );
}

function ServiceForm({ value: s, onChange }: { value: Omit<Service, "id"> & { id?: string }; onChange: (s: Omit<Service, "id"> & { id?: string }) => void }) {
  const { t, categories } = useAdmin();
  const f = useFormat();
  const set = (patch: Partial<Service>) => onChange({ ...s, ...patch });
  const num = (v: string) => (v === "" ? undefined : Number(v));
  return (
    <div className="bka-form">
      <LocalizedInput label={t.serviceName} value={s.name} onChange={(name) => set({ name })} />
      <LocalizedInput label={t.description} value={s.description} onChange={(description) => set({ description })} multiline />
      <div className="bka-grid2">
        <Field label={t.category}>
          {(id) => (
            <select id={id} className="bka-input" value={s.categoryId ?? ""} onChange={(e) => set({ categoryId: e.target.value || undefined })}>
              <option value="">{t.noCategory}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {f.name(c.name)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t.location}>
          {(id) => (
            <select id={id} className="bka-input" value={s.location} onChange={(e) => set({ location: e.target.value as LocationMode })}>
              <option value="studio">{t.locStudio}</option>
              <option value="home">{t.locHome}</option>
              <option value="online">{t.locOnline}</option>
            </select>
          )}
        </Field>
        <Field label={t.durationMin}>
          {(id) => <input id={id} className="bka-input" type="number" min={5} step={5} value={s.durationMin} onChange={(e) => set({ durationMin: Math.max(5, Number(e.target.value)) })} />}
        </Field>
        <Field label={t.priceLabel}>
          {(id) => <input id={id} className="bka-input" type="number" min={0} step="0.01" value={s.price ?? ""} onChange={(e) => set({ price: num(e.target.value) })} />}
        </Field>
        <Field label={t.wasPrice}>
          {(id) => <input id={id} className="bka-input" type="number" min={0} step="0.01" value={s.wasPrice ?? ""} onChange={(e) => set({ wasPrice: num(e.target.value) })} />}
        </Field>
        <Field label={t.bufferBefore}>
          {(id) => <input id={id} className="bka-input" type="number" min={0} step={5} value={s.bufferBeforeMin} onChange={(e) => set({ bufferBeforeMin: Number(e.target.value) || 0 })} />}
        </Field>
        <Field label={t.bufferAfter}>
          {(id) => <input id={id} className="bka-input" type="number" min={0} step={5} value={s.bufferAfterMin} onChange={(e) => set({ bufferAfterMin: Number(e.target.value) || 0 })} />}
        </Field>
      </div>
      <LocalizedInput label={t.badge} value={s.badge} onChange={(badge) => set({ badge })} />
      <Toggle label={t.active} checked={s.active} onChange={(active) => set({ active })} />
    </div>
  );
}
