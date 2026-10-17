/** Month calendar of available days + the times of the selected day. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, fill, formatLocalDate, formatTime, localDateOf, wallParts, weekdayOf, WEEKDAYS } from "../core/index.js";
import type { Availability } from "./api.js";
import { Alert, errorText, Icon, Spinner, useWidget } from "./ui.js";

type Props = {
  /** Fetches slots for a range of local dates (≤ 62 days). */
  load: (from: string, to: string) => Promise<Availability>;
  /** Selected start (ISO). */
  value?: string;
  onChange: (start: string) => void;
  /** Open on this instant's day when nothing is selected (rescheduling). */
  initial?: string;
  /** Bumped to force a reload (e.g. after a slot was taken). */
  reloadKey?: number;
};

const monthOf = (date: string) => `${date.slice(0, 7)}-01`;
const addMonths = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
};
const endOfMonth = (month: string) => addDays(addMonths(month, 1), -1);

export function DateTimePicker({ load, value, initial, onChange, reloadKey = 0 }: Props) {
  const { config, locale, t } = useWidget();
  const tz = config.timezone;
  const today = localDateOf(Date.now(), tz);
  const lastDate = addDays(today, config.rules.maxAdvanceDays);
  const firstMonth = monthOf(today);
  const lastMonth = monthOf(lastDate);

  const startAt = value ?? (initial && initial > new Date().toISOString() ? initial : undefined);
  const [month, setMonth] = useState(() => (startAt ? monthOf(localDateOf(Date.parse(startAt), tz)) : firstMonth));
  const [slots, setSlots] = useState<Record<string, Record<string, string[]>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(startAt ? localDateOf(Date.parse(startAt), tz) : null);
  const [searching, setSearching] = useState(false);
  const autoAdvance = useRef(!startAt);
  const timesRef = useRef<HTMLDivElement>(null);

  const fetchMonth = useCallback(
    async (m: string) => {
      const from = m <= firstMonth ? today : m;
      const to = endOfMonth(m) > lastDate ? lastDate : endOfMonth(m);
      if (to < from) return {};
      const r = await load(from, to);
      return r.slots;
    },
    [load, today, lastDate, firstMonth],
  );

  // Load the visible month; on first display, skip ahead to the first month with availability.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        let m = month;
        let s = await fetchMonth(m);
        while (autoAdvance.current && !Object.keys(s).length && m < lastMonth) {
          m = addMonths(m, 1);
          s = await fetchMonth(m);
        }
        if (cancelled) return;
        setSlots((prev) => ({ ...prev, [m]: s }));
        if (m !== month) setMonth(m);
        if (autoAdvance.current) {
          const first = Object.keys(s).sort()[0];
          if (first) setSelectedDate(first);
        }
        autoAdvance.current = false;
      } catch (e) {
        if (!cancelled) setError(errorText(t, (e as { code?: string }).code ?? "server"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, reloadKey]);

  const monthSlots = slots[month];
  const daySlots = (selectedDate && monthSlots?.[selectedDate]) || [];

  async function findNext() {
    setSearching(true);
    try {
      for (let m = addMonths(month, 1); m <= lastMonth; m = addMonths(m, 1)) {
        const s = await fetchMonth(m);
        if (Object.keys(s).length) {
          setSlots((prev) => ({ ...prev, [m]: s }));
          setMonth(m);
          setSelectedDate(Object.keys(s).sort()[0]!);
          return;
        }
      }
      setError(t.noSlotsAtAll);
    } catch (e) {
      setError(errorText(t, (e as { code?: string }).code ?? "server"));
    } finally {
      setSearching(false);
    }
  }

  const weekStart = locale === "en-US" ? 6 : 0; // index in WEEKDAYS (mon…sun)
  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
    // 2024-01-01 was a Monday.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + ((i + weekStart) % 7)))));
  }, [locale, weekStart]);

  const cells = useMemo(() => {
    const first = month;
    const offset = (WEEKDAYS.indexOf(weekdayOf(first)) - weekStart + 7) % 7;
    const days: (string | null)[] = Array.from({ length: offset }, () => null);
    for (let d = first; d <= endOfMonth(month); d = addDays(d, 1)) days.push(d);
    while (days.length % 7) days.push(null);
    return days;
  }, [month, weekStart]);

  const groups = useMemo(() => {
    const g: { label: string; times: string[] }[] = [
      { label: t.morning, times: [] },
      { label: t.afternoon, times: [] },
      { label: t.evening, times: [] },
    ];
    for (const s of daySlots) {
      const h = wallParts(Date.parse(s), tz).hour;
      g[h < 12 ? 0 : h < 17 ? 1 : 2]!.times.push(s);
    }
    return g.filter((x) => x.times.length);
  }, [daySlots, tz, t]);

  const browserTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : tz;
  const monthLabel = formatLocalDate(month, locale, { weekday: undefined, day: undefined, month: "long", year: "numeric" });
  const hasAny = monthSlots && Object.keys(monthSlots).length > 0;

  function pickDate(d: string) {
    setSelectedDate(d);
    // On phones the times are below the calendar: bring them into view.
    requestAnimationFrame(() => timesRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  return (
    <div className="bk-datetime">
      <div className="bk-calendar">
        <div className="bk-calendar__head">
          <button type="button" className="bk-iconbtn" onClick={() => setMonth(addMonths(month, -1))} disabled={month <= firstMonth} aria-label={t.previousMonth}>
            <Icon name="left" />
          </button>
          <h3 className="bk-calendar__month" aria-live="polite">
            {monthLabel}
          </h3>
          <button type="button" className="bk-iconbtn" onClick={() => setMonth(addMonths(month, 1))} disabled={month >= lastMonth} aria-label={t.nextMonth}>
            <Icon name="right" />
          </button>
        </div>
        <div className="bk-calendar__grid" role="grid" aria-busy={loading}>
          <div role="row" className="bk-calendar__row">
            {weekdayLabels.map((w) => (
              <span role="columnheader" key={w} className="bk-calendar__wd">
                {w}
              </span>
            ))}
          </div>
          {Array.from({ length: cells.length / 7 }, (_, r) => (
            <div role="row" className="bk-calendar__row" key={r}>
              {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
                if (!d) return <span role="gridcell" key={i} />;
                const available = !!monthSlots?.[d]?.length;
                const selected = d === selectedDate;
                return (
                  <span role="gridcell" key={d}>
                    <button
                      type="button"
                      className={`bk-day${available ? " bk-day--available" : ""}${selected ? " bk-day--selected" : ""}${d === today ? " bk-day--today" : ""}`}
                      disabled={!available}
                      aria-pressed={selected}
                      aria-label={formatLocalDate(d, locale)}
                      onClick={() => pickDate(d)}
                    >
                      {Number(d.slice(8))}
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        {loading && <Spinner label={t.loading} />}
        {!loading && monthSlots && !hasAny && (
          <div className="bk-empty">
            <p>{t.noSlotsMonth}</p>
            {month < lastMonth && (
              <button type="button" className="bk-btn bk-btn--secondary" onClick={findNext} disabled={searching}>
                {searching ? t.loading : t.nextAvailable}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="bk-times" ref={timesRef}>
        {error && <Alert>{error}</Alert>}
        {selectedDate && hasAny && (
          <>
            <h3 className="bk-times__date">{formatLocalDate(selectedDate, locale)}</h3>
            {!daySlots.length && <p className="bk-muted">{t.noSlotsDay}</p>}
            {groups.map((g) => (
              <div className="bk-times__group" key={g.label}>
                <p className="bk-times__label">{g.label}</p>
                <div className="bk-times__list">
                  {g.times.map((s) => (
                    <button
                      type="button"
                      key={s}
                      className={`bk-time${value === s ? " bk-time--selected" : ""}`}
                      aria-pressed={value === s}
                      onClick={() => onChange(s)}
                    >
                      {formatTime(Date.parse(s), tz, locale)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {browserTz !== tz && <p className="bk-help">{fill(t.timezoneNote, { zone: tz.split("/").pop()!.replace(/_/g, " ") })}</p>}
          </>
        )}
      </div>
    </div>
  );
}
