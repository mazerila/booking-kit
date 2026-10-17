/** Date + time choice for the admin: free times as shortcuts, any time allowed. */
import { useEffect, useState } from "react";
import { formatTime, isWallTime, wallTimeOf, zonedTime } from "../core/index.js";
import { useAdmin } from "./data.js";
import { Field } from "./ui.js";

export function SlotPicker({
  serviceId,
  date,
  onDate,
  value,
  onChange,
  excludeId,
}: {
  serviceId: string;
  date: string;
  onDate: (d: string) => void;
  value?: string;
  onChange: (start: string | undefined) => void;
  excludeId?: string;
  durationMin?: number;
}) {
  const { api, t, settings, locale } = useAdmin();
  const tz = settings.timezone;
  const [slots, setSlots] = useState<string[] | null>(null);
  const [custom, setCustom] = useState(value ? wallTimeOf(Date.parse(value), tz) : "");

  useEffect(() => {
    if (!serviceId || !date) return;
    let cancelled = false;
    setSlots(null);
    api.slots(serviceId, date, date, excludeId).then(
      (r) => !cancelled && setSlots(r.slots[date] ?? []),
      () => !cancelled && setSlots([]),
    );
    return () => {
      cancelled = true;
    };
  }, [api, serviceId, date, excludeId]);

  function setTime(time: string) {
    setCustom(time);
    if (!isWallTime(time)) return onChange(undefined);
    const ms = zonedTime(date, time, tz);
    onChange(ms === null ? undefined : new Date(ms).toISOString());
  }

  // Changing the day keeps the chosen time.
  useEffect(() => {
    if (custom) setTime(custom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <div className="bka-slotpicker">
      <div className="bka-grid2">
        <Field label={t.date}>{(id) => <input id={id} className="bka-input" type="date" value={date} onChange={(e) => e.target.value && onDate(e.target.value)} />}</Field>
        <Field label={t.time}>{(id) => <input id={id} className="bka-input" type="time" step={300} value={custom} onChange={(e) => setTime(e.target.value)} />}</Field>
      </div>
      <p className="bka-label">{t.freeSlots}</p>
      {slots === null ? (
        <p className="bka-muted">{t.loading}</p>
      ) : slots.length ? (
        <div className="bka-slots">
          {slots.map((s) => {
            const time = wallTimeOf(Date.parse(s), tz);
            return (
              <button type="button" key={s} className={`bka-slot${value === s ? " bka-slot--on" : ""}`} aria-pressed={value === s} onClick={() => setTime(time)}>
                {formatTime(Date.parse(s), tz, locale)}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="bka-help">{t.noFreeSlots}</p>
      )}
    </div>
  );
}
