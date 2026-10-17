/** Weekly hours, special days, blocked time and booking rules. */
import { addDoc, collection, deleteDoc, doc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { COL, CONFIG_DOC, localDateOf, WEEKDAYS, zonedTime, type BookingRules, type TimeRange, type WeeklyHours } from "../../core/index.js";
import { HelpLink } from "./HelpView.js";
import { useAdmin, useBlocks, useExceptions } from "../data.js";
import { ConfirmButton, Field, Section, Toggle, useFormat } from "../ui.js";

function RangesEditor({ ranges, onChange }: { ranges: TimeRange[]; onChange: (r: TimeRange[]) => void }) {
  const { t } = useAdmin();
  return (
    <div className="bka-ranges">
      {ranges.map((r, i) => (
        <span key={i} className="bka-range">
          <input className="bka-input" type="time" step={300} value={r.start} aria-label={t.start} onChange={(e) => onChange(ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
          <span>–</span>
          <input className="bka-input" type="time" step={300} value={r.end} aria-label={t.end} onChange={(e) => onChange(ranges.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
          <button type="button" className="bka-iconbtn" aria-label={t.delete} onClick={() => onChange(ranges.filter((_, j) => j !== i))}>
            ✕
          </button>
        </span>
      ))}
      <button
        type="button"
        className="bka-link"
        onClick={() => {
          const last = ranges.at(-1);
          onChange([...ranges, last ? { start: last.end < "20:00" ? last.end : "14:00", end: "18:00" } : { start: "09:00", end: "12:00" }]);
        }}
      >
        + {t.addRange}
      </button>
    </div>
  );
}

const validRanges = (ranges: TimeRange[]) => ranges.every((r) => r.start && r.end && (r.end > r.start || r.end === "00:00"));

export function AvailabilityView() {
  const { t, weekly, settings, db, toast, locale } = useAdmin();
  const f = useFormat();
  const tz = settings.timezone;
  const [hours, setHours] = useState<WeeklyHours>(weekly);
  const [rules, setRules] = useState<BookingRules>(settings.rules);
  useEffect(() => setHours(weekly), [weekly]);
  useEffect(() => setRules(settings.rules), [settings.rules]);

  const exceptions = useExceptions();
  const blocks = useBlocks();
  const today = localDateOf(Date.now(), tz);
  const [ex, setEx] = useState({ date: today, closed: true, ranges: [{ start: "09:00", end: "12:00" }] as TimeRange[], note: "" });
  const [block, setBlock] = useState({ date: today, start: "12:00", endDate: today, end: "13:00", reason: "" });

  const dayName = (i: number) => new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i)));
  const hoursDirty = JSON.stringify(hours) !== JSON.stringify(weekly);
  const rulesDirty = JSON.stringify(rules) !== JSON.stringify(settings.rules);

  const run = (p: Promise<unknown>) => p.then(() => toast(t.saved)).catch(() => toast(t.errorGeneric, "error"));

  function addBlock() {
    const s = zonedTime(block.date, block.start, tz);
    const e = zonedTime(block.endDate, block.end, tz);
    if (s === null || e === null || e <= s) return toast(t.errorGeneric, "error");
    run(addDoc(collection(db, COL.blocks), { start: new Date(s).toISOString(), end: new Date(e).toISOString(), reason: block.reason || null }));
  }

  return (
    <div className="bka-view">
      <div className="bka-view__head">
        <div className="bka-titlerow">
          <h1>{t.navAvailability}</h1>
          <HelpLink section="availability" />
        </div>
      </div>

      <Section
        title={t.weeklyHours}
        help={t.weeklyHelp}
        actions={
          hoursDirty && (
            <button type="button" className="bka-btn bka-btn--primary" disabled={!WEEKDAYS.every((d) => validRanges(hours[d]))} onClick={() => run(setDoc(doc(db, COL.config, CONFIG_DOC.weekly), hours))}>
              {t.save}
            </button>
          )
        }
      >
        <div className="bka-week">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className="bka-week__day">
              <div className="bka-week__name">
                <Toggle
                  label={dayName(i)}
                  checked={hours[d].length > 0}
                  onChange={(on) => setHours({ ...hours, [d]: on ? [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }] : [] })}
                />
              </div>
              {hours[d].length ? <RangesEditor ranges={hours[d]} onChange={(r) => setHours({ ...hours, [d]: r })} /> : <span className="bka-muted">{t.closedDay}</span>}
            </div>
          ))}
        </div>
      </Section>

      <Section title={t.exceptions} help={t.exceptionsHelp}>
        <ul className="bka-list">
          {(exceptions ?? [])
            .filter((e) => e.date >= today)
            .map((e) => (
              <li key={e.id} className="bka-row">
                <span className="bka-row__main bka-row__main--static">
                  <span className="bka-row__body">
                    <span className="bka-row__title">{f.date(new Date(zonedTime(e.date, "12:00", tz) ?? 0).toISOString(), { year: "numeric" })}</span>
                    <span className="bka-muted">
                      {e.closed ? t.closedAllDay : e.ranges.map((r) => `${r.start}–${r.end}`).join(", ")}
                      {e.note ? ` · ${e.note}` : ""}
                    </span>
                  </span>
                </span>
                <div className="bka-row__actions">
                  <button type="button" className="bka-btn bka-btn--sm" onClick={() => run(deleteDoc(doc(db, COL.exceptions, e.id)))}>
                    {t.delete}
                  </button>
                </div>
              </li>
            ))}
        </ul>
        <div className="bka-card-form">
          <div className="bka-grid2">
            <Field label={t.date}>{(id) => <input id={id} className="bka-input" type="date" min={today} value={ex.date} onChange={(e) => setEx({ ...ex, date: e.target.value })} />}</Field>
            <Field label={t.note}>{(id) => <input id={id} className="bka-input" value={ex.note} onChange={(e) => setEx({ ...ex, note: e.target.value })} />}</Field>
          </div>
          <div className="bka-seg" role="group">
            <button type="button" className={ex.closed ? "bka-seg--on" : ""} aria-pressed={ex.closed} onClick={() => setEx({ ...ex, closed: true })}>
              {t.closedAllDay}
            </button>
            <button type="button" className={!ex.closed ? "bka-seg--on" : ""} aria-pressed={!ex.closed} onClick={() => setEx({ ...ex, closed: false })}>
              {t.specialHours}
            </button>
          </div>
          {!ex.closed && <RangesEditor ranges={ex.ranges} onChange={(ranges) => setEx({ ...ex, ranges })} />}
          <button
            type="button"
            className="bka-btn"
            disabled={!ex.date || (!ex.closed && (!ex.ranges.length || !validRanges(ex.ranges)))}
            onClick={() => run(setDoc(doc(db, COL.exceptions, ex.date), { date: ex.date, closed: ex.closed, ranges: ex.closed ? [] : ex.ranges, note: ex.note || null }))}
          >
            + {t.addException}
          </button>
        </div>
      </Section>

      <Section title={t.blocks} help={t.blocksHelp}>
        <ul className="bka-list">
          {(blocks ?? [])
            .filter((b) => b.end > new Date().toISOString())
            .map((b) => (
              <li key={b.id} className="bka-row">
                <span className="bka-row__main bka-row__main--static">
                  <span className="bka-row__body">
                    <span className="bka-row__title">
                      {f.date(b.start, { weekday: "short" })} {f.time(b.start)} → {localDateOf(Date.parse(b.end), tz) !== localDateOf(Date.parse(b.start), tz) ? `${f.date(b.end, { weekday: "short" })} ` : ""}
                      {f.time(b.end)}
                    </span>
                    {b.reason && <span className="bka-muted">{b.reason}</span>}
                  </span>
                </span>
                <div className="bka-row__actions">
                  <ConfirmButton label={t.delete} question={t.confirmDelete} className="bka-btn bka-btn--sm" onConfirm={() => run(deleteDoc(doc(db, COL.blocks, b.id)))} />
                </div>
              </li>
            ))}
        </ul>
        <div className="bka-card-form">
          <div className="bka-grid4">
            <Field label={t.from}>
              {(id) => <input id={id} className="bka-input" type="date" min={today} value={block.date} onChange={(e) => setBlock({ ...block, date: e.target.value, endDate: e.target.value > block.endDate ? e.target.value : block.endDate })} />}
            </Field>
            <Field label={t.start}>{(id) => <input id={id} className="bka-input" type="time" step={300} value={block.start} onChange={(e) => setBlock({ ...block, start: e.target.value })} />}</Field>
            <Field label={t.to}>{(id) => <input id={id} className="bka-input" type="date" min={block.date} value={block.endDate} onChange={(e) => setBlock({ ...block, endDate: e.target.value })} />}</Field>
            <Field label={t.end}>{(id) => <input id={id} className="bka-input" type="time" step={300} value={block.end} onChange={(e) => setBlock({ ...block, end: e.target.value })} />}</Field>
          </div>
          <Field label={t.reason}>{(id) => <input id={id} className="bka-input" value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} />}</Field>
          <button type="button" className="bka-btn" onClick={addBlock}>
            + {t.addBlock}
          </button>
        </div>
      </Section>

      <Section
        title={t.rules}
        actions={
          rulesDirty && (
            <button type="button" className="bka-btn bka-btn--primary" onClick={() => run(setDoc(doc(db, COL.config, CONFIG_DOC.business), { rules }, { merge: true }))}>
              {t.save}
            </button>
          )
        }
      >
        <div className="bka-grid2">
          <Field label={t.slotStep}>
            {(id) => (
              <select id={id} className="bka-input" value={rules.slotStepMin} onChange={(e) => setRules({ ...rules, slotStepMin: Number(e.target.value) })}>
                {[10, 15, 20, 30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t.minNotice}>
            {(id) => <input id={id} className="bka-input" type="number" min={0} step={1} value={rules.minNoticeMin / 60} onChange={(e) => setRules({ ...rules, minNoticeMin: Math.round(Number(e.target.value) * 60) })} />}
          </Field>
          <Field label={t.maxAdvance}>
            {(id) => <input id={id} className="bka-input" type="number" min={1} max={365} value={rules.maxAdvanceDays} onChange={(e) => setRules({ ...rules, maxAdvanceDays: Number(e.target.value) || 1 })} />}
          </Field>
          <Field label={t.maxPerDay}>
            {(id) => <input id={id} className="bka-input" type="number" min={0} value={rules.maxPerDay} onChange={(e) => setRules({ ...rules, maxPerDay: Number(e.target.value) || 0 })} />}
          </Field>
          <Field label={t.travelBuffer}>
            {(id) => <input id={id} className="bka-input" type="number" min={0} step={5} value={rules.travelBufferMin} onChange={(e) => setRules({ ...rules, travelBufferMin: Number(e.target.value) || 0 })} />}
          </Field>
        </div>
      </Section>
    </div>
  );
}
